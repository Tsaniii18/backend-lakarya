import { Module } from '@nestjs/common';
import { ApprovalModule } from '../approval/approval.module';
import { AuthModule } from '../auth/auth.module';
import { PrismaModule } from '../prisma/prisma.module';
import { LeaveBalanceService } from './leave-balance.service';
import { LeaveController, RequestsController } from './leave.controller';
import { LeaveService } from './leave.service';

@Module({
  imports: [PrismaModule, AuthModule, ApprovalModule],
  controllers: [LeaveController, RequestsController],
  providers: [LeaveService, LeaveBalanceService],
  exports: [LeaveBalanceService],
})
export class LeaveModule {}
