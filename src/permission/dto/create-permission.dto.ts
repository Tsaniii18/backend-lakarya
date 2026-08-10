import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PermissionType } from '../../generated/prisma/client';

export class CreatePermissionDto {
  @ApiProperty({ enum: PermissionType, example: PermissionType.HARIAN })
  permissionType!: string;

  @ApiProperty({ example: '2026-08-12' })
  startDate!: string;

  @ApiProperty({ example: '2026-08-13' })
  endDate!: string;

  @ApiPropertyOptional({ example: '09:00' })
  startTime?: string;

  @ApiPropertyOptional({ example: '11:00' })
  endTime?: string;

  @ApiProperty({ example: 'Keperluan pribadi' })
  reason!: string;
}
