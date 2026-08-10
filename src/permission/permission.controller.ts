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
import { CreatePermissionDto } from './dto/create-permission.dto';
import { PermissionService } from './permission.service';

@ApiTags('Permission')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('permission')
export class PermissionController {
  constructor(private readonly permissionService: PermissionService) {}

  @Post()
  create(
    @Req() request: AuthenticatedRequest,
    @Body() dto: CreatePermissionDto,
  ) {
    return this.permissionService.create(request.user.id, dto);
  }

  @Get()
  list(
    @Req() request: AuthenticatedRequest,
    @Query() query: ListRequestsQueryDto,
  ) {
    return this.permissionService.listOwnPermissionRequests(
      request.user.id,
      query,
    );
  }

  @Get(':id')
  getDetail(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.permissionService.getOwnPermissionRequest(request.user.id, id);
  }

  @Patch(':id/cancel')
  cancel(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.permissionService.cancel(request.user.id, id);
  }
}
