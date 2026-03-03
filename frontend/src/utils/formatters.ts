import { format, parseISO } from 'date-fns';
import { pl } from 'date-fns/locale';

const currencyFormatter = new Intl.NumberFormat('pl-PL', {
  style: 'currency',
  currency: 'PLN',
});

function parseAmount(value: string | number): number {
  return typeof value === 'string' ? parseFloat(value) : value;
}

export function formatCurrency(value: string | number): string {
  const numericValue = parseAmount(value);
  if (isNaN(numericValue)) return '0,00 zł';
  return currencyFormatter.format(numericValue);
}

export function formatCurrencyByCode(
  value: string | number,
  currency: string
): string {
  const code = (currency || 'PLN').toUpperCase();
  const numericValue = parseAmount(value);
  if (isNaN(numericValue)) {
    return code === 'PLN' ? '0,00 zł' : `0,00 ${code}`;
  }

  if (code === 'PLN') {
    return formatCurrency(numericValue);
  }

  try {
    return new Intl.NumberFormat('pl-PL', {
      style: 'currency',
      currency: code,
      currencyDisplay: 'code',
    }).format(numericValue);
  } catch {
    return `${numericValue.toLocaleString('pl-PL', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })} ${code}`;
  }
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
