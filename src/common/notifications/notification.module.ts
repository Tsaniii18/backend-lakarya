import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { ResendService } from '../integrations/resend.service';
import { NotificationService } from './notification.service';

@Module({
  imports: [PrismaModule],
  providers: [NotificationService, ResendService],
  exports: [NotificationService],
})
export class NotificationModule {}
