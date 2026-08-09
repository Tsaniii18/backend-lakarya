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
import { ChangePasswordDto } from './dto/change-password.dto';
import { ListUsersQueryDto } from './dto/list-users-query.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { HrManagerGuard } from './hr-manager.guard';
import { UsersService } from './users.service';

@ApiTags('Users')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('profile')
  getProfile(@Req() request: AuthenticatedRequest) {
    return this.usersService.getProfile(request.user.id);
  }

  @Patch('profile')
  updateProfile(
    @Req() request: AuthenticatedRequest,
    @Body() dto: UpdateProfileDto,
  ) {
    return this.usersService.updateProfile(request.user.id, dto);
  }

  @Patch('profile/password')
  changePassword(
    @Req() request: AuthenticatedRequest,
    @Body() dto: ChangePasswordDto,
  ) {
    return this.usersService.changePassword(request.user.id, dto);
  }

  @Get()
  @UseGuards(HrManagerGuard)
  listUsers(@Query() query: ListUsersQueryDto) {
    return this.usersService.listUsers(query);
  }

  @Patch(':id/approve')
  @UseGuards(HrManagerGuard)
  approveUser(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.usersService.approveUser(request.user.id, id);
  }

  @Patch(':id/suspend')
  @UseGuards(HrManagerGuard)
  suspendUser(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.usersService.suspendUser(request.user.id, id);
  }

  @Patch(':id/reject')
  @UseGuards(HrManagerGuard)
  rejectUser(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.usersService.rejectUser(request.user.id, id);
  }

  @Patch(':id/activate')
  @UseGuards(HrManagerGuard)
  activateUser(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.usersService.activateUser(request.user.id, id);
  }
}
