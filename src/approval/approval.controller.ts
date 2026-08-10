import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuthenticatedRequest } from '../auth/auth.types';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ApprovalService } from './approval.service';
import { ListApprovalsQueryDto } from './dto/list-approvals-query.dto';
import { ManageRequestsQueryDto } from './dto/manage-requests-query.dto';
import { ReviewApprovalDto } from './dto/review-approval.dto';

@ApiTags('Approvals')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('approvals')
export class ApprovalController {
  constructor(private readonly approvalService: ApprovalService) {}

  @Get()
  list(
    @Req() request: AuthenticatedRequest,
    @Query() query: ListApprovalsQueryDto,
  ) {
    return this.approvalService.listInbox(request.user.id, query);
  }

  @Get(':id')
  getDetail(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.approvalService.getInboxDetail(request.user.id, id);
  }

  @Patch(':id/approve')
  approve(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ReviewApprovalDto,
  ) {
    return this.approvalService.approve(request.user.id, id, dto);
  }

  @Patch(':id/reject')
  reject(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ReviewApprovalDto,
  ) {
    return this.approvalService.reject(request.user.id, id, dto);
  }
}

@ApiTags('Manage Requests')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('manage/requests')
export class ManageRequestsController {
  constructor(private readonly approvalService: ApprovalService) {}

  @Get()
  list(
    @Req() request: AuthenticatedRequest,
    @Query() query: ManageRequestsQueryDto,
  ) {
    return this.approvalService.listManagedRequests(request.user.id, query);
  }

  @Get(':id')
  getDetail(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.approvalService.getManagedRequest(request.user.id, id);
  }
}
