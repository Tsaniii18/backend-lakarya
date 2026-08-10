import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { CloudflareR2Service } from '../common/integrations/cloudflare-r2.service';
import { PrismaModule } from '../prisma/prisma.module';
import { AttachmentController } from './attachment.controller';
import { AttachmentService } from './attachment.service';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [AttachmentController],
  providers: [AttachmentService, CloudflareR2Service],
})
export class AttachmentModule {}
