import { ApiProperty } from '@nestjs/swagger';
import { LeaveType } from '../../generated/prisma/client';

export class CreateLeaveDto {
  @ApiProperty({ enum: LeaveType, example: LeaveType.TAHUNAN })
  leaveType!: string;

  @ApiProperty({ example: '2026-08-12' })
  startDate!: string;

  @ApiProperty({ example: '2026-08-13' })
  endDate!: string;

  @ApiProperty({ example: 'Keperluan keluarga' })
  reason!: string;
}
