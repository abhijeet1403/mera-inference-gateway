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
import { importJWK, jwtVerify, errors as joseErrors } from 'jose';
import type { JWTPayload } from 'jose';
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
  private readonly publicKeyJwk: string;
  private publicKey!: CryptoKey;

  constructor(private configService: ConfigService) {
    this.publicKeyJwk = this.configService.get<string>('JWT_PUBLIC_KEY', '');
    if (!this.publicKeyJwk) {
      throw new Error('JWT_PUBLIC_KEY environment variable is not set');
    }
  }

  async onModuleInit() {
    const jwk = JSON.parse(this.publicKeyJwk) as Record<string, unknown>;
    this.publicKey = (await importJWK(jwk, 'EdDSA')) as CryptoKey;
    this.logger.log('JWT public key loaded (Ed25519)');
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();

    const token = this.extractBearerToken(request);
    if (!token) {
      throw new UnauthorizedException('Authentication required');
    }

    try {
      const { payload } = await jwtVerify(token, this.publicKey, {
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
