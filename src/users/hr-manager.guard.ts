import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { RoleName } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuthenticatedRequest } from '../auth/auth.types';

@Injectable()
export class HrManagerGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const user = await this.prisma.user.findUnique({
      where: { id: request.user.id },
      include: {
        role: true,
        department: true,
      },
    });

    const isHrManager =
      user?.role.name === RoleName.MANAJER &&
      user.department.name === 'Human Resources';

    if (!isHrManager) {
      throw new ForbiddenException(
        'Hanya HR Manager yang dapat mengakses user management.',
      );
    }

    return true;
  }
}
