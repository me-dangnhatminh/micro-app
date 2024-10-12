import {
  Controller,
  Get,
  Headers,
  Inject,
  Res,
  UnauthorizedException,
  UseInterceptors,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import { ConfigService } from 'src/config';

import { CacheKey, CacheTTL } from '../adapters';
import {
  BearerTokenCacheInterceptor,
  AuthResponseInterceptor,
} from '../interceptors';

@Controller({ path: 'auth', version: '1' })
@ApiTags('auth')
@ApiBearerAuth()
export class AuthRestController {
  constructor(
    private readonly configService: ConfigService,
    @Inject('AuthService') private readonly authService,
  ) {}

  @Get('validate')
  @UseInterceptors(AuthResponseInterceptor, BearerTokenCacheInterceptor)
  @CacheKey('auth:validate')
  @CacheTTL(60 * 60 * 1000) // 1 hour
  async validate(
    @Res({ passthrough: true }) res: Response,
    @Headers('authorization') authorization?: string,
    @Headers('x-auth-strict') strict?: string,
  ) {
    try {
      if (!authorization && strict === 'true') {
        const message = `Missing 'Authorization' header`;
        throw new UnauthorizedException({ type: 'invalid_request', message });
      }

      if (!authorization) {
        const message = `Missing 'Authorization' header`;
        throw new UnauthorizedException({ type: 'invalid_request', message });
      }

      const [type, token] = authorization.split(' ');

      if (type !== 'Bearer') {
        const message = 'Invalid token type';
        throw new UnauthorizedException({ type: 'invalid_request', message });
      }

      // handle 'Bearer' token
      if (!token) {
        const message = 'Missing token';
        throw new UnauthorizedException({ type: 'invalid_request', message });
      }

      const user = await this.authService
        .verifyToken({ token })
        .toPromise()
        .catch((err) => {
          const message = err.message;
          throw new UnauthorizedException({ type: 'unknown', message });
        });

      return user;
    } catch (err) {
      // TODO: move to ExceptionFilter
      if (err instanceof UnauthorizedException) {
        const msg = err.message;
        res.setHeader('Access-Control-Expose-Headers', 'WWW-Authenticate');
        res.setHeader(
          'WWW-Authenticate',
          `Bearer realm="auth", error_description="${msg}"`,
        );
      }
      throw err;
    }
  }
}
