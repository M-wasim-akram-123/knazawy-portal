import { UnauthorizedException } from '@nestjs/common';
import { UserStatus } from '@prisma/client';
import bcrypt from 'bcryptjs';

import { AuthService } from './auth.service';

describe('AuthService', () => {
  it('rejects a wrong password without revealing which part failed', async () => {
    const passwordHash = await bcrypt.hash('1234', 4);
    const prisma = {
      user: {
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

    await expect(service.login({ email: 'admin@karam.local', password: 'nope' })).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(jwt.signAsync).not.toHaveBeenCalled();
  });
});
