import { Module } from '@nestjs/common';
import { AttachmentModule } from './attachment/attachment.module';
import { ApprovalModule } from './approval/approval.module';
import { AuthModule } from './auth/auth.module';
import { ComplaintModule } from './complaint/complaint.module';
import { LeaveModule } from './leave/leave.module';
import { PermissionModule } from './permission/permission.module';
import { PrismaModule } from './prisma/prisma.module';
import { ReimbursementModule } from './reimbursement/reimbursement.module';
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
    ReimbursementModule,
    ComplaintModule,
  ],
})
export class AppModule {}
