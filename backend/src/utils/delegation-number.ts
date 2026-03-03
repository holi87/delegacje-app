export const DELEGATION_NUMBER_COUNTER_KEY = 'delegation';
export const DELEGATION_NUMBER_MAX_LENGTH = 64;

/**
 * Human-readable delegation number used in UI/PDF.
 * Example: 0001/DEL/2026
 */
export function formatDelegationNumber(
  numericNumber: number | null | undefined,
  createdAt: Date | string | null | undefined
): string | null {
  if (numericNumber == null) return null;

  const created = createdAt instanceof Date ? createdAt : createdAt ? new Date(createdAt) : null;
  const year = created && !Number.isNaN(created.getTime())
    ? created.getFullYear()
    : new Date().getFullYear();

  return `${String(numericNumber).padStart(4, '0')}/DEL/${year}`;
}

export function normalizeDelegationNumber(
  value: string | null | undefined
): string | null {
  if (value == null) return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}
