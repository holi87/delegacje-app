import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

export async function validateCredentials(prisma: PrismaClient, email: string, password: string) {
  const user = await prisma.user.findUnique({
    where: { email },
    include: { profile: true },
  });

  if (!user || !user.isActive) {
    return null;
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    return null;
  }

  return {
    id: user.id,
    email: user.email,
    role: user.role,
    isActive: user.isActive,
    profile: user.profile,
  };
}
