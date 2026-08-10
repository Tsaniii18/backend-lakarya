import { ApiPropertyOptional } from '@nestjs/swagger';

export class ReviewApprovalDto {
  @ApiPropertyOptional({ example: 'Pengajuan sudah sesuai.' })
  reviewNote?: string;
}
