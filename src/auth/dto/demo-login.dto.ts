import { ApiProperty } from '@nestjs/swagger';
import { DemoPersona } from '../../common/demo-accounts';

export class DemoLoginDto {
  @ApiProperty({
    enum: [
      'HR_MANAGER',
      'FINANCE_MANAGER',
      'IT_MANAGER',
      'MARKETING_MANAGER',
      'IT_STAFF',
    ],
    example: 'HR_MANAGER',
  })
  persona!: DemoPersona;
}
