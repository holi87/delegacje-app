import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { authenticate } from '../../middleware/authenticate.js';
import { authorize } from '../../middleware/authorize.js';
import { getCompanyInfo, updateCompanyInfo } from './company.service.js';

// =====================
// Zod Schemas
// =====================

const updateCompanySchema = z.object({
  name: z.string().min(1, 'Nazwa firmy jest wymagana').optional(),
  nip: z
    .string()
    .regex(/^\d{10}$/, 'NIP musi składać się z 10 cyfr')
    .optional(),
  address: z.string().min(1, 'Adres jest wymagany').optional(),
  city: z.string().min(1, 'Miasto jest wymagane').optional(),
  postalCode: z
    .string()
    .regex(/^\d{2}-\d{3}$/, 'Kod pocztowy musi być w formacie XX-XXX')
    .optional(),
});

// =====================
// Routes
// =====================

export async function companyRoutes(app: FastifyInstance) {
  // GET / - get company info
  app.get('/', { preHandler: [authenticate, authorize('ADMIN')] }, async (request, reply) => {
    const companyInfo = await getCompanyInfo(app.prisma);

    if (!companyInfo) {
      return reply.status(404).send({
        statusCode: 404,
        error: 'Not Found',
        message: 'Dane firmy nie zostały jeszcze skonfigurowane',
      });
    }

    return { companyInfo };
  });

  // PATCH / - update company info
  app.patch('/', { preHandler: [authenticate, authorize('ADMIN')] }, async (request, reply) => {
    const parsed = updateCompanySchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(422).send({
        statusCode: 422,
        error: 'Validation Error',
        message: 'Błąd walidacji danych firmy',
        details: parsed.error.errors.map((e) => ({ field: e.path.join('.'), message: e.message })),
      });
    }

    const companyInfo = await updateCompanyInfo(app.prisma, parsed.data);
    return { companyInfo };
  });
}
