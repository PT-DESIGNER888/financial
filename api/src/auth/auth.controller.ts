import { Body, Controller, Post, Req } from '@nestjs/common';
import type { Request } from 'express';
import { IsNotEmpty, IsString } from 'class-validator';
import { AuthService } from './auth.service';
import { Public } from './jwt-auth.guard';

class LoginDto {
  @IsString() @IsNotEmpty() username: string;
  @IsString() @IsNotEmpty() password: string;
}

class RefreshDto {
  @IsString() @IsNotEmpty() refreshToken: string;
}

class ChangePasswordDto {
  @IsString() @IsNotEmpty() currentPassword: string;
  @IsString() @IsNotEmpty() newPassword: string;
}

@Controller('auth')
export class AuthController {
  constructor(private auth: AuthService) {}

  @Public()
  @Post('login')
  login(@Body() dto: LoginDto) {
    return this.auth.login(dto.username, dto.password);
  }

  @Public()
  @Post('refresh')
  refresh(@Body() dto: RefreshDto) {
    return this.auth.refresh(dto.refreshToken);
  }

  @Post('change-password')
  changePassword(
    @Req() req: Request & { user: { sub: string } },
    @Body() dto: ChangePasswordDto,
  ) {
    return this.auth.changePassword(
      req.user.sub,
      dto.currentPassword,
      dto.newPassword,
    );
  }
}
