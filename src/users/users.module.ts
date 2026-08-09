import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { HrManagerGuard } from './hr-manager.guard';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { CloudflareR2Service } from '../common/integrations/cloudflare-r2.service';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [UsersController],
  providers: [UsersService, HrManagerGuard, CloudflareR2Service],
})
export class UsersModule {}
