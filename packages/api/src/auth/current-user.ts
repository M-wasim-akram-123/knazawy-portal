import type { Actor } from '@knazawy/shared';
import { createParamDecorator, type ExecutionContext } from '@nestjs/common';

export const CurrentUser = createParamDecorator((_data: unknown, context: ExecutionContext): Actor => {
  const request = context.switchToHttp().getRequest<{ user: Actor }>();
  return request.user;
});
