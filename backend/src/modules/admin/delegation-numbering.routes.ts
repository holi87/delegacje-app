import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { authenticate } from '../../middleware/authenticate.js';
import { authorize } from '../../middleware/authorize.js';
import { getDelegationNumbering, resetDelegationNumbering } from './delegation-numbering.service.js';

const resetDelegationNumberingSchema = z.object({
  nextNumber: z.number().int().min(1, 'Nastepny numer musi byc wiekszy od 0'),
});

export async function delegationNumberingRoutes(app: FastifyInstance) {
  app.get('/', { preHandler: [authenticate, authorize('ADMIN')] }, async () => {
    const numbering = await getDelegationNumbering(app.prisma);
    return { numbering };
  });

  app.patch('/', { preHandler: [authenticate, authorize('ADMIN')] }, async (request, reply) => {
    const parsed = resetDelegationNumberingSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(422).send({
        statusCode: 422,
        error: 'Validation Error',
        message: 'Blad walidacji numeracji delegacji',
        details: parsed.error.errors.map((e) => ({
          field: e.path.join('.'),
          message: e.message,
        })),
      });
    }

    const numbering = await resetDelegationNumbering(app.prisma, parsed.data.nextNumber);
    return { numbering };
  });
}
