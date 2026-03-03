import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fetchNbpRate } from '../src/modules/nbp/nbp.service.js';

// Mock global fetch
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

function nbpResponse(code: string, rates: Array<{ no: string; effectiveDate: string; mid: number }>) {
  return {
    ok: true,
    json: async () => ({
      table: 'A',
      currency: code.toLowerCase(),
      code,
      rates,
    }),
  };
}

function nbp404() {
  return { ok: false, status: 404, statusText: 'Not Found' };
}

describe('NBP exchange rate service', () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ========== PLN handling ==========

  it('returns rate 1.0 for PLN without calling API', async () => {
    const result = await fetchNbpRate('PLN', new Date('2026-03-03'));
    expect(result.currency).toBe('PLN');
    expect(result.rate).toBe(1.0);
    expect(result.tableNo).toBe('N/A');
    expect(result.effectiveDate).toBe('2026-03-03');
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('handles lowercase pln', async () => {
    const result = await fetchNbpRate('pln', new Date('2026-03-03'));
    expect(result.currency).toBe('PLN');
    expect(result.rate).toBe(1.0);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  // ========== Exact date fetch ==========

  it('fetches EUR rate for exact date', async () => {
    mockFetch.mockResolvedValueOnce(
      nbpResponse('EUR', [{ no: '042/A/NBP/2026', effectiveDate: '2026-03-03', mid: 4.2732 }])
    );

    const result = await fetchNbpRate('EUR', new Date('2026-03-03'));
    expect(result.currency).toBe('EUR');
    expect(result.rate).toBe(4.2732);
    expect(result.effectiveDate).toBe('2026-03-03');
    expect(result.tableNo).toBe('042/A/NBP/2026');

    // Should have been called with the exact date URL
    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(mockFetch.mock.calls[0][0]).toContain('/EUR/2026-03-03/');
  });

  it('normalizes currency code to uppercase', async () => {
    mockFetch.mockResolvedValueOnce(
      nbpResponse('GBP', [{ no: '042/A/NBP/2026', effectiveDate: '2026-03-03', mid: 5.123 }])
    );

    const result = await fetchNbpRate('gbp', new Date('2026-03-03'));
    expect(result.currency).toBe('GBP');
    expect(result.rate).toBe(5.123);
    expect(mockFetch.mock.calls[0][0]).toContain('/GBP/');
  });

  // ========== Fallback to date range ==========

  it('falls back to date range when exact date returns 404 (weekend/holiday)', async () => {
    // First call: exact date → 404
    mockFetch.mockResolvedValueOnce(nbp404());
    // Second call: range → success with last available rate
    mockFetch.mockResolvedValueOnce(
      nbpResponse('EUR', [
        { no: '040/A/NBP/2026', effectiveDate: '2026-02-27', mid: 4.2500 },
        { no: '041/A/NBP/2026', effectiveDate: '2026-02-28', mid: 4.2600 },
      ])
    );

    const result = await fetchNbpRate('EUR', new Date('2026-03-01')); // Saturday
    expect(result.currency).toBe('EUR');
    expect(result.rate).toBe(4.2600); // Last rate in range (Friday)
    expect(result.effectiveDate).toBe('2026-02-28');
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it('uses the LAST rate in range (most recent)', async () => {
    mockFetch.mockResolvedValueOnce(nbp404());
    mockFetch.mockResolvedValueOnce(
      nbpResponse('USD', [
        { no: '038/A/NBP/2026', effectiveDate: '2026-02-25', mid: 3.900 },
        { no: '039/A/NBP/2026', effectiveDate: '2026-02-26', mid: 3.910 },
        { no: '040/A/NBP/2026', effectiveDate: '2026-02-27', mid: 3.920 },
      ])
    );

    const result = await fetchNbpRate('USD', new Date('2026-03-01'));
    expect(result.rate).toBe(3.920);
    expect(result.effectiveDate).toBe('2026-02-27');
  });

  // ========== Error handling ==========

  it('throws when both exact date and range fail', async () => {
    mockFetch.mockResolvedValueOnce(nbp404());
    mockFetch.mockResolvedValueOnce(nbp404());

    await expect(fetchNbpRate('XYZ', new Date('2026-03-03'))).rejects.toThrow(
      'Failed to fetch NBP rate for XYZ'
    );
  });

  it('throws when range returns empty rates array', async () => {
    mockFetch.mockResolvedValueOnce(nbp404());
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ table: 'A', currency: 'eur', code: 'EUR', rates: [] }),
    });

    await expect(fetchNbpRate('EUR', new Date('2026-03-03'))).rejects.toThrow(
      'No NBP rates found'
    );
  });

  // ========== Date formatting ==========

  it('formats single-digit months and days with zero padding', async () => {
    mockFetch.mockResolvedValueOnce(
      nbpResponse('CHF', [{ no: '005/A/NBP/2026', effectiveDate: '2026-01-08', mid: 4.5 }])
    );

    await fetchNbpRate('CHF', new Date('2026-01-08'));
    expect(mockFetch.mock.calls[0][0]).toContain('/CHF/2026-01-08/');
  });

  // ========== Various currencies ==========

  it('handles NOK (Norwegian Krone)', async () => {
    mockFetch.mockResolvedValueOnce(
      nbpResponse('NOK', [{ no: '042/A/NBP/2026', effectiveDate: '2026-03-03', mid: 0.3812 }])
    );

    const result = await fetchNbpRate('NOK', new Date('2026-03-03'));
    expect(result.currency).toBe('NOK');
    expect(result.rate).toBe(0.3812);
  });

  it('handles JPY (Japanese Yen)', async () => {
    mockFetch.mockResolvedValueOnce(
      nbpResponse('JPY', [{ no: '042/A/NBP/2026', effectiveDate: '2026-03-03', mid: 0.0283 }])
    );

    const result = await fetchNbpRate('JPY', new Date('2026-03-03'));
    expect(result.currency).toBe('JPY');
    expect(result.rate).toBe(0.0283);
  });
});
