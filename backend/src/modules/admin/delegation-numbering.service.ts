import { PrismaClient } from '@prisma/client';
import { DELEGATION_NUMBER_COUNTER_KEY, formatDelegationNumber } from '../../utils/delegation-number.js';

async function ensureCounter(prisma: PrismaClient) {
  return prisma.delegationNumberCounter.upsert({
    where: { key: DELEGATION_NUMBER_COUNTER_KEY },
    update: {},
    create: {
      key: DELEGATION_NUMBER_COUNTER_KEY,
      nextValue: 1,
    },
    select: { nextValue: true },
  });
}

export async function getDelegationNumbering(prisma: PrismaClient) {
  const counter = await ensureCounter(prisma);

  return {
    nextNumber: counter.nextValue,
    previewNumber: formatDelegationNumber(counter.nextValue, new Date()),
  };
}

export async function resetDelegationNumbering(prisma: PrismaClient, nextNumber: number) {
  const counter = await prisma.delegationNumberCounter.upsert({
    where: { key: DELEGATION_NUMBER_COUNTER_KEY },
    update: {
      nextValue: nextNumber,
    },
    create: {
      key: DELEGATION_NUMBER_COUNTER_KEY,
      nextValue: nextNumber,
    },
    select: { nextValue: true },
  });

  return {
    nextNumber: counter.nextValue,
    previewNumber: formatDelegationNumber(counter.nextValue, new Date()),
  };
}
