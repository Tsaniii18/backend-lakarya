import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuthenticatedRequest } from '../auth/auth.types';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ListRequestsQueryDto } from '../leave/dto/list-requests-query.dto';
import { CreateReimbursementDto } from './dto/create-reimbursement.dto';
import { ManageReimbursementsQueryDto } from './dto/manage-reimbursements-query.dto';
import { ReimbursementService } from './reimbursement.service';

@ApiTags('Reimbursement')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('reimbursements')
export class ReimbursementController {
  constructor(private readonly reimbursementService: ReimbursementService) {}

  @Post()
  create(
    @Req() request: AuthenticatedRequest,
    @Body() dto: CreateReimbursementDto,
  ) {
    return this.reimbursementService.create(request.user.id, dto);
  }

  @Get()
  list(
    @Req() request: AuthenticatedRequest,
    @Query() query: ListRequestsQueryDto,
  ) {
    return this.reimbursementService.listOwn(request.user.id, query);
  }

  @Get(':id')
  getDetail(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.reimbursementService.getOwn(request.user.id, id);
  }

  @Patch(':id/cancel')
  cancel(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.reimbursementService.cancel(request.user.id, id);
  }
}

@ApiTags('Manage Reimbursements')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('manage/reimbursements')
export class ManageReimbursementsController {
  constructor(private readonly reimbursementService: ReimbursementService) {}

  @Get()
  list(
    @Req() request: AuthenticatedRequest,
    @Query() query: ManageReimbursementsQueryDto,
  ) {
    return this.reimbursementService.listManaged(request.user.id, query);
  }

  @Get(':id')
  getDetail(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.reimbursementService.getManaged(request.user.id, id);
  }
}
