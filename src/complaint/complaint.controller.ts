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
import { ComplaintService } from './complaint.service';
import { CreateComplaintDto } from './dto/create-complaint.dto';
import { ListComplaintsQueryDto } from './dto/list-complaints-query.dto';
import { ManageComplaintsQueryDto } from './dto/manage-complaints-query.dto';
import { UpdateComplaintDto } from './dto/update-complaint.dto';

@ApiTags('Complaints')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('complaints')
export class ComplaintController {
  constructor(private readonly complaintService: ComplaintService) {}

  @Post()
  create(
    @Req() request: AuthenticatedRequest,
    @Body() dto: CreateComplaintDto,
  ) {
    return this.complaintService.create(request.user.id, dto);
  }

  @Get()
  list(
    @Req() request: AuthenticatedRequest,
    @Query() query: ListComplaintsQueryDto,
  ) {
    return this.complaintService.listOwn(request.user.id, query);
  }

  @Get(':id')
  getDetail(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.complaintService.getOwn(request.user.id, id);
  }

  @Patch(':id/reopen')
  reopen(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.complaintService.reopen(request.user.id, id);
  }
}

@ApiTags('Manage Complaints')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('manage/complaints')
export class ManageComplaintsController {
  constructor(private readonly complaintService: ComplaintService) {}

  @Get()
  list(
    @Req() request: AuthenticatedRequest,
    @Query() query: ManageComplaintsQueryDto,
  ) {
    return this.complaintService.listManaged(request.user.id, query);
  }

  @Get(':id')
  getDetail(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.complaintService.getManaged(request.user.id, id);
  }

  @Patch(':id')
  update(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateComplaintDto,
  ) {
    return this.complaintService.updateManaged(request.user.id, id, dto);
  }
}
