import { FastifyInstance } from 'fastify';
import { loginSchema } from './auth.schema.js';
import { validateCredentials } from './auth.service.js';
import { authenticate } from '../../middleware/authenticate.js';

export async function authRoutes(app: FastifyInstance) {
  app.post('/login', async (request, reply) => {
    const parsed = loginSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(422).send({
        statusCode: 422,
        error: 'Validation Error',
        message: 'Błąd walidacji danych',
        details: parsed.error.errors.map((e) => ({
          field: e.path.join('.'),
          message: e.message,
        })),
      });
    }

    const user = await validateCredentials(app.prisma, parsed.data.email, parsed.data.password);
    if (!user) {
      return reply.status(401).send({
        statusCode: 401,
        error: 'Unauthorized',
        message: 'Nieprawidłowy email lub hasło',
      });
    }

    const accessToken = app.jwt.sign(
      { userId: user.id, role: user.role },
      { expiresIn: '15m' }
    );

    const refreshToken = app.jwt.sign(
      { userId: user.id, role: user.role },
      { expiresIn: '7d' }
    );

    reply.setCookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: app.config.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/api/v1/auth/refresh',
      maxAge: 7 * 24 * 60 * 60, // 7 days
    });

    return {
      accessToken,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        profile: user.profile
          ? {
              firstName: user.profile.firstName,
              lastName: user.profile.lastName,
              position: user.profile.position,
            }
          : null,
      },
    };
  });

  app.post('/refresh', async (request, reply) => {
    const token = request.cookies.refreshToken;
    if (!token) {
      return reply.status(401).send({
        statusCode: 401,
        error: 'Unauthorized',
        message: 'Brak tokena odświeżania',
      });
    }

    try {
      const decoded = app.jwt.verify<{ userId: string; role: string }>(token);
      const user = await app.prisma.user.findUnique({
        where: { id: decoded.userId },
      });

      if (!user || !user.isActive) {
        return reply.status(401).send({
          statusCode: 401,
          error: 'Unauthorized',
          message: 'Użytkownik nieaktywny',
        });
      }

      const accessToken = app.jwt.sign(
        { userId: user.id, role: user.role },
        { expiresIn: '15m' }
      );

      return { accessToken };
    } catch {
      return reply.status(401).send({
        statusCode: 401,
        error: 'Unauthorized',
        message: 'Nieprawidłowy token odświeżania',
      });
    }
  });

  app.post('/logout', { preHandler: [authenticate] }, async (request, reply) => {
    reply.clearCookie('refreshToken', { path: '/api/v1/auth/refresh' });
    return reply.status(204).send();
  });

  app.get('/me', { preHandler: [authenticate] }, async (request, reply) => {
    const user = await app.prisma.user.findUnique({
      where: { id: request.user.userId },
      include: { profile: true },
    });

    if (!user) {
      return reply.status(404).send({
        statusCode: 404,
        error: 'Not Found',
        message: 'Użytkownik nie znaleziony',
      });
    }

    return {
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        isActive: user.isActive,
        createdAt: user.createdAt.toISOString(),
      },
      profile: user.profile
        ? {
            id: user.profile.id,
            firstName: user.profile.firstName,
            lastName: user.profile.lastName,
            position: user.profile.position,
            defaultVehicle: user.profile.defaultVehicle,
            vehiclePlate: user.profile.vehiclePlate,
            vehicleCapacity: user.profile.vehicleCapacity,
          }
        : null,
    };
  });
}
