import { workingBranchError, type Actor } from '@knazawy/shared';
import { BadRequestException } from '@nestjs/common';

/** The branch a Karam user is working in. Stock and purchases stay inside it. */
export function requireBranch(actor: Actor): string {
  const problem = workingBranchError(actor.branchId);
  if (problem) throw new BadRequestException(problem);
  return actor.branchId ?? '';
}
