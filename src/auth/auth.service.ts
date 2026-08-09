import { createHash } from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AccountStatus, RoleName } from '../generated/prisma/client';
import { ResendService } from '../common/integrations/resend.service';
import { PrismaService } from '../prisma/prisma.service';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { hashPassword, verifyPassword } from './utils/password';
import { createPasswordResetEmail } from './utils/password-reset-email';
import { toAuthUserResponse } from './utils/to-auth-user-response';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly resendService: ResendService,
  ) {}

  async register(dto: RegisterDto) {
    this.validateRegisterDto(dto);

    const email = dto.email.trim().toLowerCase();
    const employeeNumber = dto.employeeNumber.trim();
    const existingUser = await this.prisma.user.findFirst({
      where: {
        OR: [{ email }, { employeeNumber }],
      },
    });

    if (existingUser) {
      throw new ConflictException('Email atau nomor pegawai sudah digunakan.');
    }

    const [department, staffRole] = await Promise.all([
      this.prisma.department.findUnique({
        where: { name: dto.department.trim() },
      }),
      this.prisma.role.findUnique({
        where: { name: RoleName.STAF },
      }),
    ]);

    if (!department) {
      throw new BadRequestException('Departemen tidak valid.');
    }

    if (!staffRole) {
      throw new BadRequestException('Role STAF belum tersedia.');
    }

    const user = await this.prisma.user.create({
      data: {
        employeeNumber,
        name: dto.name.trim(),
        email,
        passwordHash: hashPassword(dto.password),
        departmentId: department.id,
        roleId: staffRole.id,
        accountStatus: AccountStatus.MENUNGGU,
      },
      include: {
        department: true,
        role: true,
      },
    });

    return {
      message: 'Pendaftaran berhasil. Akun menunggu persetujuan HR.',
      user: toAuthUserResponse(user),
    };
  }

  async login(
    dto: LoginDto,
    metadata: { ip?: string; agent?: string; device?: string },
  ) {
    if (!dto.email?.trim() || !dto.password) {
      throw new BadRequestException('Email dan password wajib diisi.');
    }

    const user = await this.prisma.user.findUnique({
      where: { email: dto.email.trim().toLowerCase() },
      include: {
        department: true,
        role: true,
      },
    });

    if (!user || !verifyPassword(dto.password, user.passwordHash)) {
      throw new UnauthorizedException('Email atau password salah.');
    }

    this.ensureUserCanLogin(user.accountStatus);

    const secret = this.getRequiredSecret('JWT_SECRET');
    const accessToken = await this.jwtService.signAsync(
      { sub: user.id, email: user.email },
      { secret, expiresIn: '1d' },
    );
    const tokenHash = createHash('sha256').update(accessToken).digest('hex');

    await this.prisma.userSession.create({
      data: {
        userId: user.id,
        tokenHash,
        ip: metadata.ip,
        agent: metadata.agent,
        device: metadata.device,
      },
    });

    return {
      accessToken,
      user: toAuthUserResponse(user),
    };
  }

  async logout(userId: number, token: string) {
    const tokenHash = createHash('sha256').update(token).digest('hex');

    await this.prisma.userSession.updateMany({
      where: {
        userId,
        tokenHash,
        revokedAt: null,
      },
      data: { revokedAt: new Date() },
    });

    return { message: 'Berhasil keluar.' };
  }

  async forgotPassword(dto: ForgotPasswordDto) {
    if (!dto.email?.trim()) {
      throw new BadRequestException('Email wajib diisi.');
    }

    const user = await this.prisma.user.findUnique({
      where: { email: dto.email.trim().toLowerCase() },
    });

    if (user) {
      const token = await this.jwtService.signAsync(
        { sub: user.id, purpose: 'password-reset' },
        {
          secret: this.getRequiredSecret('RESET_PASSWORD_SECRET'),
          expiresIn: '15m',
        },
      );
      const frontendUrl = this.getRequiredEnvironment('FRONTEND_URL');
      const resetUrl = new URL('/reset-password', frontendUrl);
      resetUrl.searchParams.set('token', token);

      const resetUrlString = resetUrl.toString();
      await this.resendService.sendEmail({
        to: user.email,
        subject: 'Reset Password LaKarya',
        html: createPasswordResetEmail(user.name, resetUrlString),
        text: `Halo ${user.name}, buka link berikut untuk membuat password baru. Link berlaku selama 15 menit: ${resetUrlString}`,
      });
    }

    return {
      message: 'Link reset password telah dikirim.',
    };
  }

  async resetPassword(dto: ResetPasswordDto) {
    if (!dto.token || !dto.password || !dto.repeatPassword) {
      throw new BadRequestException('Token dan password baru wajib diisi.');
    }

    if (dto.password !== dto.repeatPassword) {
      throw new BadRequestException('Ulangi password tidak sama.');
    }

    if (dto.password.length < 6) {
      throw new BadRequestException('Password minimal 6 karakter.');
    }

    try {
      const payload = await this.jwtService.verifyAsync<{
        sub: number;
        purpose: string;
      }>(dto.token, {
        secret: this.getRequiredSecret('RESET_PASSWORD_SECRET'),
      });

      if (payload.purpose !== 'password-reset') {
        throw new Error('Invalid token purpose');
      }

      await this.prisma.$transaction([
        this.prisma.user.update({
          where: { id: payload.sub },
          data: { passwordHash: hashPassword(dto.password) },
        }),
        this.prisma.userSession.updateMany({
          where: { userId: payload.sub, revokedAt: null },
          data: { revokedAt: new Date() },
        }),
      ]);
    } catch {
      throw new UnauthorizedException(
        'Token reset tidak valid atau telah kedaluwarsa.',
      );
    }

    return { message: 'Password berhasil diubah.' };
  }

  private validateRegisterDto(dto: RegisterDto) {
    if (
      !dto.employeeNumber?.trim() ||
      !dto.name?.trim() ||
      !dto.email?.trim() ||
      !dto.department?.trim() ||
      !dto.password ||
      !dto.repeatPassword
    ) {
      throw new BadRequestException('Seluruh data pendaftaran wajib diisi.');
    }

    if (dto.password !== dto.repeatPassword) {
      throw new BadRequestException('Ulangi password tidak sama.');
    }

    if (dto.password.length < 6) {
      throw new BadRequestException('Password minimal 6 karakter.');
    }
  }

  private ensureUserCanLogin(status: AccountStatus) {
    if (status === AccountStatus.MENUNGGU) {
      throw new ForbiddenException('Akun belum disetujui.');
    }

    if (status === AccountStatus.DITANGGUHKAN) {
      throw new ForbiddenException('Akun ditangguhkan.');
    }

    if (status === AccountStatus.DITOLAK) {
      throw new ForbiddenException('Akun ditolak.');
    }

    if (status !== AccountStatus.AKTIF) {
      throw new ForbiddenException('Akun tidak dapat digunakan untuk masuk.');
    }
  }

  private getRequiredSecret(name: 'JWT_SECRET' | 'RESET_PASSWORD_SECRET') {
    const secret = process.env[name];

    if (!secret) {
      throw new Error(`${name} wajib diisi.`);
    }

    return secret;
  }

  private getRequiredEnvironment(name: string) {
    const value = process.env[name];

    if (!value) {
      throw new Error(`${name} wajib diisi.`);
    }

    return value;
  }

}
