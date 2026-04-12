import { Request } from 'express';

export interface AuthenticatedUser {
  userId: number;
  telegramId: string;
  sessionToken: string;
}

export interface RequestWithUser extends Request {
  user: AuthenticatedUser;
}
