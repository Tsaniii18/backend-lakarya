import { Module } from '@nestjs/common';
import { AttachmentModule } from './attachment/attachment.module';
import { ApprovalModule } from './approval/approval.module';
import { AuthModule } from './auth/auth.module';
import { LeaveModule } from './leave/leave.module';
import { PermissionModule } from './permission/permission.module';
import { PrismaModule } from './prisma/prisma.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    UsersModule,
    LeaveModule,
    PermissionModule,
    AttachmentModule,
    ApprovalModule,
  ],
})
export class AppModule {}
