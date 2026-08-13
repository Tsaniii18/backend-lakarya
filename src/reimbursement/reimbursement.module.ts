import { Module } from '@nestjs/common';
import { ApprovalModule } from '../approval/approval.module';
import { AuthModule } from '../auth/auth.module';
import { NotificationModule } from '../common/notifications/notification.module';
import { PrismaModule } from '../prisma/prisma.module';
import {
  ManageReimbursementsController,
  ReimbursementController,
} from './reimbursement.controller';
import { ReimbursementService } from './reimbursement.service';

@Module({
  imports: [PrismaModule, AuthModule, ApprovalModule, NotificationModule],
  controllers: [ReimbursementController, ManageReimbursementsController],
  providers: [ReimbursementService],
})
export class ReimbursementModule {}
