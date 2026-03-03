/**
 * Polish number-to-words converter for monetary amounts.
 * Handles amounts up to 999 999,99 PLN.
 *
 * Output format examples:
 *   1 101.25 => "jeden tysiąc sto jeden zł 25/100"
 *   0.50     => "zero zł 50/100"
 *   45.00    => "czterdzieści pięć zł 00/100"
 */

const ONES = [
  '', 'jeden', 'dwa', 'trzy', 'cztery', 'pięć', 'sześć',
  'siedem', 'osiem', 'dziewięć',
];

const TEENS = [
  'dziesięć', 'jedenaście', 'dwanaście', 'trzynaście', 'czternaście',
  'piętnaście', 'szesnaście', 'siedemnaście', 'osiemnaście', 'dziewiętnaście',
];

const TENS = [
  '', 'dziesięć', 'dwadzieścia', 'trzydzieści', 'czterdzieści',
  'pięćdziesiąt', 'sześćdziesiąt', 'siedemdziesiąt', 'osiemdziesiąt',
  'dziewięćdziesiąt',
];

const HUNDREDS = [
  '', 'sto', 'dwieście', 'trzysta', 'czterysta', 'pięćset',
  'sześćset', 'siedemset', 'osiemset', 'dziewięćset',
];

/**
 * Determine the correct Polish plural form for "tysiąc" (thousand).
 *
 * Polish rules:
 *   1           => "tysiąc"
 *   2-4         => "tysiące"  (but not 12-14)
 *   5-21        => "tysięcy"
 *   22-24       => "tysiące"
 *   25-31       => "tysięcy"
 *   ... and so on (last two digits determine form)
 */
function thousandForm(n: number): string {
  if (n === 1) return 'tysiąc';

  const lastTwo = n % 100;
  const lastOne = n % 10;

  // Teens (11-19) always get "tysięcy"
  if (lastTwo >= 12 && lastTwo <= 14) return 'tysięcy';

  // 2, 3, 4 (and 22-24, 32-34, etc.) get "tysiące"
  if (lastOne >= 2 && lastOne <= 4) return 'tysiące';

  // Everything else gets "tysięcy"
  return 'tysięcy';
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
 * @returns Polish words string, e.g. "jeden tysiąc sto jeden zł 25/100"
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
    return `${isNegative ? 'minus ' : ''}${zloty} zł ${grosze.toString().padStart(2, '0')}/100`;
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
        parts.push('jeden tysiąc');
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

  return `${prefix}${words} zł ${groszeStr}/100`;
}
