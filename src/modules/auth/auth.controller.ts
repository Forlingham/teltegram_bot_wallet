import { Body, Controller, Get, Headers, Inject, Post, UseGuards } from '@nestjs/common';
import { AUTH_SESSION_HEADER } from './auth.constants';
import { TelegramLoginDto } from './dto/telegram-login.dto';
import { AuthService } from './auth.service';
import { AuthGuard } from './auth.guard';
import { CurrentUser } from './auth.decorator';
import { AuthenticatedUser } from './types/request-with-user.type';

@Controller('api/auth')
export class AuthController {
  constructor(@Inject(AuthService) private readonly authService: AuthService) {}

  @Post('telegram/login')
  login(@Body() body: TelegramLoginDto) {
    return this.authService.loginWithTelegram(body.initData);
  }

  @Post('logout')
  async logout(@Headers(AUTH_SESSION_HEADER) token?: string): Promise<{ revoked: boolean }> {
    if (token) {
      await this.authService.revokeSession(token);
    }

    return { revoked: true };
  }

  @Get('me')
  @UseGuards(AuthGuard)
  async me(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{
    userId: number;
    telegramId: string;
    username: string | null;
    firstName: string | null;
    lastName: string | null;
    photoUrl: string | null;
  }> {
    const profile = await this.authService.getProfileById(user.userId);

    return {
      userId: user.userId,
      telegramId: user.telegramId,
      username: profile.username,
      firstName: profile.firstName,
      lastName: profile.lastName,
      photoUrl: profile.photoUrl,
    };
  }
}
