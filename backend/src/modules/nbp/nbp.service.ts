/**
 * NBP (National Bank of Poland) exchange rate service.
 * Fetches average exchange rates from NBP API Table A.
 *
 * API docs: https://api.nbp.pl/
 *
 * Rules for foreign delegations:
 * - Use average rate (tabela A) from the date of settlement
 * - If no rate for that date (weekend/holiday), use the last available rate before that date
 * - PLN currency doesn't need conversion (rate = 1.0)
 */

export interface NbpExchangeRate {
  currency: string;
  rate: number;         // mid rate
  effectiveDate: string; // YYYY-MM-DD
  tableNo: string;       // e.g. "042/A/NBP/2026"
}

/**
 * Fetch NBP average exchange rate for a currency on a specific date.
 * If the date has no published rate, fetches the most recent rate before that date.
 */
export async function fetchNbpRate(
  currencyCode: string,
  date: Date
): Promise<NbpExchangeRate> {
  // PLN doesn't need conversion
  if (currencyCode.toUpperCase() === 'PLN') {
    const dateStr = formatDate(date);
    return {
      currency: 'PLN',
      rate: 1.0,
      effectiveDate: dateStr,
      tableNo: 'N/A',
    };
  }

  const code = currencyCode.toUpperCase();
  const dateStr = formatDate(date);

  // First try exact date
  try {
    const result = await fetchFromNbp(`https://api.nbp.pl/api/exchangerates/rates/a/${code}/${dateStr}/?format=json`);
    return result;
  } catch {
    // Date might be weekend/holiday — fetch last N days to find the most recent
  }

  // Fallback: fetch last 10 trading days to find the most recent rate before the target date
  // NBP API supports date range queries
  const startDate = new Date(date);
  startDate.setDate(startDate.getDate() - 14); // go back 14 calendar days to cover holidays
  const startStr = formatDate(startDate);

  try {
    const url = `https://api.nbp.pl/api/exchangerates/rates/a/${code}/${startStr}/${dateStr}/?format=json`;
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`NBP API error: ${response.status} ${response.statusText} for ${code} in range ${startStr}..${dateStr}`);
    }

    const data = await response.json() as NbpApiResponse;

    if (!data.rates || data.rates.length === 0) {
      throw new Error(`No NBP rates found for ${code} between ${startStr} and ${dateStr}`);
    }

    // Get the most recent rate (last in the array)
    const lastRate = data.rates[data.rates.length - 1];
    return {
      currency: code,
      rate: lastRate.mid,
      effectiveDate: lastRate.effectiveDate,
      tableNo: lastRate.no,
    };
  } catch (error: any) {
    throw new Error(`Failed to fetch NBP rate for ${code}: ${error.message}`);
  }
}

// Internal types for NBP API response
interface NbpApiRate {
  no: string;
  effectiveDate: string;
  mid: number;
}

interface NbpApiResponse {
  table: string;
  currency: string;
  code: string;
  rates: NbpApiRate[];
}

async function fetchFromNbp(url: string): Promise<NbpExchangeRate> {
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`NBP API error: ${response.status}`);
  }

  const data = await response.json() as NbpApiResponse;
  const rate = data.rates[0];

  return {
    currency: data.code,
    rate: rate.mid,
    effectiveDate: rate.effectiveDate,
    tableNo: rate.no,
  };
}

function formatDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}
