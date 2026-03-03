import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { authenticate } from '../../middleware/authenticate.js';
import { authorize } from '../../middleware/authorize.js';
import {
  listDomesticRates,
  createDomesticRate,
  updateDomesticRate,
  listMileageRates,
  createMileageRate,
  updateMileageRate,
  listForeignRates,
  createForeignRate,
  updateForeignRate,
  deleteForeignRate,
} from './rates.service.js';

// =====================
// Zod Schemas
// =====================

const createDomesticRateSchema = z.object({
  dailyDiet: z.string().regex(/^\d+(\.\d{1,2})?$/, 'Nieprawidłowy format kwoty'),
  accommodationLumpSum: z.string().regex(/^\d+(\.\d{1,2})?$/, 'Nieprawidłowy format kwoty'),
  accommodationMaxReceipt: z.string().regex(/^\d+(\.\d{1,2})?$/, 'Nieprawidłowy format kwoty'),
  localTransportLumpSum: z.string().regex(/^\d+(\.\d{1,2})?$/, 'Nieprawidłowy format kwoty'),
  breakfastDeductionPct: z.number().int().min(0).max(100),
  lunchDeductionPct: z.number().int().min(0).max(100),
  dinnerDeductionPct: z.number().int().min(0).max(100),
  validFrom: z.string().datetime({ message: 'Nieprawidłowy format daty' }).or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Nieprawidłowy format daty')),
  validTo: z.string().datetime().or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).nullable().optional(),
});

const updateDomesticRateSchema = z.object({
  dailyDiet: z.string().regex(/^\d+(\.\d{1,2})?$/, 'Nieprawidłowy format kwoty').optional(),
  accommodationLumpSum: z.string().regex(/^\d+(\.\d{1,2})?$/, 'Nieprawidłowy format kwoty').optional(),
  accommodationMaxReceipt: z.string().regex(/^\d+(\.\d{1,2})?$/, 'Nieprawidłowy format kwoty').optional(),
  localTransportLumpSum: z.string().regex(/^\d+(\.\d{1,2})?$/, 'Nieprawidłowy format kwoty').optional(),
  breakfastDeductionPct: z.number().int().min(0).max(100).optional(),
  lunchDeductionPct: z.number().int().min(0).max(100).optional(),
  dinnerDeductionPct: z.number().int().min(0).max(100).optional(),
  validFrom: z.string().datetime().or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).optional(),
  validTo: z.string().datetime().or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).nullable().optional(),
});

const vehicleTypeEnum = z.enum(['CAR_ABOVE_900', 'CAR_BELOW_900', 'MOTORCYCLE', 'MOPED']);

const createMileageRateSchema = z.object({
  vehicleType: vehicleTypeEnum,
  ratePerKm: z.string().regex(/^\d+(\.\d{1,2})?$/, 'Nieprawidłowy format kwoty'),
  validFrom: z.string().datetime({ message: 'Nieprawidłowy format daty' }).or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Nieprawidłowy format daty')),
  validTo: z.string().datetime().or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).nullable().optional(),
});

const updateMileageRateSchema = z.object({
  vehicleType: vehicleTypeEnum.optional(),
  ratePerKm: z.string().regex(/^\d+(\.\d{1,2})?$/, 'Nieprawidłowy format kwoty').optional(),
  validFrom: z.string().datetime().or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).optional(),
  validTo: z.string().datetime().or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).nullable().optional(),
});

const createForeignRateSchema = z.object({
  countryCode: z.string().min(2).max(3),
  countryName: z.string().min(1, 'Nazwa kraju jest wymagana'),
  currency: z.string().min(3).max(3),
  dailyDiet: z.string().regex(/^\d+(\.\d{1,2})?$/, 'Nieprawidłowy format kwoty'),
  accommodationLimit: z.string().regex(/^\d+(\.\d{1,2})?$/, 'Nieprawidłowy format kwoty'),
  breakfastDeductionPct: z.number().int().min(0).max(100),
  lunchDeductionPct: z.number().int().min(0).max(100),
  dinnerDeductionPct: z.number().int().min(0).max(100),
  validFrom: z.string().datetime({ message: 'Nieprawidłowy format daty' }).or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Nieprawidłowy format daty')),
  validTo: z.string().datetime().or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).nullable().optional(),
});

const updateForeignRateSchema = z.object({
  countryCode: z.string().min(2).max(3).optional(),
  countryName: z.string().min(1).optional(),
  currency: z.string().min(3).max(3).optional(),
  dailyDiet: z.string().regex(/^\d+(\.\d{1,2})?$/, 'Nieprawidłowy format kwoty').optional(),
  accommodationLimit: z.string().regex(/^\d+(\.\d{1,2})?$/, 'Nieprawidłowy format kwoty').optional(),
  breakfastDeductionPct: z.number().int().min(0).max(100).optional(),
  lunchDeductionPct: z.number().int().min(0).max(100).optional(),
  dinnerDeductionPct: z.number().int().min(0).max(100).optional(),
  validFrom: z.string().datetime().or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).optional(),
  validTo: z.string().datetime().or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).nullable().optional(),
});

// =====================
// Routes
// =====================

export async function ratesRoutes(app: FastifyInstance) {
  // GET /domestic - list all domestic rates
  app.get('/domestic', { preHandler: [authenticate, authorize('ADMIN')] }, async (request, reply) => {
    const rates = await listDomesticRates(app.prisma);
    return { rates };
  });

  // POST /domestic - create a new domestic rate
  app.post('/domestic', { preHandler: [authenticate, authorize('ADMIN')] }, async (request, reply) => {
    const parsed = createDomesticRateSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(422).send({
        statusCode: 422,
        error: 'Validation Error',
        message: 'Błąd walidacji danych stawki',
        details: parsed.error.errors.map((e) => ({ field: e.path.join('.'), message: e.message })),
      });
    }

    const rate = await createDomesticRate(app.prisma, parsed.data);
    return reply.status(201).send({ rate });
  });

  // PATCH /domestic/:id - update a domestic rate
  app.patch('/domestic/:id', { preHandler: [authenticate, authorize('ADMIN')] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const parsed = updateDomesticRateSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(422).send({
        statusCode: 422,
        error: 'Validation Error',
        message: 'Błąd walidacji danych stawki',
        details: parsed.error.errors.map((e) => ({ field: e.path.join('.'), message: e.message })),
      });
    }

    const existing = await app.prisma.domesticRate.findUnique({ where: { id } });
    if (!existing) {
      return reply.status(404).send({
        statusCode: 404,
        error: 'Not Found',
        message: 'Stawka nie znaleziona',
      });
    }

    const rate = await updateDomesticRate(app.prisma, id, parsed.data);
    return { rate };
  });

  // GET /mileage - list all mileage rates
  app.get('/mileage', { preHandler: [authenticate, authorize('ADMIN')] }, async (request, reply) => {
    const rates = await listMileageRates(app.prisma);
    return { rates };
  });

  // POST /mileage - create a new mileage rate
  app.post('/mileage', { preHandler: [authenticate, authorize('ADMIN')] }, async (request, reply) => {
    const parsed = createMileageRateSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(422).send({
        statusCode: 422,
        error: 'Validation Error',
        message: 'Błąd walidacji danych stawki kilometrówki',
        details: parsed.error.errors.map((e) => ({ field: e.path.join('.'), message: e.message })),
      });
    }

    const rate = await createMileageRate(app.prisma, parsed.data);
    return reply.status(201).send({ rate });
  });

  // PATCH /mileage/:id - update a mileage rate
  app.patch('/mileage/:id', { preHandler: [authenticate, authorize('ADMIN')] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const parsed = updateMileageRateSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(422).send({
        statusCode: 422,
        error: 'Validation Error',
        message: 'Błąd walidacji danych stawki kilometrówki',
        details: parsed.error.errors.map((e) => ({ field: e.path.join('.'), message: e.message })),
      });
    }

    const existing = await app.prisma.mileageRate.findUnique({ where: { id } });
    if (!existing) {
      return reply.status(404).send({
        statusCode: 404,
        error: 'Not Found',
        message: 'Stawka kilometrówki nie znaleziona',
      });
    }

    const rate = await updateMileageRate(app.prisma, id, parsed.data);
    return { rate };
  });

  // =====================
  // Foreign Diet Rates
  // =====================

  // GET /foreign - list all foreign diet rates
  app.get('/foreign', { preHandler: [authenticate, authorize('ADMIN')] }, async (request, reply) => {
    const rates = await listForeignRates(app.prisma);
    return { rates };
  });

  // POST /foreign - create a new foreign diet rate
  app.post('/foreign', { preHandler: [authenticate, authorize('ADMIN')] }, async (request, reply) => {
    const parsed = createForeignRateSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(422).send({
        statusCode: 422,
        error: 'Validation Error',
        message: 'Błąd walidacji danych stawki zagranicznej',
        details: parsed.error.errors.map((e) => ({ field: e.path.join('.'), message: e.message })),
      });
    }

    const rate = await createForeignRate(app.prisma, parsed.data);
    return reply.status(201).send({ rate });
  });

  // PATCH /foreign/:id - update a foreign diet rate
  app.patch('/foreign/:id', { preHandler: [authenticate, authorize('ADMIN')] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const parsed = updateForeignRateSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(422).send({
        statusCode: 422,
        error: 'Validation Error',
        message: 'Błąd walidacji danych stawki zagranicznej',
        details: parsed.error.errors.map((e) => ({ field: e.path.join('.'), message: e.message })),
      });
    }

    const existing = await app.prisma.foreignDietRate.findUnique({ where: { id } });
    if (!existing) {
      return reply.status(404).send({
        statusCode: 404,
        error: 'Not Found',
        message: 'Stawka zagraniczna nie znaleziona',
      });
    }

    const rate = await updateForeignRate(app.prisma, id, parsed.data);
    return { rate };
  });

  // DELETE /foreign/:id - delete a foreign diet rate
  app.delete('/foreign/:id', { preHandler: [authenticate, authorize('ADMIN')] }, async (request, reply) => {
    const { id } = request.params as { id: string };

    const existing = await app.prisma.foreignDietRate.findUnique({ where: { id } });
    if (!existing) {
      return reply.status(404).send({
        statusCode: 404,
        error: 'Not Found',
        message: 'Stawka zagraniczna nie znaleziona',
      });
    }

    await deleteForeignRate(app.prisma, id);
    return reply.status(204).send();
  });
}
