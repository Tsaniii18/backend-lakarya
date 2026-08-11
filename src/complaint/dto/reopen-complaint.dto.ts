import { ApiProperty } from '@nestjs/swagger';

export class ReopenComplaintDto {
  @ApiProperty({ example: 'Masalah masih terjadi setelah penanganan.' })
  note!: string;
}
