import { differenceInMinutes } from 'date-fns';

export interface DurationBreakdown {
  totalMinutes: number;
  totalHours: number;
  fullDays: number;
  remainingHours: number;
}

export function calculateDuration(departureAt: Date, returnAt: Date): DurationBreakdown {
  const totalMinutes = differenceInMinutes(returnAt, departureAt);
  const totalHours = totalMinutes / 60;
  const fullDays = Math.floor(totalHours / 24);
  const remainingHours = totalHours - fullDays * 24;

  return { totalMinutes, totalHours, fullDays, remainingHours };
}
