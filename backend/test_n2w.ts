import { amountToWords } from '../src/modules/pdf/number-to-words.js';

const tests: [number, string][] = [
  [0, 'zero zl 00/100'],
  [1, 'jeden zl 00/100'],
  [45, 'czterdziesci piec zl 00/100'],
  [22.50, 'dwadziescia dwa zl 50/100'],
  [100, 'sto zl 00/100'],
  [101.25, 'sto jeden zl 25/100'],
  [1101.25, 'jeden tysiac sto jeden zl 25/100'],
  [1601.25, 'jeden tysiac szescset jeden zl 25/100'],
  [2000, 'dwa tysiace zl 00/100'],
  [5000, 'piec tysiecy zl 00/100'],
  [12345.67, 'dwanascie tysiecy trzysta czterdziesci piec zl 67/100'],
  [0.50, 'zero zl 50/100'],
  [-150.00, 'minus sto piecdziesiat zl 00/100'],
  [500, 'piecset zl 00/100'],
  [713, 'siedemset trzynascie zl 00/100'],
];

let passed = 0;
let failed = 0;

for (const [input, expected] of tests) {
  const result = amountToWords(input);
  if (result === expected) {
    passed++;
  } else {
    failed++;
    console.log('FAIL:', input, '=> got:', JSON.stringify(result), '| expected:', JSON.stringify(expected));
  }
}

console.log(`Passed: ${passed} / Failed: ${failed}`);
