import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { CloudflareR2Service } from '../common/integrations/cloudflare-r2.service';
import { PrismaModule } from '../prisma/prisma.module';
import {
  AttachmentController,
  ComplaintAttachmentController,
} from './attachment.controller';
import { AttachmentService } from './attachment.service';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [AttachmentController, ComplaintAttachmentController],
  providers: [AttachmentService, CloudflareR2Service],
})
export class AttachmentModule {}
