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
