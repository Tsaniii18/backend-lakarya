import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PrismaModule } from '../prisma/prisma.module';
import { ApprovalController, ManageRequestsController } from './approval.controller';
import { ApprovalService } from './approval.service';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [ApprovalController, ManageRequestsController],
  providers: [ApprovalService],
  exports: [ApprovalService],
})
export class ApprovalModule {}
