import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';
import * as jwt from 'jsonwebtoken';

export interface AuthenticatedUser {
  id: string;
  email: string;
  name?: string;
}

export interface AuthenticatedRequest extends Request {
  user: AuthenticatedUser;
}

interface JwtUserPayload extends jwt.JwtPayload {
  id?: string;
  email?: string;
  name?: string;
}

@Injectable()
export class AuthGuard implements CanActivate {
  private readonly logger = new Logger('AuthGuard');
  private readonly secret: string;

  constructor(private configService: ConfigService) {
    this.secret = this.configService.get<string>('BETTER_AUTH_SECRET', '');
    if (!this.secret) {
      throw new Error('BETTER_AUTH_SECRET environment variable is not set');
    }
  }

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();

    const token = this.extractBearerToken(request);
    if (!token) {
      throw new UnauthorizedException('Authentication required');
    }

    try {
      const payload = jwt.verify(token, this.secret) as JwtUserPayload;

      request.user = {
        id: payload.sub ?? payload.id ?? '',
        email: payload.email ?? '',
        name: payload.name,
      };

      return true;
    } catch (error: unknown) {
      if (
        error instanceof jwt.JsonWebTokenError ||
        error instanceof jwt.TokenExpiredError
      ) {
        throw new UnauthorizedException('Invalid or expired token');
      }
      this.logger.error(
        { err: error instanceof Error ? error.message : String(error) },
        'Unexpected authentication error',
      );
      throw new UnauthorizedException('Authentication failed');
    }
  }

  private extractBearerToken(request: Request): string | null {
    const authHeader = request.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return null;
    }
    return authHeader.slice(7);
  }
}
