import { FastifyInstance } from 'fastify';
import { setupInitSchema } from './setup.schema.js';
import { checkNeedsSetup, initializeSetup } from './setup.service.js';

export async function setupRoutes(app: FastifyInstance) {
  app.get('/status', async (request, reply) => {
    const needsSetup = await checkNeedsSetup(app.prisma);
    return { needsSetup };
  });

  app.post('/init', async (request, reply) => {
    const needsSetup = await checkNeedsSetup(app.prisma);
    if (!needsSetup) {
      return reply.status(403).send({
        statusCode: 403,
        error: 'Forbidden',
        message: 'Konfiguracja początkowa została już wykonana',
      });
    }

    const parsed = setupInitSchema.safeParse(request.body);
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

    const admin = await initializeSetup(app.prisma, parsed.data);

    return reply.status(201).send({
      message: 'Konfiguracja początkowa zakończona pomyślnie',
      admin,
    });
  });
}
