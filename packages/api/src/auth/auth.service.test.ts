import { UnauthorizedException } from '@nestjs/common';
import { UserStatus } from '@prisma/client';
import bcrypt from 'bcryptjs';

import { AuthService } from './auth.service';
import { LoginThrottle } from './login-throttle';

describe('AuthService', () => {
  it('rejects a wrong password without revealing which part failed', async () => {
    const passwordHash = await bcrypt.hash('1234', 4);
    const prisma = {
      user: {
        update: jest.fn().mockResolvedValue({}),
        findUnique: jest.fn().mockResolvedValue({
          id: 'user-1',
          email: 'admin@karam.local',
          name: 'Karam Administrator',
          role: 'ADMINISTRATOR',
          status: UserStatus.ACTIVE,
          organisationId: 'org-1',
          passwordHash,
        }),
      },
    };
    const jwt = { signAsync: jest.fn() };
    const service = new AuthService(prisma as never, jwt as never);

    await expect(
      service.login({ email: 'admin@karam.local', password: 'nope' }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(jwt.signAsync).not.toHaveBeenCalled();
  });
});

describe('sign-in throttling', () => {
  afterEach(() => jest.useRealTimers());

  async function serviceWithHash() {
    const passwordHash = await bcrypt.hash('right-password', 4);
    const prisma = {
      user: {
        update: jest.fn().mockResolvedValue({}),
        findUnique: jest.fn().mockResolvedValue({
          id: 'user-1',
          email: 'ops@karam.local',
          name: 'Ops',
          role: 'OPERATIONS_MANAGER',
          status: UserStatus.ACTIVE,
          organisationId: 'org-1',
          branchId: null,
          passwordHash,
        }),
      },
    };
    const jwt = { signAsync: jest.fn().mockResolvedValue('token') };
    return new AuthService(prisma as never, jwt as never, new LoginThrottle());
  }

  it('blocks an email after five wrong passwords, even with the right one', async () => {
    const service = await serviceWithHash();
    for (let attempt = 0; attempt < 5; attempt += 1) {
      await expect(
        service.login({ email: 'ops@karam.local', password: 'wrong' }, '10.0.0.1'),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    }
    await expect(
      service.login({ email: 'ops@karam.local', password: 'right-password' }, '10.0.0.1'),
    ).rejects.toMatchObject({ status: 429 });
  });

  it('lets the email in again once the window has passed', async () => {
    jest.useFakeTimers({ now: new Date('2026-11-17T08:00:00Z') });
    const service = await serviceWithHash();
    for (let attempt = 0; attempt < 5; attempt += 1) {
      await service
        .login({ email: 'ops@karam.local', password: 'wrong' }, '10.0.0.1')
        .catch(() => null);
    }
    jest.setSystemTime(new Date('2026-11-17T08:16:00Z'));
    await expect(
      service.login({ email: 'ops@karam.local', password: 'right-password' }, '10.0.0.1'),
    ).resolves.toMatchObject({ accessToken: 'token' });
  });

  it('answers an unknown email after checking a password, like a known one', async () => {
    const prisma = { user: { findUnique: jest.fn().mockResolvedValue(null) } };
    const compare = jest.spyOn(bcrypt, 'compare');
    const service = new AuthService(
      prisma as never,
      { signAsync: jest.fn() } as never,
      new LoginThrottle(),
    );
    await expect(
      service.login({ email: 'nobody@karam.local', password: 'x' }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(compare).toHaveBeenCalled();
    compare.mockRestore();
  });
});
