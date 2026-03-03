import Fastify from 'fastify';
import { loadEnv } from './config/env.js';
import prismaPlugin from './plugins/prisma.js';
import corsPlugin from './plugins/cors.js';
import rateLimitPlugin from './plugins/rate-limit.js';
import authPlugin from './plugins/auth.js';
import { setupRoutes } from './modules/setup/setup.routes.js';
import { authRoutes } from './modules/auth/auth.routes.js';
import { usersRoutes, profileRoutes } from './modules/users/users.routes.js';
import { delegationsRoutes } from './modules/delegations/delegations.routes.js';
import { ratesRoutes } from './modules/admin/rates.routes.js';
import { companyRoutes } from './modules/admin/company.routes.js';
import { delegationNumberingRoutes } from './modules/admin/delegation-numbering.routes.js';
import { pdfRoutes } from './modules/pdf/pdf.routes.js';
import { AppError } from './utils/errors.js';

declare module 'fastify' {
  interface FastifyInstance {
    config: ReturnType<typeof loadEnv>;
  }
}

async function buildApp() {
  const config = loadEnv();

  const app = Fastify({
    logger: {
      level: config.NODE_ENV === 'production' ? 'info' : 'debug',
    },
  });

  app.decorate('config', config);

  // Plugins
  await app.register(prismaPlugin);
  await app.register(corsPlugin);
  await app.register(rateLimitPlugin);
  await app.register(authPlugin);

  // Error handler
  app.setErrorHandler((error: any, request, reply) => {
    if (error instanceof AppError) {
      return reply.status(error.statusCode).send({
        statusCode: error.statusCode,
        error: error.name,
        message: error.message,
        details: error.details,
      });
    }

    // Fastify validation error
    if (error.validation) {
      return reply.status(422).send({
        statusCode: 422,
        error: 'Validation Error',
        message: 'Błąd walidacji danych',
        details: error.validation.map((v: any) => ({
          field: v.instancePath || v.params?.missingProperty || 'unknown',
          message: v.message || 'Nieprawidłowa wartość',
        })),
      });
    }

    app.log.error(error);
    return reply.status(500).send({
      statusCode: 500,
      error: 'Internal Server Error',
      message: 'Wewnętrzny błąd serwera',
    });
  });

  // Routes
  await app.register(setupRoutes, { prefix: '/api/v1/setup' });
  await app.register(authRoutes, { prefix: '/api/v1/auth' });
  await app.register(usersRoutes, { prefix: '/api/v1/users' });
  await app.register(profileRoutes, { prefix: '/api/v1/profile' });
  await app.register(delegationsRoutes, { prefix: '/api/v1/delegations' });
  await app.register(ratesRoutes, { prefix: '/api/v1/admin/rates' });
  await app.register(companyRoutes, { prefix: '/api/v1/admin/company' });
  await app.register(delegationNumberingRoutes, { prefix: '/api/v1/admin/delegation-numbering' });
  await app.register(pdfRoutes, { prefix: '/api/v1/delegations' });

  // Health check — verifies DB connectivity
  app.get('/api/v1/health', async () => {
    try {
      await app.prisma.$queryRaw`SELECT 1`;
      return { status: 'ok', database: 'connected' };
    } catch {
      return { status: 'degraded', database: 'disconnected' };
    }
  });

  return app;
}

async function start() {
  const app = await buildApp();
  const config = app.config;

  try {
    await app.listen({ port: config.PORT, host: config.HOST });
    app.log.info(`Server running on http://${config.HOST}:${config.PORT}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

start();

export { buildApp };
