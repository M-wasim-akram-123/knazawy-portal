import { ConflictException } from '@nestjs/common';

import { lockRequestStatus } from './row-lock';

describe('lockRequestStatus', () => {
  it('locks the row, then goes ahead when the status is unchanged', async () => {
    const tx = {
      $executeRaw: jest.fn().mockResolvedValue(1),
      serviceRequest: { findUnique: jest.fn().mockResolvedValue({ status: 'ACCEPTED' }) },
    };
    await expect(lockRequestStatus(tx as never, 'rq-1', 'ACCEPTED')).resolves.toBeUndefined();
    expect(tx.$executeRaw).toHaveBeenCalled();
  });

  it('stops when someone else moved the request meanwhile', async () => {
    const tx = {
      $executeRaw: jest.fn().mockResolvedValue(1),
      serviceRequest: { findUnique: jest.fn().mockResolvedValue({ status: 'CANCELLED' }) },
    };
    await expect(lockRequestStatus(tx as never, 'rq-1', 'ACCEPTED')).rejects.toBeInstanceOf(
      ConflictException,
    );
  });
});
