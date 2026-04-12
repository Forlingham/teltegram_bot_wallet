import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { RequestWithUser } from './types/request-with-user.type';
import { AUTH_SESSION_HEADER } from './auth.constants';
import { AuthService } from './auth.service';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(@Inject(AuthService) private readonly authService: AuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<RequestWithUser>();
    const token = request.headers[AUTH_SESSION_HEADER] as string | undefined;

    if (!token) {
      throw new UnauthorizedException('Session token required');
    }

    const identity = await this.authService.validateSessionToken(token);
    request.user = {
      userId: identity.userId,
      telegramId: identity.telegramId,
      sessionToken: token,
    };

    return true;
  }
}
