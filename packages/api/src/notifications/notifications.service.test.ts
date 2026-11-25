import { NotificationsService } from './notifications.service';

describe('NotificationsService', () => {
  it('counts unread notifications only for the current user', async () => {
    const count = jest.fn().mockResolvedValue(4);
    const service = new NotificationsService({ notification: { count } } as never);

    await expect(service.unreadCount({ id: 'user-1' } as never)).resolves.toBe(4);
    expect(count).toHaveBeenCalledWith({
      where: { userId: 'user-1', readAt: null },
    });
  });

  it('marks only the current user unread notifications as read', async () => {
    const updateMany = jest.fn().mockResolvedValue({ count: 2 });
    const service = new NotificationsService({ notification: { updateMany } } as never);

    const result = await service.markAllRead({ id: 'user-1' } as never);

    expect(result.count).toBe(2);
    expect(result.readAt).toEqual(expect.any(String));
    expect(updateMany).toHaveBeenCalledWith({
      where: { userId: 'user-1', readAt: null },
      data: { readAt: expect.any(Date) },
    });
  });
});

describe('live notification stream', () => {
  function tx(userIds: string[]) {
    return {
      user: { findMany: jest.fn().mockResolvedValue(userIds.map((id) => ({ id }))) },
      notification: { createMany: jest.fn().mockResolvedValue({ count: userIds.length }) },
    };
  }
  const input = {
    organisationId: 'air-1',
    role: 'AIRLINE_REQUESTER' as const,
    title: 'RQ-00001 is accepted',
    body: 'PK301, KHI-DXB.',
    entity: 'ServiceRequest',
    entityId: 'rq-1',
  };

  it('pings only the users the notification was written for', async () => {
    const service = new NotificationsService({} as never);
    const mine = jest.fn();
    const someoneElse = jest.fn();
    service.subscribe('user-2', mine);
    service.subscribe('user-9', someoneElse);

    await service.notify(tx(['user-2']) as never, input);

    expect(mine).toHaveBeenCalledWith({
      title: 'RQ-00001 is accepted',
      body: 'PK301, KHI-DXB.',
      entity: 'ServiceRequest',
      entityId: 'rq-1',
    });
    expect(someoneElse).not.toHaveBeenCalled();
  });

  it('can be aimed at one branch, still reaching people who are not tied to a branch', async () => {
    const service = new NotificationsService({} as never);
    const client = tx(['user-2']);

    await service.notify(client as never, { ...input, branchId: 'branch-1' });

    expect(client.user.findMany).toHaveBeenCalledWith({
      where: expect.objectContaining({
        role: 'AIRLINE_REQUESTER',
        OR: [{ branchId: 'branch-1' }, { branchId: null }],
      }),
      select: { id: true },
    });
  });

  it('reaches the whole role when no branch is given', async () => {
    const service = new NotificationsService({} as never);
    const client = tx(['user-2']);

    await service.notify(client as never, input);

    const where = client.user.findMany.mock.calls[0]?.[0].where as Record<string, unknown>;
    expect(where).not.toHaveProperty('OR');
  });

  it('stops pinging a closed stream', async () => {
    const service = new NotificationsService({} as never);
    const listener = jest.fn();
    const unsubscribe = service.subscribe('user-2', listener);
    unsubscribe?.();

    await service.notify(tx(['user-2']) as never, input);

    expect(listener).not.toHaveBeenCalled();
  });
});

describe('stream limits', () => {
  it('refuses a fourth stream for one user, and frees a place when one closes', () => {
    const service = new NotificationsService({} as never);
    const first = service.subscribe('user-1', jest.fn());
    service.subscribe('user-1', jest.fn());
    service.subscribe('user-1', jest.fn());
    expect(service.subscribe('user-1', jest.fn())).toBeNull();
    expect(service.subscribe('user-2', jest.fn())).not.toBeNull();
    first?.();
    expect(service.subscribe('user-1', jest.fn())).not.toBeNull();
  });

  it('treats a disabled or missing account as inactive', async () => {
    const findUnique = jest
      .fn()
      .mockResolvedValueOnce({ status: 'DISABLED' })
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ status: 'ACTIVE' });
    const service = new NotificationsService({ user: { findUnique } } as never);
    expect(await service.isActive('a')).toBe(false);
    expect(await service.isActive('b')).toBe(false);
    expect(await service.isActive('c')).toBe(true);
  });
});
