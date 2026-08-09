import { ApiPropertyOptional } from '@nestjs/swagger';

export class ListUsersQueryDto {
  @ApiPropertyOptional({ example: 1 })
  page?: string;

  @ApiPropertyOptional({ example: 10 })
  limit?: string;

  @ApiPropertyOptional({ example: 'Human Resources' })
  department?: string;

  @ApiPropertyOptional({ example: 'MENUNGGU' })
  status?: string;

  @ApiPropertyOptional({ example: 'tsani' })
  search?: string;

  @ApiPropertyOptional({
    enum: [
      'name',
      'email',
      'employeeNumber',
      'department',
      'role',
      'accountStatus',
    ],
  })
  sort?: string;

  @ApiPropertyOptional({ enum: ['asc', 'desc'] })
  order?: string;
}
