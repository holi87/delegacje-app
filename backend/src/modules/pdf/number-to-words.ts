/**
 * Polish number-to-words converter for monetary amounts.
 * Handles amounts up to 999 999,99 PLN.
 *
 * Output format examples:
 *   1 101.25 => "jeden tysiac sto jeden zl 25/100"
 *   0.50     => "zero zl 50/100"
 *   45.00    => "czterdziesci piec zl 00/100"
 */

const ONES = [
  '', 'jeden', 'dwa', 'trzy', 'cztery', 'piec', 'szesc',
  'siedem', 'osiem', 'dziewiec',
];

const TEENS = [
  'dziesiec', 'jedenascie', 'dwanascie', 'trzynascie', 'czternascie',
  'pietnascie', 'szesnascie', 'siedemnascie', 'osiemnascie', 'dziewietnascie',
];

const TENS = [
  '', 'dziesiec', 'dwadziescia', 'trzydziesci', 'czterdziesci',
  'piecdziesiat', 'szescdziesiat', 'siedemdziesiat', 'osiemdziesiat',
  'dziewiecdziesiat',
];

const HUNDREDS = [
  '', 'sto', 'dwiescie', 'trzysta', 'czterysta', 'piecset',
  'szescset', 'siedemset', 'osiemset', 'dziewiecset',
];

/**
 * Determine the correct Polish plural form for "tysiac" (thousand).
 *
 * Polish rules:
 *   1           => "tysiac"
 *   2-4         => "tysiace"  (but not 12-14)
 *   5-21        => "tysiecy"
 *   22-24       => "tysiace"
 *   25-31       => "tysiecy"
 *   ... and so on (last two digits determine form)
 */
function thousandForm(n: number): string {
  if (n === 1) return 'tysiac';

  const lastTwo = n % 100;
  const lastOne = n % 10;

  // Teens (11-19) always get "tysiecy"
  if (lastTwo >= 12 && lastTwo <= 14) return 'tysiecy';

  // 2, 3, 4 (and 22-24, 32-34, etc.) get "tysiace"
  if (lastOne >= 2 && lastOne <= 4) return 'tysiace';

  // Everything else gets "tysiecy"
  return 'tysiecy';
}

/**
 * Convert a number 0-999 to Polish words.
 */
function convertGroup(n: number): string {
  if (n === 0) return '';

  const parts: string[] = [];

  const h = Math.floor(n / 100);
  const remainder = n % 100;
  const t = Math.floor(remainder / 10);
  const o = remainder % 10;

  if (h > 0) {
    parts.push(HUNDREDS[h]);
  }

  if (remainder >= 10 && remainder <= 19) {
    parts.push(TEENS[remainder - 10]);
  } else {
    if (t > 0) {
      parts.push(TENS[t]);
    }
    if (o > 0) {
      parts.push(ONES[o]);
    }
  }

  return parts.join(' ');
}

/**
 * Convert a monetary amount (in PLN) to Polish words.
 *
 * @param amount - The amount as a number (e.g. 1101.25)
 * @returns Polish words string, e.g. "jeden tysiac sto jeden zl 25/100"
 *
 * Supports amounts from 0.00 to 999 999.99.
 * For negative amounts, prepends "minus".
 */
export function amountToWords(amount: number): string {
  const isNegative = amount < 0;
  const absAmount = Math.abs(amount);

  // Split into zloty and grosze
  const totalGrosze = Math.round(absAmount * 100);
  const zloty = Math.floor(totalGrosze / 100);
  const grosze = totalGrosze % 100;

  if (zloty > 999999) {
    // Fallback for amounts exceeding supported range
    return `${isNegative ? 'minus ' : ''}${zloty} zl ${grosze.toString().padStart(2, '0')}/100`;
  }

  let words: string;

  if (zloty === 0) {
    words = 'zero';
  } else {
    const thousands = Math.floor(zloty / 1000);
    const remainder = zloty % 1000;

    const parts: string[] = [];

    if (thousands > 0) {
      if (thousands === 1) {
        parts.push('jeden tysiac');
      } else {
        const thousandWords = convertGroup(thousands);
        parts.push(`${thousandWords} ${thousandForm(thousands)}`);
      }
    }

    if (remainder > 0) {
      parts.push(convertGroup(remainder));
    }

    words = parts.join(' ');
  }

  const prefix = isNegative ? 'minus ' : '';
  const groszeStr = grosze.toString().padStart(2, '0');

  return `${prefix}${words} zl ${groszeStr}/100`;
}
