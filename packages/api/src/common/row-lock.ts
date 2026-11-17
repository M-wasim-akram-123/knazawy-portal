import { ConflictException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';

/**
 * Row locks for checks that must hold until the transaction commits. Each takes
 * SELECT ... FOR UPDATE, so a second transaction on the same row waits for the first to finish
 * and then sees its result.
 */

/**
 * Locks a service request and confirms it is still in the status the caller read before the
 * transaction. If someone else moved it meanwhile (an airline amending while staff start the
 * delivery, say), the caller stops instead of acting on a stale status.
 */
export async function lockRequestStatus(
  tx: Prisma.TransactionClient,
  requestId: string,
  expected: string,
): Promise<void> {
  await tx.$executeRaw`SELECT 1 FROM service_requests WHERE id = ${requestId} FOR UPDATE`;
  const row = await tx.serviceRequest.findUnique({
    where: { id: requestId },
    select: { status: true },
  });
  if (row?.status !== expected) {
    throw new ConflictException('This request was just changed. Reload it and try again.');
  }
}

/** Locks an invoice, so it cannot be issued or credited twice at once. */
export async function lockInvoice(tx: Prisma.TransactionClient, invoiceId: string): Promise<void> {
  await tx.$executeRaw`SELECT 1 FROM invoices WHERE id = ${invoiceId} FOR UPDATE`;
}

/** Locks a service request without checking its status. */
export async function lockRequest(tx: Prisma.TransactionClient, requestId: string): Promise<void> {
  await tx.$executeRaw`SELECT 1 FROM service_requests WHERE id = ${requestId} FOR UPDATE`;
}

/** Locks an organisation, so per-airline checks (such as overlapping rate cards) run one at a time. */
export async function lockOrganisation(
  tx: Prisma.TransactionClient,
  organisationId: string,
): Promise<void> {
  await tx.$executeRaw`SELECT 1 FROM organisations WHERE id = ${organisationId} FOR UPDATE`;
}

/** The room-request version of lockRequestStatus. */
export async function lockRoomRequestStatus(
  tx: Prisma.TransactionClient,
  roomRequestId: string,
  expected: string,
): Promise<void> {
  await tx.$executeRaw`SELECT 1 FROM room_requests WHERE id = ${roomRequestId} FOR UPDATE`;
  const row = await tx.roomRequest.findFirst({
    where: { id: roomRequestId },
    select: { status: true },
  });
  if (row?.status !== expected) {
    throw new ConflictException('This room request was just changed. Reload it and try again.');
  }
}
