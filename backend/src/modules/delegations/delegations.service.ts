import { PrismaClient, Prisma, DelegationStatus } from '@prisma/client';
import { NotFoundError, ValidationError, ForbiddenError } from '../../utils/errors.js';
import { calculateDelegation, CalculationInput, CalculationResult } from './calculation.service.js';
import { calculateForeignDelegation, ForeignDelegationInput, ForeignCalculationResult, findForeignRate } from './foreign-calculation.service.js';
import type { CreateDelegationInput, UpdateDelegationInput } from './delegations.schema.js';

// =====================
// Helpers
// =====================

function decimalToString(value: Prisma.Decimal | null | undefined): string | null {
  if (value == null) return null;
  return value.toString();
}

/**
 * Standard include clause for loading delegation with all related data.
 */
const fullDelegationInclude = {
  days: { orderBy: { dayNumber: 'asc' as const } },
  additionalCosts: true,
  mileageDetails: true,
  transportReceipts: true,
  user: {
    select: {
      id: true,
      email: true,
      profile: {
        select: {
          firstName: true,
          lastName: true,
          position: true,
        },
      },
    },
  },
};

/**
 * Serialize a delegation record (with relations) for API response.
 * Converts Prisma Decimals to strings per project convention.
 */
function serializeDelegation(delegation: any) {
  return {
    id: delegation.id,
    userId: delegation.userId,
    type: delegation.type,
    status: delegation.status,
    purpose: delegation.purpose,
    destination: delegation.destination,
    departureAt: delegation.departureAt.toISOString(),
    returnAt: delegation.returnAt.toISOString(),
    transportType: delegation.transportType,
    vehicleType: delegation.vehicleType,
    transportNotes: delegation.transportNotes,
    accommodationType: delegation.accommodationType,
    accommodationNights: delegation.accommodationNights,
    accommodationTotal: decimalToString(delegation.accommodationTotal),
    advanceAmount: decimalToString(delegation.advanceAmount),
    totalDiet: decimalToString(delegation.totalDiet),
    totalAccommodation: decimalToString(delegation.totalAccommodation),
    totalTransport: decimalToString(delegation.totalTransport),
    totalAdditional: decimalToString(delegation.totalAdditional),
    grandTotal: decimalToString(delegation.grandTotal),
    amountDue: decimalToString(delegation.amountDue),
    foreignCountry: delegation.foreignCountry,
    foreignCurrency: delegation.foreignCurrency,
    foreignRateId: delegation.foreignRateId,
    borderCrossingOut: delegation.borderCrossingOut?.toISOString() ?? null,
    borderCrossingIn: delegation.borderCrossingIn?.toISOString() ?? null,
    totalDomesticDiet: decimalToString(delegation.totalDomesticDiet),
    totalForeignDiet: decimalToString(delegation.totalForeignDiet),
    settledAt: delegation.settledAt?.toISOString() ?? null,
    settledBy: delegation.settledBy,
    createdAt: delegation.createdAt.toISOString(),
    updatedAt: delegation.updatedAt.toISOString(),
    user: delegation.user
      ? {
          id: delegation.user.id,
          email: delegation.user.email,
          profile: delegation.user.profile,
        }
      : undefined,
    days: delegation.days?.map((d: any) => ({
      id: d.id,
      dayNumber: d.dayNumber,
      date: d.date.toISOString().split('T')[0],
      hoursInDay: decimalToString(d.hoursInDay),
      breakfastProvided: d.breakfastProvided,
      lunchProvided: d.lunchProvided,
      dinnerProvided: d.dinnerProvided,
      accommodationType: d.accommodationType,
      accommodationCost: decimalToString(d.accommodationCost),
      dietBase: decimalToString(d.dietBase),
      dietDeductions: decimalToString(d.dietDeductions),
      dietFinal: decimalToString(d.dietFinal),
      isForeign: d.isForeign,
      dietRate: decimalToString(d.dietRate),
    })),
    additionalCosts: delegation.additionalCosts?.map((c: any) => ({
      id: c.id,
      description: c.description,
      category: c.category,
      amount: decimalToString(c.amount),
      receiptNumber: c.receiptNumber,
    })),
    mileageDetails: delegation.mileageDetails
      ? {
          id: delegation.mileageDetails.id,
          vehicleType: delegation.mileageDetails.vehicleType,
          vehiclePlate: delegation.mileageDetails.vehiclePlate,
          distanceKm: decimalToString(delegation.mileageDetails.distanceKm),
          ratePerKm: decimalToString(delegation.mileageDetails.ratePerKm),
          totalAmount: decimalToString(delegation.mileageDetails.totalAmount),
        }
      : null,
    transportReceipts: delegation.transportReceipts?.map((r: any) => ({
      id: r.id,
      description: r.description,
      amount: decimalToString(r.amount),
      receiptNumber: r.receiptNumber,
    })),
  };
}

// =====================
// List delegations
// =====================

export async function listDelegations(
  prisma: PrismaClient,
  userId: string,
  role: string,
  filters: { status?: DelegationStatus; page: number; limit: number }
) {
  const { status, page, limit } = filters;
  const skip = (page - 1) * limit;

  const where: Prisma.DelegationWhereInput = {};

  // Non-admin users can only see their own delegations
  if (role !== 'ADMIN') {
    where.userId = userId;
  }

  if (status) {
    where.status = status;
  }

  const [delegations, total] = await Promise.all([
    prisma.delegation.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: fullDelegationInclude,
    }),
    prisma.delegation.count({ where }),
  ]);

  return {
    delegations: delegations.map(serializeDelegation),
    total,
  };
}

// =====================
// Get delegation by ID
// =====================

export async function getDelegationById(
  prisma: PrismaClient,
  delegationId: string,
  userId: string,
  role: string
) {
  const delegation = await prisma.delegation.findUnique({
    where: { id: delegationId },
    include: fullDelegationInclude,
  });

  if (!delegation) {
    throw new NotFoundError('Delegacja nie znaleziona');
  }

  // Non-admin users can only see their own delegations
  if (role !== 'ADMIN' && delegation.userId !== userId) {
    throw new ForbiddenError('Brak uprawnień do tej delegacji');
  }

  return serializeDelegation(delegation);
}

// =====================
// Create delegation
// =====================

export async function createDelegation(
  prisma: PrismaClient,
  userId: string,
  input: CreateDelegationInput
) {
  const delegation = await prisma.delegation.create({
    data: {
      userId,
      type: input.type as any,
      status: 'DRAFT',
      purpose: input.purpose,
      destination: input.destination,
      departureAt: new Date(input.departureAt),
      returnAt: new Date(input.returnAt),
      transportType: input.transportType as any,
      vehicleType: input.vehicleType as any ?? null,
      transportNotes: input.transportNotes ?? null,
      accommodationType: input.accommodationType as any,
      advanceAmount: new Prisma.Decimal(input.advanceAmount),
      foreignCountry: input.foreignCountry ?? null,
      borderCrossingOut: input.borderCrossingOut ? new Date(input.borderCrossingOut) : null,
      borderCrossingIn: input.borderCrossingIn ? new Date(input.borderCrossingIn) : null,
      days: {
        create: input.days.map((day) => ({
          dayNumber: day.dayNumber,
          date: new Date(day.date),
          hoursInDay: 0, // Will be calculated when calculate is called
          breakfastProvided: day.breakfastProvided,
          lunchProvided: day.lunchProvided,
          dinnerProvided: day.dinnerProvided,
          accommodationType: day.accommodationType as any,
          accommodationCost: day.accommodationCost != null
            ? new Prisma.Decimal(day.accommodationCost)
            : null,
          isForeign: day.isForeign ?? false,
        })),
      },
      ...(input.mileageDetails
        ? {
            mileageDetails: {
              create: {
                vehicleType: input.mileageDetails.vehicleType as any,
                vehiclePlate: input.mileageDetails.vehiclePlate,
                distanceKm: new Prisma.Decimal(input.mileageDetails.distanceKm),
                ratePerKm: 0, // Will be set when calculation is run
                totalAmount: 0, // Will be set when calculation is run
              },
            },
          }
        : {}),
      ...(input.transportReceipts && input.transportReceipts.length > 0
        ? {
            transportReceipts: {
              create: input.transportReceipts.map((r) => ({
                description: r.description,
                amount: new Prisma.Decimal(r.amount),
                receiptNumber: r.receiptNumber ?? null,
              })),
            },
          }
        : {}),
      ...(input.additionalCosts && input.additionalCosts.length > 0
        ? {
            additionalCosts: {
              create: input.additionalCosts.map((c) => ({
                description: c.description,
                category: c.category,
                amount: new Prisma.Decimal(c.amount),
                receiptNumber: c.receiptNumber ?? null,
              })),
            },
          }
        : {}),
    },
    include: fullDelegationInclude,
  });

  return serializeDelegation(delegation);
}

// =====================
// Update delegation
// =====================

export async function updateDelegation(
  prisma: PrismaClient,
  delegationId: string,
  userId: string,
  role: string,
  input: UpdateDelegationInput
) {
  const existing = await prisma.delegation.findUnique({
    where: { id: delegationId },
    include: { days: true, mileageDetails: true, transportReceipts: true, additionalCosts: true },
  });

  if (!existing) {
    throw new NotFoundError('Delegacja nie znaleziona');
  }

  if (role !== 'ADMIN' && existing.userId !== userId) {
    throw new ForbiddenError('Brak uprawnień do tej delegacji');
  }

  if (existing.status !== 'DRAFT') {
    throw new ValidationError('Można edytować tylko delegacje w statusie Szkic');
  }

  // Build update data for the main delegation fields
  const updateData: Prisma.DelegationUpdateInput = {};

  if (input.purpose !== undefined) updateData.purpose = input.purpose;
  if (input.destination !== undefined) updateData.destination = input.destination;
  if (input.departureAt !== undefined) updateData.departureAt = new Date(input.departureAt);
  if (input.returnAt !== undefined) updateData.returnAt = new Date(input.returnAt);
  if (input.transportType !== undefined) updateData.transportType = input.transportType as any;
  if (input.vehicleType !== undefined) updateData.vehicleType = input.vehicleType as any ?? null;
  if (input.transportNotes !== undefined) updateData.transportNotes = input.transportNotes ?? null;
  if (input.accommodationType !== undefined) updateData.accommodationType = input.accommodationType as any;
  if (input.advanceAmount !== undefined) updateData.advanceAmount = new Prisma.Decimal(input.advanceAmount);
  if (input.type !== undefined) updateData.type = input.type as any;
  if (input.foreignCountry !== undefined) updateData.foreignCountry = input.foreignCountry ?? null;
  if (input.borderCrossingOut !== undefined) updateData.borderCrossingOut = input.borderCrossingOut ? new Date(input.borderCrossingOut) : null;
  if (input.borderCrossingIn !== undefined) updateData.borderCrossingIn = input.borderCrossingIn ? new Date(input.borderCrossingIn) : null;

  // Use a transaction to atomically update delegation + related records
  const updated = await prisma.$transaction(async (tx) => {
    // Update days if provided (delete old, create new)
    if (input.days) {
      await tx.delegationDay.deleteMany({ where: { delegationId } });
      await tx.delegationDay.createMany({
        data: input.days.map((day) => ({
          delegationId,
          dayNumber: day.dayNumber,
          date: new Date(day.date),
          hoursInDay: 0,
          breakfastProvided: day.breakfastProvided,
          lunchProvided: day.lunchProvided,
          dinnerProvided: day.dinnerProvided,
          accommodationType: day.accommodationType as any,
          accommodationCost: day.accommodationCost != null
            ? new Prisma.Decimal(day.accommodationCost)
            : null,
          isForeign: day.isForeign ?? false,
        })),
      });
    }

    // Update mileage details if provided
    if (input.mileageDetails !== undefined) {
      // Delete existing mileage details
      if (existing.mileageDetails) {
        await tx.mileageDetails.delete({
          where: { delegationId },
        });
      }
      // Create new if provided (not null)
      if (input.mileageDetails) {
        await tx.mileageDetails.create({
          data: {
            delegationId,
            vehicleType: input.mileageDetails.vehicleType as any,
            vehiclePlate: input.mileageDetails.vehiclePlate,
            distanceKm: new Prisma.Decimal(input.mileageDetails.distanceKm),
            ratePerKm: 0,
            totalAmount: 0,
          },
        });
      }
    }

    // Update transport receipts if provided
    if (input.transportReceipts !== undefined) {
      await tx.transportReceipt.deleteMany({ where: { delegationId } });
      if (input.transportReceipts.length > 0) {
        await tx.transportReceipt.createMany({
          data: input.transportReceipts.map((r) => ({
            delegationId,
            description: r.description,
            amount: new Prisma.Decimal(r.amount),
            receiptNumber: r.receiptNumber ?? null,
          })),
        });
      }
    }

    // Update additional costs if provided
    if (input.additionalCosts !== undefined) {
      await tx.additionalCost.deleteMany({ where: { delegationId } });
      if (input.additionalCosts.length > 0) {
        await tx.additionalCost.createMany({
          data: input.additionalCosts.map((c) => ({
            delegationId,
            description: c.description,
            category: c.category,
            amount: new Prisma.Decimal(c.amount),
            receiptNumber: c.receiptNumber ?? null,
          })),
        });
      }
    }

    // Update the main delegation record
    return tx.delegation.update({
      where: { id: delegationId },
      data: updateData,
      include: fullDelegationInclude,
    });
  });

  return serializeDelegation(updated);
}

// =====================
// Delete delegation
// =====================

export async function deleteDelegation(
  prisma: PrismaClient,
  delegationId: string,
  userId: string,
  role: string
) {
  const existing = await prisma.delegation.findUnique({
    where: { id: delegationId },
  });

  if (!existing) {
    throw new NotFoundError('Delegacja nie znaleziona');
  }

  if (role !== 'ADMIN' && existing.userId !== userId) {
    throw new ForbiddenError('Brak uprawnień do tej delegacji');
  }

  if (existing.status !== 'DRAFT') {
    throw new ValidationError('Można usunąć tylko delegacje w statusie Szkic');
  }

  await prisma.delegation.delete({ where: { id: delegationId } });
}

// =====================
// Submit delegation (DRAFT -> SUBMITTED)
// =====================

export async function submitDelegation(
  prisma: PrismaClient,
  delegationId: string,
  userId: string,
  role: string
) {
  const existing = await prisma.delegation.findUnique({
    where: { id: delegationId },
    include: fullDelegationInclude,
  });

  if (!existing) {
    throw new NotFoundError('Delegacja nie znaleziona');
  }

  if (role !== 'ADMIN' && existing.userId !== userId) {
    throw new ForbiddenError('Brak uprawnień do tej delegacji');
  }

  if (existing.status !== 'DRAFT') {
    throw new ValidationError('Można złożyć tylko delegację w statusie Szkic');
  }

  // Run calculation before submitting to freeze the computed amounts
  if (existing.type === 'FOREIGN') {
    // Foreign delegation uses the two-segment calculation
    const foreignInput = buildForeignCalculationInput(existing);
    const foreignResult = await calculateForeignDelegation(prisma, foreignInput);

    // Save calculated totals and per-day values
    const updated = await prisma.$transaction(async (tx) => {
      // Update domestic segment days
      for (const dayResult of foreignResult.diet.domesticDays) {
        const dayRecord = existing.days.find((d: any) => d.dayNumber === dayResult.dayNumber);
        if (dayRecord) {
          await tx.delegationDay.update({
            where: { id: dayRecord.id },
            data: {
              hoursInDay: new Prisma.Decimal(dayResult.hours),
              dietBase: new Prisma.Decimal(dayResult.baseAmount),
              dietDeductions: new Prisma.Decimal(dayResult.deductions.total),
              dietFinal: new Prisma.Decimal(dayResult.finalAmount),
              isForeign: false,
            },
          });
        }
      }

      // Update foreign segment days
      for (const dayResult of foreignResult.diet.foreignDays) {
        const dayRecord = existing.days.find((d: any) => d.dayNumber === dayResult.dayNumber);
        if (dayRecord) {
          await tx.delegationDay.update({
            where: { id: dayRecord.id },
            data: {
              hoursInDay: new Prisma.Decimal(dayResult.hours),
              dietBase: new Prisma.Decimal(dayResult.baseAmount),
              dietDeductions: new Prisma.Decimal(dayResult.deductions.total),
              dietFinal: new Prisma.Decimal(dayResult.finalAmount),
              isForeign: true,
            },
          });
        }
      }

      // Update mileage details with rate from DB
      if (foreignResult.transport.mileage && existing.mileageDetails) {
        await tx.mileageDetails.update({
          where: { delegationId },
          data: {
            ratePerKm: new Prisma.Decimal(foreignResult.transport.mileage.ratePerKm),
            totalAmount: new Prisma.Decimal(foreignResult.transport.mileage.total),
          },
        });
      }

      // Look up foreign rate ID to freeze it
      const foreignRate = await findForeignRate(prisma, foreignInput.foreignCountry, new Date(foreignInput.departureAt));

      // Update delegation totals and status
      return tx.delegation.update({
        where: { id: delegationId },
        data: {
          status: 'SUBMITTED',
          foreignRateId: foreignRate.id,
          foreignCurrency: foreignRate.currency,
          totalDiet: new Prisma.Decimal(foreignResult.summary.dietTotal),
          totalDomesticDiet: new Prisma.Decimal(foreignResult.summary.domesticDietTotal),
          totalForeignDiet: new Prisma.Decimal(foreignResult.summary.foreignDietTotal),
          totalAccommodation: new Prisma.Decimal(foreignResult.summary.accommodationTotal),
          totalTransport: new Prisma.Decimal(foreignResult.summary.transportTotal),
          totalAdditional: new Prisma.Decimal(foreignResult.summary.additionalTotal),
          grandTotal: new Prisma.Decimal(foreignResult.summary.grandTotal),
          amountDue: new Prisma.Decimal(foreignResult.summary.amountDue),
        },
        include: fullDelegationInclude,
      });
    });

    return serializeDelegation(updated);
  }

  // Domestic delegation - original logic
  const calcInput = buildCalculationInput(existing);
  const calcResult = await calculateDelegation(prisma, calcInput);

  // Save calculated totals and per-day values
  const updated = await prisma.$transaction(async (tx) => {
    // Update per-day diet values
    for (const dayResult of calcResult.diet.days) {
      const dayRecord = existing.days.find((d) => d.dayNumber === dayResult.dayNumber);
      if (dayRecord) {
        await tx.delegationDay.update({
          where: { id: dayRecord.id },
          data: {
            hoursInDay: new Prisma.Decimal(dayResult.hours),
            dietBase: new Prisma.Decimal(dayResult.baseAmount),
            dietDeductions: new Prisma.Decimal(dayResult.deductions.total),
            dietFinal: new Prisma.Decimal(dayResult.finalAmount),
          },
        });
      }
    }

    // Update mileage details with rate from DB
    if (calcResult.transport.mileage && existing.mileageDetails) {
      await tx.mileageDetails.update({
        where: { delegationId },
        data: {
          ratePerKm: new Prisma.Decimal(calcResult.transport.mileage.ratePerKm),
          totalAmount: new Prisma.Decimal(calcResult.transport.mileage.total),
        },
      });
    }

    // Update delegation totals and status
    return tx.delegation.update({
      where: { id: delegationId },
      data: {
        status: 'SUBMITTED',
        totalDiet: new Prisma.Decimal(calcResult.summary.dietTotal),
        totalAccommodation: new Prisma.Decimal(calcResult.summary.accommodationTotal),
        totalTransport: new Prisma.Decimal(calcResult.summary.transportTotal),
        totalAdditional: new Prisma.Decimal(calcResult.summary.additionalTotal),
        grandTotal: new Prisma.Decimal(calcResult.summary.grandTotal),
        amountDue: new Prisma.Decimal(calcResult.summary.amountDue),
      },
      include: fullDelegationInclude,
    });
  });

  return serializeDelegation(updated);
}

// =====================
// Settle delegation (SUBMITTED -> SETTLED, admin only)
// =====================

export async function settleDelegation(
  prisma: PrismaClient,
  delegationId: string,
  adminUserId: string
) {
  const existing = await prisma.delegation.findUnique({
    where: { id: delegationId },
  });

  if (!existing) {
    throw new NotFoundError('Delegacja nie znaleziona');
  }

  if (existing.status !== 'SUBMITTED') {
    throw new ValidationError('Można rozliczyć tylko delegację w statusie Złożona');
  }

  const updated = await prisma.delegation.update({
    where: { id: delegationId },
    data: {
      status: 'SETTLED',
      settledAt: new Date(),
      settledBy: adminUserId,
    },
    include: fullDelegationInclude,
  });

  return serializeDelegation(updated);
}

// =====================
// Reopen delegation (SETTLED -> DRAFT, admin only)
// =====================

export async function reopenDelegation(
  prisma: PrismaClient,
  delegationId: string
) {
  const existing = await prisma.delegation.findUnique({
    where: { id: delegationId },
  });

  if (!existing) {
    throw new NotFoundError('Delegacja nie znaleziona');
  }

  if (existing.status !== 'SETTLED') {
    throw new ValidationError('Można cofnąć tylko delegację w statusie Rozliczona');
  }

  const updated = await prisma.delegation.update({
    where: { id: delegationId },
    data: {
      status: 'DRAFT',
      settledAt: null,
      settledBy: null,
      // Clear calculated totals so they can be recalculated
      totalDiet: null,
      totalAccommodation: null,
      totalTransport: null,
      totalAdditional: null,
      grandTotal: null,
      amountDue: null,
    },
    include: fullDelegationInclude,
  });

  return serializeDelegation(updated);
}

// =====================
// Calculate delegation (does NOT save, returns result)
// =====================

export async function calculateDelegationForPreview(
  prisma: PrismaClient,
  delegationId: string,
  userId: string,
  role: string
): Promise<CalculationResult> {
  const delegation = await prisma.delegation.findUnique({
    where: { id: delegationId },
    include: {
      days: { orderBy: { dayNumber: 'asc' } },
      mileageDetails: true,
      transportReceipts: true,
      additionalCosts: true,
    },
  });

  if (!delegation) {
    throw new NotFoundError('Delegacja nie znaleziona');
  }

  if (role !== 'ADMIN' && delegation.userId !== userId) {
    throw new ForbiddenError('Brak uprawnień do tej delegacji');
  }

  if (delegation.type === 'FOREIGN') {
    const foreignInput = buildForeignCalculationInput(delegation);
    return calculateForeignDelegation(prisma, foreignInput) as any;
  }

  const calcInput = buildCalculationInput(delegation);
  return calculateDelegation(prisma, calcInput);
}

// =====================
// Helper: Build CalculationInput from a Prisma delegation record
// =====================

function buildCalculationInput(delegation: any): CalculationInput {
  return {
    departureAt: delegation.departureAt.toISOString(),
    returnAt: delegation.returnAt.toISOString(),
    transportType: delegation.transportType,
    vehicleType: delegation.vehicleType,
    advanceAmount: Number(delegation.advanceAmount?.toString() ?? '0'),
    days: delegation.days.map((d: any) => ({
      dayNumber: d.dayNumber,
      date: d.date.toISOString().split('T')[0],
      breakfastProvided: d.breakfastProvided,
      lunchProvided: d.lunchProvided,
      dinnerProvided: d.dinnerProvided,
      accommodationType: d.accommodationType,
      accommodationCost: d.accommodationCost ? Number(d.accommodationCost.toString()) : null,
    })),
    mileageDetails: delegation.mileageDetails
      ? {
          vehicleType: delegation.mileageDetails.vehicleType,
          vehiclePlate: delegation.mileageDetails.vehiclePlate,
          distanceKm: Number(delegation.mileageDetails.distanceKm.toString()),
        }
      : null,
    transportReceipts: (delegation.transportReceipts ?? []).map((r: any) => ({
      description: r.description,
      amount: Number(r.amount.toString()),
      receiptNumber: r.receiptNumber,
    })),
    additionalCosts: (delegation.additionalCosts ?? []).map((c: any) => ({
      description: c.description,
      category: c.category,
      amount: Number(c.amount.toString()),
      receiptNumber: c.receiptNumber,
    })),
  };
}

// =====================
// Helper: Build ForeignDelegationInput from a Prisma delegation record
// =====================

function buildForeignCalculationInput(delegation: any): ForeignDelegationInput {
  return {
    departureAt: delegation.departureAt.toISOString(),
    returnAt: delegation.returnAt.toISOString(),
    borderCrossingOut: delegation.borderCrossingOut?.toISOString() ?? delegation.departureAt.toISOString(),
    borderCrossingIn: delegation.borderCrossingIn?.toISOString() ?? delegation.returnAt.toISOString(),
    foreignCountry: delegation.foreignCountry ?? '',
    transportType: delegation.transportType,
    vehicleType: delegation.vehicleType,
    advanceAmount: Number(delegation.advanceAmount?.toString() ?? '0'),
    days: delegation.days.map((d: any) => ({
      dayNumber: d.dayNumber,
      date: d.date.toISOString().split('T')[0],
      isForeign: d.isForeign ?? false,
      breakfastProvided: d.breakfastProvided,
      lunchProvided: d.lunchProvided,
      dinnerProvided: d.dinnerProvided,
      accommodationType: d.accommodationType,
      accommodationCost: d.accommodationCost ? Number(d.accommodationCost.toString()) : null,
    })),
    mileageDetails: delegation.mileageDetails
      ? {
          vehicleType: delegation.mileageDetails.vehicleType,
          vehiclePlate: delegation.mileageDetails.vehiclePlate,
          distanceKm: Number(delegation.mileageDetails.distanceKm.toString()),
        }
      : null,
    transportReceipts: (delegation.transportReceipts ?? []).map((r: any) => ({
      description: r.description,
      amount: Number(r.amount.toString()),
      receiptNumber: r.receiptNumber,
    })),
    additionalCosts: (delegation.additionalCosts ?? []).map((c: any) => ({
      description: c.description,
      category: c.category,
      amount: Number(c.amount.toString()),
      receiptNumber: c.receiptNumber,
    })),
  };
}
