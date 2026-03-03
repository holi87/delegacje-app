import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

export async function listUsers(prisma: PrismaClient, page = 1, limit = 20) {
  const skip = (page - 1) * limit;
  const [users, total] = await Promise.all([
    prisma.user.findMany({
      skip,
      take: limit,
      include: { profile: true },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.user.count(),
  ]);

  return {
    users: users.map((u) => ({
      id: u.id,
      email: u.email,
      role: u.role,
      isActive: u.isActive,
      createdAt: u.createdAt.toISOString(),
      profile: u.profile
        ? {
            id: u.profile.id,
            firstName: u.profile.firstName,
            lastName: u.profile.lastName,
            position: u.profile.position,
            defaultVehicle: u.profile.defaultVehicle,
            vehiclePlate: u.profile.vehiclePlate,
            vehicleCapacity: u.profile.vehicleCapacity,
          }
        : null,
    })),
    total,
  };
}

export async function createUser(
  prisma: PrismaClient,
  data: {
    email: string;
    password: string;
    role: 'ADMIN' | 'DELEGATED';
    profile: { firstName: string; lastName: string; position: string; defaultVehicle?: string | null; vehiclePlate?: string | null; vehicleCapacity?: string | null };
  }
) {
  const passwordHash = await bcrypt.hash(data.password, 12);
  const user = await prisma.user.create({
    data: {
      email: data.email,
      passwordHash,
      role: data.role,
      profile: {
        create: {
          firstName: data.profile.firstName,
          lastName: data.profile.lastName,
          position: data.profile.position,
          defaultVehicle: data.profile.defaultVehicle as any,
          vehiclePlate: data.profile.vehiclePlate,
          vehicleCapacity: data.profile.vehicleCapacity,
        },
      },
    },
    include: { profile: true },
  });
  return user;
}
