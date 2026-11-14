import { can, type Access, type Actor, type Area } from '@knazawy/shared';
import { ForbiddenException } from '@nestjs/common';

export function assertCan(actor: Actor, area: Area, access: Access, action: string): void {
  if (!can(actor.role, area, access)) {
    throw new ForbiddenException(`You cannot ${action}.`);
  }
}
