import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Ip,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { AuthenticatedRequest } from './auth.types';
import { DemoLoginDto } from './dto/demo-login.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { JwtAuthGuard } from './jwt-auth.guard';

@ApiTags('Authentication')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  login(
    @Body() dto: LoginDto,
    @Ip() ip: string,
    @Headers('user-agent') agent?: string,
    @Headers('sec-ch-ua-platform') device?: string,
  ) {
    return this.authService.login(dto, { ip, agent, device });
  }

  @Get('demo')
  getDemoAccess() {
    return this.authService.getDemoAccess();
  }

  @Post('demo-login')
  @HttpCode(HttpStatus.OK)
  demoLogin(
    @Body() dto: DemoLoginDto,
    @Ip() ip: string,
    @Headers('user-agent') agent?: string,
    @Headers('sec-ch-ua-platform') device?: string,
  ) {
    return this.authService.demoLogin(dto, { ip, agent, device });
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  logout(@Req() request: AuthenticatedRequest) {
    return this.authService.logout(request.user.id, request.authToken);
  }

  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.authService.forgotPassword(dto);
  }

  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto);
  }
}
