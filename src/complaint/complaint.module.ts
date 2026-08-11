import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PrismaModule } from '../prisma/prisma.module';
import {
  ComplaintController,
  ManageComplaintsController,
} from './complaint.controller';
import { ComplaintService } from './complaint.service';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [ComplaintController, ManageComplaintsController],
  providers: [ComplaintService],
})
export class ComplaintModule {}
