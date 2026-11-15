import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../src/prisma/prisma.service';
import { AuthService } from '../src/auth/auth.service';

describe('AuthService', () => {
  const config = { getOrThrow: () => 'a-32-character-or-longer-test-secret' } as unknown as ConfigService;

  it('stores a salted password hash and issues a verifiable JWT', async () => {
    const createUser = jest.fn().mockImplementation((args: { data: { email: string; passwordHash: string } }) => ({
      id: 'user-id',
      email: args.data.email,
      passwordHash: args.data.passwordHash,
    }));
    const prisma = {
      user: { create: createUser },
    } as unknown as PrismaService;
    const auth = new AuthService(prisma, config);
    const result = await auth.register('Person@example.com', 'correct horse');
    expect(result.user.email).toBe('person@example.com');
    expect(createUser.mock.calls[0][0].data.passwordHash).not.toContain('correct horse');
    expect(result.token.split('.')).toHaveLength(3);
    expect(auth.verify(result.token)).toBe('user-id');
    expect(auth.verify(`${result.token}x`)).toBeNull();
  });
});
