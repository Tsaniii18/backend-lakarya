import { createHash } from 'node:crypto';
import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AccountStatus } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuthenticatedRequest, AuthenticatedUser } from './auth.types';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const token = this.extractToken(request.headers.authorization);
    const secret = process.env.JWT_SECRET;

    if (!token || !secret) {
      throw new UnauthorizedException('Sesi tidak valid.');
    }

    try {
      const payload = await this.jwtService.verifyAsync<{
        sub: number;
        email: string;
      }>(token, { secret });
      const tokenHash = createHash('sha256').update(token).digest('hex');
      const session = await this.prisma.userSession.findFirst({
        where: {
          userId: payload.sub,
          tokenHash,
          revokedAt: null,
        },
        include: { user: true },
      });

      if (!session || session.user.accountStatus !== AccountStatus.AKTIF) {
        throw new UnauthorizedException('Sesi tidak valid.');
      }

      const user: AuthenticatedUser = {
        id: payload.sub,
        email: payload.email,
      };
      request.user = user;
      request.authToken = token;

      return true;
    } catch {
      throw new UnauthorizedException('Sesi tidak valid atau telah berakhir.');
    }
  }

  private extractToken(authorization?: string | string[]) {
    if (!authorization || Array.isArray(authorization)) return undefined;

    const [type, token] = authorization.split(' ');
    return type === 'Bearer' ? token : undefined;
  }
}
