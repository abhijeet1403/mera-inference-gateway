import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Logger,
  OnModuleInit,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';
import { createRemoteJWKSet, jwtVerify, errors as joseErrors } from 'jose';
import type { JWTPayload, JWTVerifyGetKey } from 'jose';
import { JWT_ISSUER } from '../constants';

export interface AuthenticatedUser {
  id: string;
  subscriptionIsActive: boolean;
}

export interface AuthenticatedRequest extends Request {
  user: AuthenticatedUser;
}

interface MeraJwtPayload extends JWTPayload {
  userId?: string;
  subscriptionIsActive?: boolean;
}

@Injectable()
export class AuthGuard implements CanActivate, OnModuleInit {
  private readonly logger = new Logger('AuthGuard');
  private jwks!: JWTVerifyGetKey;

  constructor(private configService: ConfigService) {}

  onModuleInit() {
    const authJwksUrl = this.configService.get<string>('AUTH_JWKS_URL', '');
    if (!authJwksUrl) {
      throw new Error('AUTH_JWKS_URL environment variable is not set');
    }

    const jwksUrl = new URL(authJwksUrl);
    this.jwks = createRemoteJWKSet(jwksUrl);

    void this.verifyJwksReachability(jwksUrl, authJwksUrl);
  }

  private async verifyJwksReachability(
    jwksUrl: URL,
    authJwksUrl: string,
  ): Promise<void> {
    const maxElapsedMs = 10 * 60 * 1000;
    const start = Date.now();
    let delayMs = 1000;

    while (true) {
      try {
        const res = await fetch(jwksUrl);
        if (!res.ok) throw new Error(`JWKS endpoint returned ${res.status}`);
        this.logger.log(`JWKS endpoint verified: ${authJwksUrl}`);
        return;
      } catch (error) {
        const elapsed = Date.now() - start;
        if (elapsed + delayMs > maxElapsedMs) {
          this.logger.error(
            `JWKS endpoint ${authJwksUrl} unreachable after ${Math.round(elapsed / 1000)}s — giving up background verification: ${error instanceof Error ? error.message : String(error)}`,
          );
          return;
        }
        this.logger.warn(
          `JWKS endpoint unreachable, retrying in ${delayMs / 1000}s...`,
        );
        await new Promise((resolve) => setTimeout(resolve, delayMs));
        delayMs = Math.min(delayMs * 2, 30000);
      }
    }
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();

    const token = this.extractBearerToken(request);
    if (!token) {
      throw new UnauthorizedException('Authentication required');
    }

    try {
      const { payload } = await jwtVerify(token, this.jwks, {
        issuer: JWT_ISSUER,
      });

      const jwtPayload = payload as MeraJwtPayload;

      request.user = {
        id: jwtPayload.sub ?? jwtPayload.userId ?? '',
        subscriptionIsActive: jwtPayload.subscriptionIsActive === true,
      };

      return true;
    } catch (error: unknown) {
      if (
        error instanceof joseErrors.JWTExpired ||
        error instanceof joseErrors.JWSSignatureVerificationFailed ||
        error instanceof joseErrors.JWTClaimValidationFailed
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
