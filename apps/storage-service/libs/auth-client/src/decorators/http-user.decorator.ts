import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export const HttpUser = createParamDecorator(
  (data: string, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const user = request?.auth;
    if (!user) return undefined;
    return data ? user[data] : user;
  },
);
