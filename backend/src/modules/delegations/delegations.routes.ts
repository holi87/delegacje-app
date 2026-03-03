import { FastifyInstance } from 'fastify';
import { authenticate } from '../../middleware/authenticate.js';
import { authorize } from '../../middleware/authorize.js';
import {
  createDelegationSchema,
  updateDelegationSchema,
  listDelegationsQuerySchema,
} from './delegations.schema.js';
import {
  listDelegations,
  getDelegationById,
  createDelegation,
  updateDelegation,
  deleteDelegation,
  submitDelegation,
  settleDelegation,
  reopenDelegation,
  calculateDelegationForPreview,
} from './delegations.service.js';

export async function delegationsRoutes(app: FastifyInstance) {
  // =====================
  // GET / — List delegations
  // User sees own, admin sees all. Supports ?status=&page=&limit=
  // =====================
  app.get('/', { preHandler: [authenticate] }, async (request, reply) => {
    const queryParsed = listDelegationsQuerySchema.safeParse(request.query);
    if (!queryParsed.success) {
      return reply.status(422).send({
        statusCode: 422,
        error: 'Validation Error',
        message: 'Błąd walidacji parametrów',
        details: queryParsed.error.errors.map((e) => ({
          field: e.path.join('.'),
          message: e.message,
        })),
      });
    }

    const { status, page, limit } = queryParsed.data;
    const result = await listDelegations(
      app.prisma,
      request.user.userId,
      request.user.role,
      { status: status as any, page, limit }
    );

    return result;
  });

  // =====================
  // GET /:id — Get single delegation with days, costs, mileage, receipts
  // =====================
  app.get('/:id', { preHandler: [authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string };

    const delegation = await getDelegationById(
      app.prisma,
      id,
      request.user.userId,
      request.user.role
    );

    return { delegation };
  });

  // =====================
  // POST / — Create delegation (status=DRAFT)
  // =====================
  app.post('/', { preHandler: [authenticate] }, async (request, reply) => {
    const parsed = createDelegationSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(422).send({
        statusCode: 422,
        error: 'Validation Error',
        message: 'Błąd walidacji danych delegacji',
        details: parsed.error.errors.map((e) => ({
          field: e.path.join('.'),
          message: e.message,
        })),
      });
    }

    const delegation = await createDelegation(
      app.prisma,
      request.user.userId,
      parsed.data
    );

    return reply.status(201).send({ delegation });
  });

  // =====================
  // PATCH /:id — Update delegation (only DRAFT)
  // =====================
  app.patch('/:id', { preHandler: [authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string };

    const parsed = updateDelegationSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(422).send({
        statusCode: 422,
        error: 'Validation Error',
        message: 'Błąd walidacji danych delegacji',
        details: parsed.error.errors.map((e) => ({
          field: e.path.join('.'),
          message: e.message,
        })),
      });
    }

    const delegation = await updateDelegation(
      app.prisma,
      id,
      request.user.userId,
      request.user.role,
      parsed.data
    );

    return { delegation };
  });

  // =====================
  // DELETE /:id — Delete delegation (only DRAFT)
  // =====================
  app.delete('/:id', { preHandler: [authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string };

    await deleteDelegation(
      app.prisma,
      id,
      request.user.userId,
      request.user.role
    );

    return reply.status(204).send();
  });

  // =====================
  // POST /:id/submit — DRAFT -> SUBMITTED
  // =====================
  app.post('/:id/submit', { preHandler: [authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string };

    const delegation = await submitDelegation(
      app.prisma,
      id,
      request.user.userId,
      request.user.role
    );

    return { delegation };
  });

  // =====================
  // POST /:id/settle — SUBMITTED -> SETTLED (admin only)
  // =====================
  app.post(
    '/:id/settle',
    { preHandler: [authenticate, authorize('ADMIN')] },
    async (request, reply) => {
      const { id } = request.params as { id: string };

      const delegation = await settleDelegation(
        app.prisma,
        id,
        request.user.userId
      );

      return { delegation };
    }
  );

  // =====================
  // POST /:id/reopen — SETTLED -> DRAFT (admin only)
  // =====================
  app.post(
    '/:id/reopen',
    { preHandler: [authenticate, authorize('ADMIN')] },
    async (request, reply) => {
      const { id } = request.params as { id: string };

      const delegation = await reopenDelegation(app.prisma, id);

      return { delegation };
    }
  );

  // =====================
  // POST /:id/calculate — Calculate and return results (does NOT save)
  // =====================
  app.post('/:id/calculate', { preHandler: [authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string };

    const calculation = await calculateDelegationForPreview(
      app.prisma,
      id,
      request.user.userId,
      request.user.role
    );

    return { calculation };
  });
}
