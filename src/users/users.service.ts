import {
  AccountStatus,
  Prisma,
} from '../generated/prisma/client';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { hashPassword, verifyPassword } from '../auth/utils/password';
import { ChangePasswordDto } from './dto/change-password.dto';
import { ListUsersQueryDto } from './dto/list-users-query.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { parsePositiveNumber } from './utils/parse-positive-number';
import { toUserResponse } from './utils/to-user-response';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async getProfile(userId: number) {
    const user = await this.findUserWithRelations(userId);
    return toUserResponse(user);
  }

  async updateProfile(userId: number, dto: UpdateProfileDto) {
    const name = dto.name?.trim();
    const email = dto.email?.trim().toLowerCase();

    if (!name && !email) {
      throw new BadRequestException('Tidak ada data profil yang diubah.');
    }

    if (email) {
      const existingEmail = await this.prisma.user.findFirst({
        where: {
          email,
          id: { not: userId },
        },
      });

      if (existingEmail) {
        throw new ConflictException('Email sudah digunakan.');
      }
    }

    const user = await this.prisma.user.update({
      where: { id: userId },
      data: {
        ...(name ? { name } : {}),
        ...(email ? { email } : {}),
      },
      include: {
        department: true,
        role: true,
      },
    });

    return {
      message: 'Profil berhasil diubah.',
      user: toUserResponse(user),
    };
  }

  async changePassword(userId: number, dto: ChangePasswordDto) {
    if (!dto.currentPassword || !dto.newPassword || !dto.repeatNewPassword) {
      throw new BadRequestException('Seluruh field password wajib diisi.');
    }

    if (dto.newPassword !== dto.repeatNewPassword) {
      throw new BadRequestException('Ulangi password baru tidak sama.');
    }

    if (dto.newPassword.length < 6) {
      throw new BadRequestException('Password baru minimal 6 karakter.');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User tidak ditemukan.');
    }

    if (!verifyPassword(dto.currentPassword, user.passwordHash)) {
      throw new UnauthorizedException('Password saat ini salah.');
    }

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: userId },
        data: { passwordHash: hashPassword(dto.newPassword) },
      }),
      this.prisma.userSession.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
    ]);

    return {
      message: 'Password berhasil diubah. Silakan masuk kembali.',
    };
  }

  async listUsers(query: ListUsersQueryDto) {
    const page = parsePositiveNumber(query.page, 1);
    const limit = parsePositiveNumber(query.limit, 10);
    const status = this.parseAccountStatus(query.status);
    const allowedSorts = [
      'name',
      'email',
      'employeeNumber',
      'department',
      'role',
      'accountStatus',
    ] as const;
    type UserSort = (typeof allowedSorts)[number];
    const sort = allowedSorts.includes(query.sort as UserSort)
      ? (query.sort as UserSort)
      : 'name';
    const order = query.order === 'desc' ? 'desc' : 'asc';
    const search = query.search?.trim();
    const department = query.department?.trim();

    const where: Prisma.UserWhereInput = {
      ...(department
        ? { department: { name: department } }
        : {}),
      ...(status ? { accountStatus: status } : {}),
      ...(search
        ? {
            OR: [
              { name: { contains: search } },
              { email: { contains: search } },
            ],
          }
        : {}),
    };
    let orderBy: Prisma.UserOrderByWithRelationInput = { name: order };

    if (sort === 'email') orderBy = { email: order };
    if (sort === 'employeeNumber') orderBy = { employeeNumber: order };
    if (sort === 'department') orderBy = { department: { name: order } };
    if (sort === 'role') orderBy = { role: { name: order } };
    if (sort === 'accountStatus') orderBy = { accountStatus: order };

    const [users, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({
        where,
        include: {
          department: true,
          role: true,
        },
        orderBy,
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.user.count({ where }),
    ]);

    return {
      data: users.map(toUserResponse),
      meta: {
        page,
        limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
    };
  }

  async approveUser(actorUserId: number, userId: number) {
    this.ensureNotSelf(actorUserId, userId);
    const user = await this.findUserWithRelations(userId);

    if (
      user.accountStatus !== AccountStatus.MENUNGGU &&
      user.accountStatus !== AccountStatus.DITOLAK
    ) {
      throw new BadRequestException(
        'Hanya user berstatus MENUNGGU atau DITOLAK yang dapat disetujui.',
      );
    }

    const updatedUser = await this.prisma.user.update({
      where: { id: userId },
      data: { accountStatus: AccountStatus.AKTIF },
      include: {
        department: true,
        role: true,
      },
    });

    return {
      message: 'User berhasil disetujui.',
      user: toUserResponse(updatedUser),
    };
  }

  async suspendUser(actorUserId: number, userId: number) {
    this.ensureNotSelf(actorUserId, userId);
    const user = await this.findUserWithRelations(userId);

    if (user.accountStatus !== AccountStatus.AKTIF) {
      throw new BadRequestException(
        'Hanya user berstatus AKTIF yang dapat ditangguhkan.',
      );
    }

    const updatedUser = await this.prisma.user.update({
      where: { id: userId },
      data: { accountStatus: AccountStatus.DITANGGUHKAN },
      include: {
        department: true,
        role: true,
      },
    });

    await this.prisma.userSession.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    return {
      message: 'User berhasil ditangguhkan.',
      user: toUserResponse(updatedUser),
    };
  }

  async rejectUser(actorUserId: number, userId: number) {
    this.ensureNotSelf(actorUserId, userId);
    const user = await this.findUserWithRelations(userId);

    if (user.accountStatus !== AccountStatus.MENUNGGU) {
      throw new BadRequestException(
        'Hanya user berstatus MENUNGGU yang dapat ditolak.',
      );
    }

    const updatedUser = await this.prisma.user.update({
      where: { id: userId },
      data: { accountStatus: AccountStatus.DITOLAK },
      include: {
        department: true,
        role: true,
      },
    });

    await this.prisma.userSession.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    return {
      message: 'User berhasil ditolak.',
      user: toUserResponse(updatedUser),
    };
  }

  async activateUser(actorUserId: number, userId: number) {
    this.ensureNotSelf(actorUserId, userId);
    const user = await this.findUserWithRelations(userId);

    if (user.accountStatus !== AccountStatus.DITANGGUHKAN) {
      throw new BadRequestException(
        'Hanya user berstatus DITANGGUHKAN yang dapat diaktifkan kembali.',
      );
    }

    const updatedUser = await this.prisma.user.update({
      where: { id: userId },
      data: { accountStatus: AccountStatus.AKTIF },
      include: {
        department: true,
        role: true,
      },
    });

    return {
      message: 'User berhasil diaktifkan kembali.',
      user: toUserResponse(updatedUser),
    };
  }

  private async findUserWithRelations(userId: number) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        department: true,
        role: true,
      },
    });

    if (!user) {
      throw new NotFoundException('User tidak ditemukan.');
    }

    return user;
  }

  private ensureNotSelf(actorUserId: number, targetUserId: number) {
    if (actorUserId === targetUserId) {
      throw new ForbiddenException(
        'HR Manager tidak dapat mengubah status akunnya sendiri.',
      );
    }
  }

  private parseAccountStatus(value?: string) {
    if (!value) return undefined;

    if (!Object.values(AccountStatus).includes(value as AccountStatus)) {
      throw new BadRequestException('Status akun tidak valid.');
    }

    return value as AccountStatus;
  }

}
