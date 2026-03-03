import { FastifyInstance } from 'fastify';
import { authenticate } from '../../middleware/authenticate.js';
import { authorize } from '../../middleware/authorize.js';
import { createUserSchema, updateUserSchema, updateProfileSchema, changePasswordSchema } from './users.schema.js';
import { listUsers, createUser } from './users.service.js';
import bcrypt from 'bcrypt';

export async function usersRoutes(app: FastifyInstance) {
  // Admin: list users
  app.get('/', { preHandler: [authenticate, authorize('ADMIN')] }, async (request, reply) => {
    const { page = '1', limit = '20' } = request.query as Record<string, string>;
    const result = await listUsers(app.prisma, parseInt(page), parseInt(limit));
    return result;
  });

  // Admin: get user by id
  app.get('/:id', { preHandler: [authenticate, authorize('ADMIN')] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const user = await app.prisma.user.findUnique({
      where: { id },
      include: { profile: true },
    });
    if (!user) {
      return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: 'Użytkownik nie znaleziony' });
    }
    return {
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        isActive: user.isActive,
        createdAt: user.createdAt.toISOString(),
      },
      profile: user.profile,
    };
  });

  // Admin: create user
  app.post('/', { preHandler: [authenticate, authorize('ADMIN')] }, async (request, reply) => {
    const parsed = createUserSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(422).send({
        statusCode: 422,
        error: 'Validation Error',
        message: 'Błąd walidacji danych',
        details: parsed.error.errors.map((e) => ({ field: e.path.join('.'), message: e.message })),
      });
    }

    const existing = await app.prisma.user.findUnique({ where: { email: parsed.data.email } });
    if (existing) {
      return reply.status(422).send({
        statusCode: 422,
        error: 'Validation Error',
        message: 'Użytkownik z tym adresem email już istnieje',
      });
    }

    const user = await createUser(app.prisma, parsed.data);
    return reply.status(201).send({ user });
  });

  // Admin: update user
  app.patch('/:id', { preHandler: [authenticate, authorize('ADMIN')] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const parsed = updateUserSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(422).send({
        statusCode: 422,
        error: 'Validation Error',
        message: 'Błąd walidacji danych',
        details: parsed.error.errors.map((e) => ({ field: e.path.join('.'), message: e.message })),
      });
    }

    const { profile, ...userData } = parsed.data;
    const user = await app.prisma.user.update({
      where: { id },
      data: {
        ...userData,
        ...(profile ? { profile: { update: profile } } : {}),
      },
      include: { profile: true },
    });
    return { user };
  });

  // Admin: deactivate user (soft delete)
  app.delete('/:id', { preHandler: [authenticate, authorize('ADMIN')] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    await app.prisma.user.update({
      where: { id },
      data: { isActive: false },
    });
    return reply.status(204).send();
  });

  // Profile routes
  app.get('/profile', { preHandler: [authenticate] }, async (request, reply) => {
    // Redirect to /api/v1/profile - registered separately below
  });
}

// Separate profile routes (mounted at /api/v1 in index.ts if needed)
export async function profileRoutes(app: FastifyInstance) {
  app.get('/', { preHandler: [authenticate] }, async (request, reply) => {
    const profile = await app.prisma.userProfile.findUnique({
      where: { userId: request.user.userId },
    });
    if (!profile) {
      return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: 'Profil nie znaleziony' });
    }
    return { profile };
  });

  app.patch('/', { preHandler: [authenticate] }, async (request, reply) => {
    const parsed = updateProfileSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(422).send({
        statusCode: 422,
        error: 'Validation Error',
        message: 'Błąd walidacji danych',
        details: parsed.error.errors.map((e) => ({ field: e.path.join('.'), message: e.message })),
      });
    }
    const profile = await app.prisma.userProfile.update({
      where: { userId: request.user.userId },
      data: parsed.data as any,
    });
    return { profile };
  });

  app.patch('/password', { preHandler: [authenticate] }, async (request, reply) => {
    const parsed = changePasswordSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(422).send({
        statusCode: 422,
        error: 'Validation Error',
        message: 'Błąd walidacji danych',
        details: parsed.error.errors.map((e) => ({ field: e.path.join('.'), message: e.message })),
      });
    }

    const user = await app.prisma.user.findUnique({ where: { id: request.user.userId } });
    if (!user) {
      return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: 'Użytkownik nie znaleziony' });
    }

    const valid = await bcrypt.compare(parsed.data.currentPassword, user.passwordHash);
    if (!valid) {
      return reply.status(401).send({ statusCode: 401, error: 'Unauthorized', message: 'Nieprawidłowe obecne hasło' });
    }

    const passwordHash = await bcrypt.hash(parsed.data.newPassword, 12);
    await app.prisma.user.update({
      where: { id: user.id },
      data: { passwordHash },
    });
    return reply.status(204).send();
  });
}
