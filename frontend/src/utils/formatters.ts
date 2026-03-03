import { format, parseISO } from 'date-fns';
import { pl } from 'date-fns/locale';

const currencyFormatter = new Intl.NumberFormat('pl-PL', {
  style: 'currency',
  currency: 'PLN',
});

export function formatCurrency(value: string | number): string {
  const numericValue = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(numericValue)) return '0,00 zł';
  return currencyFormatter.format(numericValue);
}

export function formatDate(date: string): string {
  try {
    return format(parseISO(date), 'dd.MM.yyyy', { locale: pl });
  } catch {
    return date;
  }
}

export function formatDateTime(date: string): string {
  try {
    return format(parseISO(date), 'dd.MM.yyyy HH:mm', { locale: pl });
  } catch {
    return date;
  }
}
