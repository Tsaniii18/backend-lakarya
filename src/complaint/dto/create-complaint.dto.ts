import { ApiProperty } from '@nestjs/swagger';
import { ComplaintCategory } from '../../generated/prisma/client';

export class CreateComplaintDto {
  @ApiProperty({ example: 'Fasilitas ruang kerja rusak' })
  subject!: string;

  @ApiProperty({ enum: ComplaintCategory, example: ComplaintCategory.FASILITAS })
  category!: string;

  @ApiProperty({ example: 'Pendingin ruangan tidak berfungsi sejak kemarin.' })
  description!: string;
}
