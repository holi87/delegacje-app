import { PrismaClient } from '@prisma/client';
import type { Decimal } from '@prisma/client/runtime/library';
import PDFDocument from 'pdfkit';
import { format } from 'date-fns';
import { existsSync } from 'node:fs';
import { amountToWords } from './number-to-words.js';
import { formatDelegationNumber } from '../../utils/delegation-number.js';

// =====================
// Types
// =====================

interface UserProfileData {
  firstName: string;
  lastName: string;
  position: string;
}

interface DelegationDayData {
  dayNumber: number;
  date: Date;
  hoursInDay: Decimal;
  breakfastProvided: boolean;
  lunchProvided: boolean;
  dinnerProvided: boolean;
  accommodationType: string;
  accommodationCost: Decimal | null;
  accommodationReceiptNumber: string | null;
  dietBase: Decimal | null;
  dietDeductions: Decimal | null;
  dietFinal: Decimal | null;
  isForeign: boolean;
  dietRate: Decimal | null;
}

interface MileageData {
  vehicleType: string;
  vehiclePlate: string;
  distanceKm: Decimal;
  ratePerKm: Decimal;
  totalAmount: Decimal;
}

interface TransportReceiptData {
  description: string;
  amount: Decimal;
  receiptNumber: string | null;
}

interface AdditionalCostData {
  description: string;
  amount: Decimal;
  receiptNumber: string | null;
}

interface CompanyData {
  name: string;
  nip: string;
  address: string;
  city: string;
  postalCode: string;
}

interface DelegationData {
  id: string;
  number: number;
  numberLabel: string;
  purpose: string;
  destination: string;
  departureAt: Date;
  returnAt: Date;
  transportType: string;
  vehicleType: string | null;
  accommodationType: string;
  advanceAmount: Decimal;
  totalDiet: Decimal | null;
  totalAccommodation: Decimal | null;
  totalTransport: Decimal | null;
  totalAdditional: Decimal | null;
  grandTotal: Decimal | null;
  amountDue: Decimal | null;
  type: string;
  foreignCountry: string | null;
  foreignCurrency: string | null;
  borderCrossingOut: Date | null;
  borderCrossingIn: Date | null;
  totalDomesticDiet: Decimal | null;
  totalForeignDiet: Decimal | null;
  exchangeRate: Decimal | null;
  exchangeRateDate: Date | null;
  exchangeRateTable: string | null;
  createdAt: Date;
  user: {
    profile: UserProfileData | null;
  };
  days: DelegationDayData[];
  mileageDetails: MileageData | null;
  transportReceipts: TransportReceiptData[];
  additionalCosts: AdditionalCostData[];
}

// =====================
// Formatting helpers
// =====================

/** Convert Prisma Decimal to JS number. */
function d2n(value: Decimal | number | string | null | undefined): number {
  if (value == null) return 0;
  if (typeof value === 'number') return value;
  return Number(value.toString());
}

/**
 * Format a number as Polish currency string.
 * Uses comma as decimal separator, space as thousands separator.
 * Example: 1234.56 => "1 234,56 zł"
 */
function formatPLN(amount: number): string {
  const fixed = Math.abs(amount).toFixed(2);
  const [intPart, decPart] = fixed.split('.');
  // Add space as thousands separator
  const withSeparator = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  const sign = amount < 0 ? '-' : '';
  return `${sign}${withSeparator},${decPart} zł`;
}

/**
 * Format a number as a plain decimal string with comma separator.
 * Example: 1234.56 => "1 234,56"
 */
function formatDecimal(amount: number, decimals = 2): string {
  const fixed = Math.abs(amount).toFixed(decimals);
  const [intPart, decPart] = fixed.split('.');
  const withSeparator = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  const sign = amount < 0 ? '-' : '';
  return `${sign}${withSeparator},${decPart}`;
}

function formatAmountByCurrency(amount: number, currency: string | null | undefined): string {
  const code = (currency ?? 'PLN').toUpperCase();
  if (code === 'PLN') {
    return formatPLN(amount);
  }
  return `${formatDecimal(amount)} ${code}`;
}

function formatMixedCurrency(
  plnAmount: number,
  foreignAmount: number,
  foreignCurrency: string | null | undefined
): string {
  const parts: string[] = [];
  if (Math.abs(plnAmount) > 0.00001) {
    parts.push(formatPLN(plnAmount));
  }
  if (Math.abs(foreignAmount) > 0.00001) {
    parts.push(formatAmountByCurrency(foreignAmount, foreignCurrency));
  }
  if (parts.length === 0) {
    return '0,00';
  }
  return parts.join(' + ');
}

/** Format date as DD.MM.YYYY */
function formatDate(date: Date): string {
  return format(date, 'dd.MM.yyyy');
}

/** Format datetime as DD.MM.YYYY, godz. HH:MM */
function formatDateTime(date: Date): string {
  return `${format(date, 'dd.MM.yyyy')}, godz. ${format(date, 'HH:mm')}`;
}

/** Format datetime in a specific IANA timezone as DD.MM.YYYY, HH:MM */
function formatDateTimeInTimezone(
  date: Date,
  timeZone: string
): string {
  const parts = new Intl.DateTimeFormat('pl-PL', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(date);

  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === type)?.value ?? '';

  return `${get('day')}.${get('month')}.${get('year')}, ${get('hour')}:${get('minute')}`;
}

function getDelegationNumberLabel(delegation: DelegationData): string {
  return delegation.numberLabel ?? formatDelegationNumber(delegation.number, delegation.createdAt) ?? delegation.id;
}

/** Get human-readable transport type label. */
function transportTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    COMPANY_VEHICLE: 'Pojazd służbowy',
    PUBLIC_TRANSPORT: 'Transport publiczny (bilety)',
    PRIVATE_VEHICLE: 'Samochód prywatny (kilometrówka)',
    MIXED: 'Mieszany (kilometrówka + bilety)',
  };
  return labels[type] ?? type;
}

/** Get human-readable vehicle type label. */
function vehicleTypeLabel(type: string | null): string {
  if (!type) return '';
  const labels: Record<string, string> = {
    CAR_ABOVE_900: 'Samochód osobowy > 900 cm3',
    CAR_BELOW_900: 'Samochód osobowy <= 900 cm3',
    MOTORCYCLE: 'Motocykl',
    MOPED: 'Motorower',
  };
  return labels[type] ?? type;
}

/** Get human-readable accommodation type label. */
function accommodationTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    RECEIPT: 'Wg rachunku',
    LUMP_SUM: 'Ryczałt',
    FREE: 'Bezpłatnie',
    NONE: 'Brak',
  };
  return labels[type] ?? type;
}

/** Format duration as "X dob i Y godzin" */
function formatDuration(departureAt: Date, returnAt: Date): string {
  const totalMinutes = (returnAt.getTime() - departureAt.getTime()) / (1000 * 60);
  const totalHours = totalMinutes / 60;
  const fullDays = Math.floor(totalHours / 24);
  const remainingHours = Math.round((totalHours - fullDays * 24) * 10) / 10;

  const parts: string[] = [];
  if (fullDays > 0) {
    if (fullDays === 1) {
      parts.push('1 doba');
    } else if (fullDays >= 2 && fullDays <= 4) {
      parts.push(`${fullDays} doby`);
    } else {
      parts.push(`${fullDays} dob`);
    }
  }
  if (remainingHours > 0) {
    parts.push(`${formatDecimal(remainingHours, 1)} godzin`);
  }
  if (parts.length === 0) {
    return '0 godzin';
  }
  return parts.join(' i ');
}

// =====================
// PDF Layout constants
// =====================

const PAGE_WIDTH = 595.28; // A4 points
const PAGE_HEIGHT = 841.89;
const MARGIN = 56.69; // ~20mm in points
const CONTENT_WIDTH = PAGE_WIDTH - 2 * MARGIN;

const FONT_NORMAL = [
  '/usr/share/fonts/dejavu/DejaVuSans.ttf',
  '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',
  '/usr/share/fonts/ttf-dejavu/DejaVuSans.ttf',
  '/usr/share/fonts/TTF/DejaVuSans.ttf',
  '/System/Library/Fonts/Supplemental/Arial.ttf',
].find((p) => existsSync(p)) ?? 'Helvetica';
const FONT_BOLD = [
  '/usr/share/fonts/dejavu/DejaVuSans-Bold.ttf',
  '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf',
  '/usr/share/fonts/ttf-dejavu/DejaVuSans-Bold.ttf',
  '/usr/share/fonts/TTF/DejaVuSans-Bold.ttf',
  '/System/Library/Fonts/Supplemental/Arial Bold.ttf',
].find((p) => existsSync(p)) ?? 'Helvetica-Bold';

const FONT_SIZE_TITLE = 13;
const FONT_SIZE_SUBTITLE = 10;
const FONT_SIZE_NORMAL = 9;
const FONT_SIZE_SMALL = 7.5;
const FONT_SIZE_FOOTER_META = 6.5;
const FONT_SIZE_TABLE = 8;

const LINE_HEIGHT = 14;
const TABLE_ROW_HEIGHT = 18;
const TABLE_HEADER_HEIGHT = 22;

const COLOR_BLACK = '#000000';
const COLOR_DARK_GRAY = '#333333';
const COLOR_GRAY = '#666666';
const COLOR_LIGHT_GRAY = '#CCCCCC';
const COLOR_HEADER_BG = '#F0F0F0';
const APP_NAME = 'Delegacje-APP';
const APP_VERSION = '1.3.0';
const APP_REPOSITORY_URL = 'https://github.com/holi87/delegacje-app';

// =====================
// Table drawing helpers
// =====================

interface TableColumn {
  header: string;
  width: number;
  align?: 'left' | 'center' | 'right';
}

interface TableRow {
  cells: string[];
  bold?: boolean;
  separator?: boolean;
}

/**
 * Draw a table with headers and rows.
 * Returns the Y position after the table.
 */
function drawTable(
  doc: InstanceType<typeof PDFDocument>,
  startX: number,
  startY: number,
  columns: TableColumn[],
  rows: TableRow[]
): number {
  const totalWidth = columns.reduce((sum, c) => sum + c.width, 0);
  let y = startY;

  const drawHeader = () => {
    doc
      .rect(startX, y, totalWidth, TABLE_HEADER_HEIGHT)
      .fill(COLOR_HEADER_BG);

    doc.font(FONT_BOLD).fontSize(FONT_SIZE_TABLE).fillColor(COLOR_BLACK);
    let x = startX;
    for (const col of columns) {
      const textAlign = col.align ?? 'left';
      doc.text(col.header, x + 4, y + 6, {
        width: col.width - 8,
        align: textAlign,
        lineBreak: false,
      });
      x += col.width;
    }
    y += TABLE_HEADER_HEIGHT;

    doc.moveTo(startX, y).lineTo(startX + totalWidth, y).lineWidth(0.5).strokeColor(COLOR_BLACK).stroke();
  };

  const drawGrid = (segmentStartY: number, segmentEndY: number) => {
    doc.rect(startX, segmentStartY, totalWidth, segmentEndY - segmentStartY).lineWidth(0.5).strokeColor(COLOR_BLACK).stroke();

    let x = startX;
    for (let i = 0; i < columns.length - 1; i++) {
      x += columns[i].width;
      doc.moveTo(x, segmentStartY).lineTo(x, segmentEndY).lineWidth(0.3).strokeColor(COLOR_LIGHT_GRAY).stroke();
    }
  };

  const getRowHeight = (row: TableRow) => {
    doc.font(row.bold ? FONT_BOLD : FONT_NORMAL).fontSize(FONT_SIZE_TABLE);
    let maxHeight = TABLE_ROW_HEIGHT;

    for (let i = 0; i < columns.length; i++) {
      const col = columns[i];
      const cellText = row.cells[i] ?? '';
      const textAlign = col.align ?? 'left';
      const textHeight = doc.heightOfString(cellText, {
        width: col.width - 8,
        align: textAlign,
      });
      maxHeight = Math.max(maxHeight, textHeight + 8);
    }

    return maxHeight;
  };

  drawHeader();
  let segmentStartY = startY;

  // Draw rows
  for (const row of rows) {
    const rowHeight = getRowHeight(row);

    // Check if we need a new page
    if (y + rowHeight > PAGE_HEIGHT - MARGIN - 40) {
      drawGrid(segmentStartY, y);
      doc.addPage();
      y = MARGIN;
      drawHeader();
      segmentStartY = MARGIN;
    }

    if (row.separator) {
      doc.moveTo(startX, y).lineTo(startX + totalWidth, y).lineWidth(0.5).strokeColor(COLOR_LIGHT_GRAY).stroke();
    }

    doc.font(row.bold ? FONT_BOLD : FONT_NORMAL).fontSize(FONT_SIZE_TABLE).fillColor(COLOR_BLACK);

    let x = startX;
    for (let i = 0; i < columns.length; i++) {
      const col = columns[i];
      const cellText = row.cells[i] ?? '';
      const textAlign = col.align ?? 'left';
      doc.text(cellText, x + 4, y + 4, {
        width: col.width - 8,
        align: textAlign,
      });
      x += col.width;
    }
    y += rowHeight;
  }

  drawGrid(segmentStartY, y);
  return y;
}

// =====================
// PDF Section renderers
// =====================

function renderHeader(
  doc: InstanceType<typeof PDFDocument>,
  delegation: DelegationData,
  company: CompanyData | null,
  y: number
): number {
  const delNumber = getDelegationNumberLabel(delegation);
  const profile = delegation.user.profile;

  // Title
  doc.font(FONT_BOLD).fontSize(FONT_SIZE_TITLE).fillColor(COLOR_BLACK);
  const titleText = delegation.type === 'FOREIGN'
    ? 'ROZLICZENIE KOSZTÓW PODRÓŻY SŁUŻBOWEJ (ZAGRANICZNEJ)'
    : 'ROZLICZENIE KOSZTÓW PODRÓŻY SŁUŻBOWEJ';
  doc.text(titleText, MARGIN, y, {
    width: CONTENT_WIDTH,
    align: 'center',
  });
  y += 20;

  doc.font(FONT_NORMAL).fontSize(FONT_SIZE_SUBTITLE).fillColor(COLOR_DARK_GRAY);
  doc.text(`Nr: ${delNumber}`, MARGIN, y, {
    width: CONTENT_WIDTH,
    align: 'center',
  });
  y += 22;

  // Two columns: company (left) and person (right)
  const colWidth = CONTENT_WIDTH / 2;
  const leftX = MARGIN;
  const rightX = MARGIN + colWidth;

  doc.font(FONT_BOLD).fontSize(FONT_SIZE_SMALL).fillColor(COLOR_GRAY);
  doc.text('Dane spółki:', leftX, y);
  doc.text('Dane delegowanego:', rightX, y);
  y += 12;

  doc.font(FONT_NORMAL).fontSize(FONT_SIZE_NORMAL).fillColor(COLOR_BLACK);

  // Company info
  if (company) {
    doc.text(company.name, leftX, y);
    doc.text(`NIP: ${company.nip}`, leftX, y + LINE_HEIGHT);
    doc.text(company.address, leftX, y + LINE_HEIGHT * 2);
    doc.text(`${company.postalCode} ${company.city}`, leftX, y + LINE_HEIGHT * 3);
  } else {
    doc.text('(brak danych firmy)', leftX, y);
  }

  // Person info
  if (profile) {
    doc.text(`Imię i nazwisko: ${profile.firstName} ${profile.lastName}`, rightX, y);
    doc.text(`Stanowisko: ${profile.position}`, rightX, y + LINE_HEIGHT);
  } else {
    doc.text('(brak danych osoby)', rightX, y);
  }

  y += LINE_HEIGHT * 4 + 8;

  // Separator line
  doc.moveTo(MARGIN, y).lineTo(MARGIN + CONTENT_WIDTH, y).lineWidth(0.5).strokeColor(COLOR_LIGHT_GRAY).stroke();
  y += 10;

  return y;
}

function renderBasicInfo(
  doc: InstanceType<typeof PDFDocument>,
  delegation: DelegationData,
  y: number
): number {
  const rows: Array<{ label: string; value: string }> = [
    { label: 'Cel podróży:', value: delegation.purpose },
    { label: 'Miejsce:', value: delegation.destination },
    { label: 'Data i godzina wyjazdu:', value: formatDateTime(delegation.departureAt) },
    { label: 'Data i godzina powrotu:', value: formatDateTime(delegation.returnAt) },
    { label: 'Godzina wyjazdu:', value: format(delegation.departureAt, 'HH:mm') },
    { label: 'Godzina powrotu:', value: format(delegation.returnAt, 'HH:mm') },
    { label: 'Czas trwania:', value: formatDuration(delegation.departureAt, delegation.returnAt) },
    { label: 'Środek transportu:', value: transportTypeLabel(delegation.transportType) },
  ];

  // Add vehicle info if applicable
  if (
    delegation.vehicleType &&
    (delegation.transportType === 'PRIVATE_VEHICLE' || delegation.transportType === 'MIXED')
  ) {
    const mileage = delegation.mileageDetails;
    const plate = mileage?.vehiclePlate ?? '';
    rows.push({
      label: 'Pojazd:',
      value: `${vehicleTypeLabel(delegation.vehicleType)}${plate ? ', nr rej. ' + plate : ''}`,
    });
  }

  // Foreign delegation info
  if (delegation.type === 'FOREIGN') {
    if (delegation.foreignCountry) {
      rows.push({ label: 'Kraj docelowy:', value: delegation.foreignCountry });
    }
    if (delegation.foreignCurrency) {
      rows.push({ label: 'Waluta:', value: delegation.foreignCurrency });
    }
    if (delegation.exchangeRate) {
      const rate = d2n(delegation.exchangeRate);
      rows.push({
        label: 'Kurs NBP:',
        value: `${rate.toFixed(4)} PLN (tabela ${delegation.exchangeRateTable ?? '\u2013'}, z dnia ${delegation.exchangeRateDate ? formatDate(delegation.exchangeRateDate) : '\u2013'})`,
      });
    }
    if (delegation.borderCrossingOut) {
      rows.push({
        label: 'Przekroczenie granicy (wyjazd):',
        value: formatDateTime(delegation.borderCrossingOut),
      });
    }
    if (delegation.borderCrossingIn) {
      rows.push({
        label: 'Przekroczenie granicy (powrót):',
        value: formatDateTime(delegation.borderCrossingIn),
      });
    }
  }

  const labelX = MARGIN + 8;
  const labelWidth = 200;
  const valueX = labelX + labelWidth + 10;
  const valueWidth = MARGIN + CONTENT_WIDTH - valueX - 8;
  const rowGap = 4;

  const rowHeights = rows.map((row) => {
    doc.font(FONT_BOLD).fontSize(FONT_SIZE_NORMAL);
    const labelHeight = doc.heightOfString(row.label, { width: labelWidth });

    doc.font(FONT_NORMAL).fontSize(FONT_SIZE_NORMAL);
    const valueHeight = doc.heightOfString(row.value, { width: valueWidth });

    return Math.max(labelHeight, valueHeight) + rowGap;
  });

  const bodyHeight = rowHeights.reduce((sum, h) => sum + h, 0);
  const boxHeight = bodyHeight + 8;
  const totalSectionHeight = 16 + boxHeight + 14;

  if (y + totalSectionHeight > PAGE_HEIGHT - MARGIN - 40) {
    doc.addPage();
    y = MARGIN;
  }

  doc.font(FONT_BOLD).fontSize(FONT_SIZE_SUBTITLE).fillColor(COLOR_BLACK);
  doc.text('DANE DELEGACJI', MARGIN, y);
  y += 16;

  doc.rect(MARGIN, y - 4, CONTENT_WIDTH, boxHeight).lineWidth(0.5).strokeColor(COLOR_LIGHT_GRAY).stroke();

  doc.fillColor(COLOR_BLACK);
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowHeight = rowHeights[i];

    doc.font(FONT_BOLD).fontSize(FONT_SIZE_NORMAL);
    doc.text(row.label, labelX, y, {
      width: labelWidth,
      align: 'left',
    });

    doc.font(FONT_NORMAL).fontSize(FONT_SIZE_NORMAL);
    doc.text(row.value, valueX, y, {
      width: valueWidth,
      align: 'left',
    });

    y += rowHeight;
  }

  y += 14;
  return y;
}

function renderDietTable(
  doc: InstanceType<typeof PDFDocument>,
  delegation: DelegationData,
  y: number
): number {
  doc.font(FONT_BOLD).fontSize(FONT_SIZE_SUBTITLE).fillColor(COLOR_BLACK);
  doc.text('ROZLICZENIE DIET', MARGIN, y);
  y += 14;

  const isForeign = delegation.type === 'FOREIGN';
  const columns: TableColumn[] = isForeign
    ? [
        { header: 'Nr', width: 25, align: 'center' },
        { header: 'Data', width: 65, align: 'center' },
        { header: 'Odcinek', width: 55, align: 'center' },
        { header: 'Godzin', width: 45, align: 'right' },
        { header: 'Dieta naliczona', width: 85, align: 'right' },
        { header: 'Pomniejszenia', width: 90, align: 'right' },
        { header: 'Dieta netto', width: CONTENT_WIDTH - 25 - 65 - 55 - 45 - 85 - 90, align: 'right' },
      ]
    : [
        { header: 'Nr', width: 30, align: 'center' },
        { header: 'Data', width: 75, align: 'center' },
        { header: 'Godzin', width: 55, align: 'right' },
        { header: 'Dieta naliczona', width: 95, align: 'right' },
        { header: 'Pomniejszenia', width: 100, align: 'right' },
        { header: 'Dieta netto', width: CONTENT_WIDTH - 30 - 75 - 55 - 95 - 100, align: 'right' },
      ];

  const days = delegation.days;
  const rows: TableRow[] = [];

  let totalBasePln = 0;
  let totalBaseForeign = 0;
  let totalDeductionsPln = 0;
  let totalDeductionsForeign = 0;
  let totalFinalPln = 0;
  let totalFinalForeign = 0;
  const foreignCurrency = delegation.foreignCurrency ?? null;

  for (const day of days) {
    const base = d2n(day.dietBase);
    const deductions = d2n(day.dietDeductions);
    const final_ = d2n(day.dietFinal);
    const dayCurrency = isForeign && day.isForeign ? foreignCurrency : 'PLN';

    if (isForeign && day.isForeign) {
      totalBaseForeign += base;
      totalDeductionsForeign += deductions;
      totalFinalForeign += final_;
    } else {
      totalBasePln += base;
      totalDeductionsPln += deductions;
      totalFinalPln += final_;
    }

    // Build deduction description
    const deductionParts: string[] = [];
    if (day.breakfastProvided) deductionParts.push('sn.');
    if (day.lunchProvided) deductionParts.push('ob.');
    if (day.dinnerProvided) deductionParts.push('kol.');

    const deductionText = deductions > 0
      ? `-${formatAmountByCurrency(deductions, dayCurrency)} (${deductionParts.join(', ')})`
      : '0,00';

    if (isForeign) {
      const segment = day.isForeign ? 'Zagr.' : 'Kraj.';
      rows.push({
        cells: [
          day.dayNumber.toString(),
          formatDate(day.date),
          segment,
          formatDecimal(d2n(day.hoursInDay), 1),
          formatAmountByCurrency(base, dayCurrency),
          deductionText,
          formatAmountByCurrency(final_, dayCurrency),
        ],
      });
    } else {
      rows.push({
        cells: [
          day.dayNumber.toString(),
          formatDate(day.date),
          formatDecimal(d2n(day.hoursInDay), 1),
          formatPLN(base),
          deductionText,
          formatPLN(final_),
        ],
      });
    }
  }

  // Totals row
  if (isForeign) {
    const totalDeductionsText =
      totalDeductionsPln > 0 || totalDeductionsForeign > 0
        ? `-${formatMixedCurrency(totalDeductionsPln, totalDeductionsForeign, foreignCurrency)}`
        : '0,00';
    rows.push({
      cells: [
        '',
        '',
        '',
        'RAZEM',
        formatMixedCurrency(totalBasePln, totalBaseForeign, foreignCurrency),
        totalDeductionsText,
        formatMixedCurrency(totalFinalPln, totalFinalForeign, foreignCurrency),
      ],
      bold: true,
      separator: true,
    });
  } else {
    rows.push({
      cells: [
        '',
        '',
        'RAZEM',
        formatPLN(totalBasePln),
        totalDeductionsPln > 0 ? `-${formatDecimal(totalDeductionsPln)}` : '0,00',
        formatPLN(totalFinalPln),
      ],
      bold: true,
      separator: true,
    });
  }

  y = drawTable(doc, MARGIN, y, columns, rows);
  y += 6;

  // Rate note
  doc.font(FONT_NORMAL).fontSize(FONT_SIZE_SMALL).fillColor(COLOR_GRAY);
  if (delegation.type === 'FOREIGN') {
    const domesticDietTotal = d2n(delegation.totalDomesticDiet);
    const foreignDietTotal = d2n(delegation.totalForeignDiet);
    const exchangeRate = d2n(delegation.exchangeRate);
    const conversionText =
      exchangeRate > 0
        ? ` | Po kursie NBP: ${formatPLN(foreignDietTotal * exchangeRate)}`
        : '';
    doc.text(
      `Dieta krajowa: ${formatPLN(domesticDietTotal)} | Dieta zagraniczna: ${formatAmountByCurrency(foreignDietTotal, foreignCurrency)}${conversionText}`,
      MARGIN,
      y
    );
  } else {
    doc.text(`Stawka diety: ${formatPLN(45)} / doba`, MARGIN, y);
  }
  y += 16;

  return y;
}

function renderAccommodationTable(
  doc: InstanceType<typeof PDFDocument>,
  delegation: DelegationData,
  y: number
): number {
  // Collect accommodation nights from days
  const nights = delegation.days.filter(
    (d) => d.accommodationType !== 'NONE'
  );

  if (nights.length === 0 && d2n(delegation.totalAccommodation) === 0) {
    return y; // Skip section if no accommodation
  }

  // Check if we need a new page
  if (y + 50 > PAGE_HEIGHT - MARGIN - 60) {
    doc.addPage();
    y = MARGIN;
  }

  doc.font(FONT_BOLD).fontSize(FONT_SIZE_SUBTITLE).fillColor(COLOR_BLACK);
  doc.text('NOCLEGI', MARGIN, y);
  y += 14;

  const columns: TableColumn[] = [
    { header: 'Nr', width: 30, align: 'center' },
    { header: 'Data', width: 80, align: 'center' },
    { header: 'Rodzaj', width: 140, align: 'left' },
    { header: 'Nr dokumentu', width: 120, align: 'left' },
    { header: 'Kwota', width: CONTENT_WIDTH - 30 - 80 - 140 - 120, align: 'right' },
  ];

  const rows: TableRow[] = [];
  const isForeignDelegation = delegation.type === 'FOREIGN';
  const foreignCurrency = delegation.foreignCurrency ?? null;
  let domesticTotal = 0;
  let foreignTotal = 0;
  let idx = 1;

  for (const night of nights) {
    const cost = d2n(night.accommodationCost);
    const nightCurrency =
      isForeignDelegation && night.isForeign ? foreignCurrency : 'PLN';
    if (isForeignDelegation && night.isForeign) {
      foreignTotal += cost;
    } else {
      domesticTotal += cost;
    }
    rows.push({
      cells: [
        idx.toString(),
        formatDate(night.date),
        accommodationTypeLabel(night.accommodationType),
        night.accommodationReceiptNumber ?? '\u2013',
        formatAmountByCurrency(cost, nightCurrency),
      ],
    });
    idx++;
  }

  // Totals row
  rows.push({
    cells: [
      '',
      '',
      '',
      'RAZEM',
      isForeignDelegation
        ? formatMixedCurrency(domesticTotal, foreignTotal, foreignCurrency)
        : formatPLN(domesticTotal),
    ],
    bold: true,
    separator: true,
  });

  y = drawTable(doc, MARGIN, y, columns, rows);
  if (isForeignDelegation && foreignTotal > 0 && d2n(delegation.exchangeRate) > 0) {
    const rate = d2n(delegation.exchangeRate);
    doc.font(FONT_NORMAL).fontSize(FONT_SIZE_SMALL).fillColor(COLOR_GRAY);
    doc.text(
      `W tym noclegi zagraniczne w PLN: ${formatPLN(foreignTotal * rate)} (kurs: ${rate.toFixed(4)})`,
      MARGIN,
      y + 2
    );
    y += 12;
  }
  y += 16;

  return y;
}

function renderTransportSection(
  doc: InstanceType<typeof PDFDocument>,
  delegation: DelegationData,
  y: number
): number {
  const mileage = delegation.mileageDetails;
  const receipts = delegation.transportReceipts;
  const transportTotal = d2n(delegation.totalTransport);

  if (transportTotal === 0 && !mileage && receipts.length === 0) {
    return y; // Skip section if no transport costs
  }

  // Check if we need a new page
  if (y + 60 > PAGE_HEIGHT - MARGIN - 60) {
    doc.addPage();
    y = MARGIN;
  }

  doc.font(FONT_BOLD).fontSize(FONT_SIZE_SUBTITLE).fillColor(COLOR_BLACK);
  doc.text('TRANSPORT', MARGIN, y);
  y += 14;

  // Mileage section
  if (mileage) {
    doc.font(FONT_BOLD).fontSize(FONT_SIZE_NORMAL).fillColor(COLOR_BLACK);
    doc.text('Kilometrówka:', MARGIN + 4, y);
    y += LINE_HEIGHT + 2;

    doc.font(FONT_NORMAL).fontSize(FONT_SIZE_NORMAL);

    const vehicleLabel = vehicleTypeLabel(mileage.vehicleType);
    doc.text(`Pojazd: ${vehicleLabel}, nr rej. ${mileage.vehiclePlate}`, MARGIN + 8, y);
    y += LINE_HEIGHT;

    const distKm = d2n(mileage.distanceKm);
    const rateKm = d2n(mileage.ratePerKm);
    const mileageTotal = d2n(mileage.totalAmount);

    doc.text(`Dystans: ${formatDecimal(distKm, 1)} km`, MARGIN + 8, y);
    y += LINE_HEIGHT;

    doc.text(`Stawka: ${formatDecimal(rateKm)} zł/km`, MARGIN + 8, y);
    y += LINE_HEIGHT;

    doc.text(
      `Obliczenie: ${formatDecimal(distKm, 1)} km x ${formatDecimal(rateKm)} zł/km = ${formatPLN(mileageTotal)}`,
      MARGIN + 8,
      y
    );
    y += LINE_HEIGHT;

    doc.font(FONT_BOLD);
    doc.text(`RAZEM kilometrówka: ${formatPLN(mileageTotal)}`, MARGIN + 8, y, {
      width: CONTENT_WIDTH - 16,
      align: 'right',
    });
    y += LINE_HEIGHT + 6;
  }

  // Transport receipts table
  if (receipts.length > 0) {
    if (mileage) {
      doc.font(FONT_BOLD).fontSize(FONT_SIZE_NORMAL).fillColor(COLOR_BLACK);
      doc.text('Bilety / rachunki:', MARGIN + 4, y);
      y += LINE_HEIGHT;
    }

    const columns: TableColumn[] = [
      { header: 'Nr', width: 30, align: 'center' },
      { header: 'Opis', width: CONTENT_WIDTH - 30 - 120 - 130, align: 'left' },
      { header: 'Nr dokumentu', width: 120, align: 'left' },
      { header: 'Kwota', width: 130, align: 'right' },
    ];

    const rows: TableRow[] = [];
    let receiptsTotal = 0;

    for (let i = 0; i < receipts.length; i++) {
      const r = receipts[i];
      const amount = d2n(r.amount);
      receiptsTotal += amount;
      rows.push({
        cells: [
          (i + 1).toString(),
          r.description,
          r.receiptNumber ?? '\u2013',
          formatPLN(amount),
        ],
      });
    }

    rows.push({
      cells: ['', 'RAZEM', '', formatPLN(receiptsTotal)],
      bold: true,
      separator: true,
    });

    y = drawTable(doc, MARGIN, y, columns, rows);
    y += 6;
  }

  // Overall transport total (if mixed)
  if (mileage && receipts.length > 0) {
    doc.font(FONT_BOLD).fontSize(FONT_SIZE_NORMAL).fillColor(COLOR_BLACK);
    doc.text(`RAZEM transport: ${formatPLN(transportTotal)}`, MARGIN, y, {
      width: CONTENT_WIDTH,
      align: 'right',
    });
    y += LINE_HEIGHT;
  }

  y += 10;
  return y;
}

function renderAdditionalCosts(
  doc: InstanceType<typeof PDFDocument>,
  delegation: DelegationData,
  y: number
): number {
  const costs = delegation.additionalCosts;
  if (costs.length === 0) {
    return y; // Skip section if no additional costs
  }

  // Check if we need a new page
  if (y + 50 > PAGE_HEIGHT - MARGIN - 60) {
    doc.addPage();
    y = MARGIN;
  }

  doc.font(FONT_BOLD).fontSize(FONT_SIZE_SUBTITLE).fillColor(COLOR_BLACK);
  doc.text('KOSZTY DODATKOWE', MARGIN, y);
  y += 14;

  const columns: TableColumn[] = [
    { header: 'Nr', width: 30, align: 'center' },
    { header: 'Opis', width: CONTENT_WIDTH - 30 - 120 - 130, align: 'left' },
    { header: 'Nr dokumentu', width: 120, align: 'left' },
    { header: 'Kwota', width: 130, align: 'right' },
  ];

  const rows: TableRow[] = [];
  let total = 0;

  for (let i = 0; i < costs.length; i++) {
    const c = costs[i];
    const amount = d2n(c.amount);
    total += amount;
    rows.push({
      cells: [
        (i + 1).toString(),
        c.description,
        c.receiptNumber ?? '\u2013',
        formatPLN(amount),
      ],
    });
  }

  rows.push({
    cells: ['', 'RAZEM', '', formatPLN(total)],
    bold: true,
    separator: true,
  });

  y = drawTable(doc, MARGIN, y, columns, rows);
  y += 16;

  return y;
}

function renderSummary(
  doc: InstanceType<typeof PDFDocument>,
  delegation: DelegationData,
  y: number
): number {
  const dietTotal = d2n(delegation.totalDiet);
  const accommodationTotal = d2n(delegation.totalAccommodation);
  const transportTotal = d2n(delegation.totalTransport);
  const additionalTotal = d2n(delegation.totalAdditional);
  const grandTotal = d2n(delegation.grandTotal);
  const advanceAmount = d2n(delegation.advanceAmount);
  const amountDue = d2n(delegation.amountDue);

  // Check if we need a new page
  if (y + 140 > PAGE_HEIGHT - MARGIN - 60) {
    doc.addPage();
    y = MARGIN;
  }

  doc.font(FONT_BOLD).fontSize(FONT_SIZE_SUBTITLE).fillColor(COLOR_BLACK);
  doc.text('PODSUMOWANIE KOSZTÓW', MARGIN, y);
  y += 14;

  const boxX = MARGIN;
  const boxWidth = CONTENT_WIDTH;
  const labelX = boxX + 8;
  const valueX = boxX + boxWidth - 130;
  const rowH = LINE_HEIGHT + 4;

  const isForeign = delegation.type === 'FOREIGN';
  const domesticDietTotal = d2n(delegation.totalDomesticDiet);
  const foreignDietTotal = d2n(delegation.totalForeignDiet);

  const exchangeRate = d2n(delegation.exchangeRate);
  const foreignCurrency = delegation.foreignCurrency ?? null;

  const foreignAccommodationNominal = delegation.days
    .filter((d) => d.isForeign && d.accommodationType !== 'NONE')
    .reduce((sum, d) => sum + d2n(d.accommodationCost), 0);

  const summaryLines: [string, string, boolean][] = isForeign
    ? [
        ['Diety (odcinek krajowy):', formatPLN(domesticDietTotal), false],
        [`Diety (odcinek zagraniczny, ${foreignCurrency ?? ''}):`, formatAmountByCurrency(foreignDietTotal, foreignCurrency), false],
        ...(delegation.exchangeRate
          ? [[`w tym dieta zagraniczna w PLN:`, `${formatPLN(foreignDietTotal * exchangeRate)} (kurs: ${exchangeRate.toFixed(4)})`, false] as [string, string, boolean]]
          : []),
        ['Diety razem:', formatPLN(dietTotal), false],
      ]
    : [
        ['Diety:', formatPLN(dietTotal), false],
      ];

  summaryLines.push(
    ...(isForeign && delegation.exchangeRate && foreignAccommodationNominal > 0
      ? [[
          `w tym noclegi zagraniczne w PLN:`,
          `${formatPLN(foreignAccommodationNominal * exchangeRate)} (kurs: ${exchangeRate.toFixed(4)})`,
          false,
        ] as [string, string, boolean]]
      : []),
    ['Noclegi:', formatPLN(accommodationTotal), false],
    ['Transport:', formatPLN(transportTotal), false],
    ['Koszty dodatkowe:', formatPLN(additionalTotal), false],
  );

  const totalLines: [string, string, boolean][] = [
    ['RAZEM:', formatPLN(grandTotal), true],
    ['Zaliczka:', formatPLN(advanceAmount), false],
    ['DO WYPŁATY:', formatPLN(amountDue), true],
  ];

  const allLines = [...summaryLines, ...totalLines];
  const boxHeight = allLines.length * rowH + 30; // extra space for separators + words

  // Draw summary box
  doc.rect(boxX, y, boxWidth, boxHeight).lineWidth(1).strokeColor(COLOR_BLACK).stroke();

  let lineY = y + 6;

  // Cost lines
  for (const [label, value, bold] of summaryLines) {
    doc.font(bold ? FONT_BOLD : FONT_NORMAL).fontSize(FONT_SIZE_NORMAL).fillColor(COLOR_BLACK);
    doc.text(label, labelX, lineY);
    doc.text(value, valueX, lineY, { width: 120, align: 'right' });
    lineY += rowH;
  }

  // Separator
  doc.moveTo(boxX + 4, lineY).lineTo(boxX + boxWidth - 4, lineY).lineWidth(0.5).strokeColor(COLOR_BLACK).stroke();
  lineY += 4;

  // Total lines
  for (const [label, value, bold] of totalLines) {
    doc.font(bold ? FONT_BOLD : FONT_NORMAL).fontSize(bold ? FONT_SIZE_SUBTITLE : FONT_SIZE_NORMAL).fillColor(COLOR_BLACK);
    doc.text(label, labelX, lineY);
    doc.text(value, valueX, lineY, { width: 120, align: 'right' });
    lineY += rowH;
  }

  // Amount in words
  const words = amountToWords(amountDue);
  doc.font(FONT_NORMAL).fontSize(FONT_SIZE_SMALL).fillColor(COLOR_GRAY);
  doc.text(`(słownie: ${words})`, labelX, lineY);

  y += boxHeight + 16;
  return y;
}

function renderSignatures(
  doc: InstanceType<typeof PDFDocument>,
  y: number
): number {
  // Check if we need a new page
  if (y + 100 > PAGE_HEIGHT - MARGIN - 30) {
    doc.addPage();
    y = MARGIN;
  }

  // Notes line
  doc.font(FONT_NORMAL).fontSize(FONT_SIZE_NORMAL).fillColor(COLOR_BLACK);
  doc.text('Uwagi: ________________________________________________________________', MARGIN, y);
  y += LINE_HEIGHT * 2;

  // Declaration
  doc.font(FONT_NORMAL).fontSize(FONT_SIZE_NORMAL).fillColor(COLOR_BLACK);
  doc.text('Oświadczam, że powyższe dane są zgodne ze stanem faktycznym.', MARGIN, y);
  y += LINE_HEIGHT * 3;

  // Signature lines
  const leftX = MARGIN;
  const rightX = MARGIN + CONTENT_WIDTH / 2 + 20;
  const lineLen = 180;

  doc.moveTo(leftX, y).lineTo(leftX + lineLen, y).lineWidth(0.5).strokeColor(COLOR_BLACK).stroke();
  doc.moveTo(rightX, y).lineTo(rightX + lineLen, y).lineWidth(0.5).strokeColor(COLOR_BLACK).stroke();
  y += 4;

  doc.font(FONT_NORMAL).fontSize(FONT_SIZE_SMALL).fillColor(COLOR_GRAY);
  doc.text('Podpis osoby delegowanej', leftX, y);
  doc.text('Podpis zatwierdzającego', rightX, y);
  y += LINE_HEIGHT;

  doc.text('(imię i nazwisko)', leftX, y);
  doc.text('(imię i nazwisko, stanowisko)', rightX, y);
  y += LINE_HEIGHT * 2;

  doc.text('Data: ________________', leftX, y);
  doc.text('Data: ________________', rightX, y);
  y += LINE_HEIGHT * 2;

  return y;
}

function renderFooter(
  doc: InstanceType<typeof PDFDocument>,
  _y: number
): void {
  // Keep footer above the bottom margin so PDFKit does not push the last line
  // to an automatic new page.
  const footerY = PAGE_HEIGHT - MARGIN - 42;

  doc.font(FONT_NORMAL).fontSize(FONT_SIZE_SMALL).fillColor(COLOR_GRAY);

  const now = new Date();
  const genDate = formatDateTimeInTimezone(now, 'Europe/Warsaw');

  doc.text(`Dokument wygenerowany: ${genDate}`, MARGIN, footerY);
  doc.text(
    'Podstawa prawna: Rozporządzenie MPiPS z 25.10.2022 r. (Dz.U. 2022 poz. 2302)',
    MARGIN,
    footerY + 9,
    {
      width: CONTENT_WIDTH,
      lineBreak: false,
    }
  );
  doc.font(FONT_NORMAL).fontSize(FONT_SIZE_FOOTER_META).fillColor(COLOR_GRAY);
  doc.text(
    `Wygenerowano w ${APP_NAME} v${APP_VERSION} / ${APP_REPOSITORY_URL}`,
    MARGIN,
    footerY + 18,
    {
      width: CONTENT_WIDTH,
      lineBreak: false,
    }
  );
}

// =====================
// Main PDF generation
// =====================

/**
 * Generate a PDF document for a delegation.
 *
 * @param prisma - Prisma client instance
 * @param delegationId - UUID of the delegation
 * @param userId - UUID of the requesting user
 * @param userRole - Role of the requesting user ('ADMIN' or 'DELEGATED')
 * @returns Buffer containing the generated PDF
 */
export async function generateDelegationPdf(
  prisma: PrismaClient,
  delegationId: string,
  userId: string,
  userRole: string
): Promise<Buffer> {
  // Fetch delegation with all relations
  const delegation = await prisma.delegation.findUnique({
    where: { id: delegationId },
    include: {
      user: { include: { profile: true } },
      days: { orderBy: { dayNumber: 'asc' } },
      additionalCosts: true,
      mileageDetails: true,
      transportReceipts: true,
    },
  });

  if (!delegation) {
    throw new Error('DELEGATION_NOT_FOUND');
  }

  // Authorization: user can only access their own delegations, admin can access all
  if (userRole !== 'ADMIN' && delegation.userId !== userId) {
    throw new Error('FORBIDDEN');
  }

  // Fetch company info for the PDF header
  const companyInfo = await prisma.companyInfo.findFirst();

  // Cast to our internal data type (Prisma types include Decimal, our helpers handle it)
  const data = delegation as unknown as DelegationData;

  // Build the PDF
  const doc = new PDFDocument({
    size: 'A4',
    margins: {
      top: MARGIN,
      bottom: MARGIN,
      left: MARGIN,
      right: MARGIN,
    },
    info: {
      Title: `Rozliczenie delegacji - ${getDelegationNumberLabel(data)}`,
      Author: companyInfo?.name ?? 'Delegacje App',
      Subject: `Delegacja: ${data.purpose}`,
      Creator: 'Delegacje App (PDFKit)',
    },
    bufferPages: true,
  });

  // Collect PDF output into a buffer
  const chunks: Buffer[] = [];
  doc.on('data', (chunk: Buffer) => chunks.push(chunk));

  const pdfReady = new Promise<Buffer>((resolve, reject) => {
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
  });

  // --- Render sections ---
  let y = MARGIN;

  // 1. Header (company + person + title)
  y = renderHeader(doc, data, companyInfo as CompanyData | null, y);

  // 2. Basic delegation info
  y = renderBasicInfo(doc, data, y);

  // 3. Diet table
  if (data.days.length > 0) {
    y = renderDietTable(doc, data, y);
  }

  // 4. Accommodation table
  y = renderAccommodationTable(doc, data, y);

  // 5. Transport section
  y = renderTransportSection(doc, data, y);

  // 6. Additional costs table
  y = renderAdditionalCosts(doc, data, y);

  // 7. Summary box
  y = renderSummary(doc, data, y);

  // 8. Signatures
  y = renderSignatures(doc, y);

  // 9. Footer (on the last page)
  renderFooter(doc, y);

  // Finalize
  doc.end();

  return pdfReady;
}
