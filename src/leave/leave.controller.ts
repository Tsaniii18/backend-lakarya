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
import { CreateLeaveDto } from './dto/create-leave.dto';
import { ListRequestsQueryDto } from './dto/list-requests-query.dto';
import { LeaveService } from './leave.service';

@ApiTags('Leave')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('leave')
export class LeaveController {
  constructor(private readonly leaveService: LeaveService) {}

  @Get('balance')
  getBalance(
    @Req() request: AuthenticatedRequest,
    @Query('year') year?: string,
  ) {
    return this.leaveService.getBalance(request.user.id, year);
  }

  @Post()
  create(
    @Req() request: AuthenticatedRequest,
    @Body() dto: CreateLeaveDto,
  ) {
    return this.leaveService.create(request.user.id, dto);
  }

  @Get()
  list(
    @Req() request: AuthenticatedRequest,
    @Query() query: ListRequestsQueryDto,
  ) {
    return this.leaveService.listOwnLeaveRequests(request.user.id, query);
  }

  @Get(':id')
  getDetail(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.leaveService.getOwnLeaveRequest(request.user.id, id);
  }

  @Patch(':id/cancel')
  cancel(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.leaveService.cancel(request.user.id, id);
  }
}

@ApiTags('Requests')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('requests')
export class RequestsController {
  constructor(private readonly leaveService: LeaveService) {}

  @Get()
  list(
    @Req() request: AuthenticatedRequest,
    @Query() query: ListRequestsQueryDto,
  ) {
    return this.leaveService.listOwnRequests(request.user.id, query);
  }
}
