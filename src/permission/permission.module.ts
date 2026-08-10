import { Module } from '@nestjs/common';
import { ApprovalModule } from '../approval/approval.module';
import { AuthModule } from '../auth/auth.module';
import { PrismaModule } from '../prisma/prisma.module';
import { PermissionController } from './permission.controller';
import { PermissionService } from './permission.service';

@Module({
  imports: [PrismaModule, AuthModule, ApprovalModule],
  controllers: [PermissionController],
  providers: [PermissionService],
})
export class PermissionModule {}
