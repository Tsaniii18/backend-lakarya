import {
  Controller,
  Get,
  Header,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { PrismaService } from '../prisma/prisma.service';

@ApiTags('Health')
@Controller('health')
export class HealthController {
  private readonly logger = new Logger(HealthController.name);

  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @Header('Cache-Control', 'no-store')
  async check() {
    try {
      await this.prisma.$queryRaw`SELECT 1`;

      return {
        status: 'ok',
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      const databaseError = error as Error & {
        code?: string;
        meta?: {
          driverAdapterError?: {
            cause?: unknown;
          };
        };
      };

      this.logger.error(
        `Database health check failed: ${JSON.stringify({
          name: databaseError.name,
          code: databaseError.code,
          message: databaseError.message,
          cause: databaseError.meta?.driverAdapterError?.cause,
        })}`,
      );

      throw new ServiceUnavailableException('Layanan belum siap.');
    }
  }
}
