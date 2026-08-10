import { ApiProperty } from '@nestjs/swagger';
import { ExpenseType } from '../../generated/prisma/client';

export class CreateReimbursementDto {
  @ApiProperty({ enum: ExpenseType, example: ExpenseType.TRANSPORTASI })
  expenseType!: string;

  @ApiProperty({ example: '2026-08-10' })
  expenseDate!: string;

  @ApiProperty({ example: 150000 })
  expenseAmount!: number;

  @ApiProperty({ example: 'Biaya transportasi kunjungan klien' })
  description!: string;
}
