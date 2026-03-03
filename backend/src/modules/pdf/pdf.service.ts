import { PrismaClient } from '@prisma/client';
import type { Decimal } from '@prisma/client/runtime/library';
import PDFDocument from 'pdfkit';
import { format } from 'date-fns';
import { existsSync } from 'node:fs';
import { amountToWords } from './number-to-words.js';

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
}

interface AdditionalCostData {
  description: string;
  amount: Decimal;
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
 * Example: 1234.56 => "1 234,56 zl"
 */
function formatPLN(amount: number): string {
  const fixed = Math.abs(amount).toFixed(2);
  const [intPart, decPart] = fixed.split('.');
  // Add space as thousands separator
  const withSeparator = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  const sign = amount < 0 ? '-' : '';
  return `${sign}${withSeparator},${decPart} zl`;
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

/** Format date as DD.MM.YYYY */
function formatDate(date: Date): string {
  return format(date, 'dd.MM.yyyy');
}

/** Format datetime as DD.MM.YYYY, godz. HH:MM */
function formatDateTime(date: Date): string {
  return `${format(date, 'dd.MM.yyyy')}, godz. ${format(date, 'HH:mm')}`;
}

/**
 * Generate the delegation number: DEL/{year}/{4-digit sequence}.
 * Uses the delegation's creation date for the year and a simple numeric approach.
 */
function generateDelegationNumber(delegation: DelegationData): string {
  const year = delegation.createdAt.getFullYear();
  // Use last 4 digits of uuid-based id as a simple sequence approximation.
  // In production a proper sequential counter would be better, but for the PDF
  // we derive a stable number from the creation order.
  const hexSuffix = delegation.id.replace(/-/g, '').slice(-4);
  const num = (parseInt(hexSuffix, 16) % 9999) + 1;
  return `DEL/${year}/${num.toString().padStart(4, '0')}`;
}

/** Get human-readable transport type label. */
function transportTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    COMPANY_VEHICLE: 'Pojazd sluzbowy',
    PUBLIC_TRANSPORT: 'Transport publiczny (bilety)',
    PRIVATE_VEHICLE: 'Samochod prywatny (kilometrowka)',
    MIXED: 'Mieszany (kilometrowka + bilety)',
  };
  return labels[type] ?? type;
}

/** Get human-readable vehicle type label. */
function vehicleTypeLabel(type: string | null): string {
  if (!type) return '';
  const labels: Record<string, string> = {
    CAR_ABOVE_900: 'Samochod osobowy > 900 cm3',
    CAR_BELOW_900: 'Samochod osobowy <= 900 cm3',
    MOTORCYCLE: 'Motocykl',
    MOPED: 'Motorower',
  };
  return labels[type] ?? type;
}

/** Get human-readable accommodation type label. */
function accommodationTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    RECEIPT: 'Wg rachunku',
    LUMP_SUM: 'Ryczalt',
    FREE: 'Bezplatnie',
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
  '/usr/share/fonts/ttf-dejavu/DejaVuSans.ttf',
  '/usr/share/fonts/dejavu/DejaVuSans.ttf',
].find((p) => existsSync(p)) ?? 'Helvetica';
const FONT_BOLD = [
  '/usr/share/fonts/ttf-dejavu/DejaVuSans-Bold.ttf',
  '/usr/share/fonts/dejavu/DejaVuSans-Bold.ttf',
].find((p) => existsSync(p)) ?? 'Helvetica-Bold';

const FONT_SIZE_TITLE = 13;
const FONT_SIZE_SUBTITLE = 10;
const FONT_SIZE_NORMAL = 9;
const FONT_SIZE_SMALL = 7.5;
const FONT_SIZE_TABLE = 8;

const LINE_HEIGHT = 14;
const TABLE_ROW_HEIGHT = 18;
const TABLE_HEADER_HEIGHT = 22;

const COLOR_BLACK = '#000000';
const COLOR_DARK_GRAY = '#333333';
const COLOR_GRAY = '#666666';
const COLOR_LIGHT_GRAY = '#CCCCCC';
const COLOR_HEADER_BG = '#F0F0F0';

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

  // Draw header background
  doc
    .rect(startX, y, totalWidth, TABLE_HEADER_HEIGHT)
    .fill(COLOR_HEADER_BG);

  // Draw header text
  doc.font(FONT_BOLD).fontSize(FONT_SIZE_TABLE).fillColor(COLOR_BLACK);
  let x = startX;
  for (const col of columns) {
    const textX = col.align === 'right' ? x + col.width - 4 : col.align === 'center' ? x + col.width / 2 : x + 4;
    const textAlign = col.align ?? 'left';
    doc.text(col.header, textX, y + 6, {
      width: col.width - 8,
      align: textAlign,
      lineBreak: false,
    });
    x += col.width;
  }
  y += TABLE_HEADER_HEIGHT;

  // Draw header bottom line
  doc.moveTo(startX, y).lineTo(startX + totalWidth, y).lineWidth(0.5).strokeColor(COLOR_BLACK).stroke();

  // Draw rows
  for (const row of rows) {
    // Check if we need a new page
    if (y + TABLE_ROW_HEIGHT > PAGE_HEIGHT - MARGIN - 40) {
      doc.addPage();
      y = MARGIN;
    }

    if (row.separator) {
      doc.moveTo(startX, y).lineTo(startX + totalWidth, y).lineWidth(0.5).strokeColor(COLOR_LIGHT_GRAY).stroke();
    }

    doc.font(row.bold ? FONT_BOLD : FONT_NORMAL).fontSize(FONT_SIZE_TABLE).fillColor(COLOR_BLACK);

    x = startX;
    for (let i = 0; i < columns.length; i++) {
      const col = columns[i];
      const cellText = row.cells[i] ?? '';
      const textX = col.align === 'right' ? x + col.width - 4 : col.align === 'center' ? x + col.width / 2 : x + 4;
      const textAlign = col.align ?? 'left';
      doc.text(cellText, textX, y + 5, {
        width: col.width - 8,
        align: textAlign,
        lineBreak: false,
      });
      x += col.width;
    }
    y += TABLE_ROW_HEIGHT;
  }

  // Draw outer border
  doc.rect(startX, startY, totalWidth, y - startY).lineWidth(0.5).strokeColor(COLOR_BLACK).stroke();

  // Draw column lines
  x = startX;
  for (let i = 0; i < columns.length - 1; i++) {
    x += columns[i].width;
    doc.moveTo(x, startY).lineTo(x, y).lineWidth(0.3).strokeColor(COLOR_LIGHT_GRAY).stroke();
  }

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
  const delNumber = generateDelegationNumber(delegation);
  const profile = delegation.user.profile;

  // Title
  doc.font(FONT_BOLD).fontSize(FONT_SIZE_TITLE).fillColor(COLOR_BLACK);
  const titleText = delegation.type === 'FOREIGN'
    ? 'ROZLICZENIE KOSZTOW PODROZY SLUZBOWEJ (ZAGRANICZNEJ)'
    : 'ROZLICZENIE KOSZTOW PODROZY SLUZBOWEJ';
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
  doc.text('Dane spolki:', leftX, y);
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
    doc.text(`Imie i nazwisko: ${profile.firstName} ${profile.lastName}`, rightX, y);
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
  doc.font(FONT_BOLD).fontSize(FONT_SIZE_SUBTITLE).fillColor(COLOR_BLACK);
  doc.text('DANE DELEGACJI', MARGIN, y);
  y += 16;

  const labelX = MARGIN + 4;
  const valueX = MARGIN + 140;
  const rowH = LINE_HEIGHT + 2;

  const rows: [string, string][] = [
    ['Cel podrozy:', delegation.purpose],
    ['Miejsce:', delegation.destination],
    ['Data i godzina wyjazdu:', formatDateTime(delegation.departureAt)],
    ['Data i godzina powrotu:', formatDateTime(delegation.returnAt)],
    ['Godzina wyjazdu:', format(delegation.departureAt, 'HH:mm')],
    ['Godzina powrotu:', format(delegation.returnAt, 'HH:mm')],
    ['Czas trwania:', formatDuration(delegation.departureAt, delegation.returnAt)],
    ['Srodek transportu:', transportTypeLabel(delegation.transportType)],
  ];

  // Add vehicle info if applicable
  if (
    delegation.vehicleType &&
    (delegation.transportType === 'PRIVATE_VEHICLE' || delegation.transportType === 'MIXED')
  ) {
    const mileage = delegation.mileageDetails;
    const plate = mileage?.vehiclePlate ?? '';
    rows.push(['Pojazd:', `${vehicleTypeLabel(delegation.vehicleType)}${plate ? ', nr rej. ' + plate : ''}`]);
  }

  // Foreign delegation info
  if (delegation.type === 'FOREIGN') {
    if (delegation.foreignCountry) {
      rows.push(['Kraj docelowy:', delegation.foreignCountry]);
    }
    if (delegation.foreignCurrency) {
      rows.push(['Waluta:', delegation.foreignCurrency]);
    }
    if (delegation.exchangeRate) {
      const rate = d2n(delegation.exchangeRate);
      rows.push(['Kurs NBP:', `${rate.toFixed(4)} PLN (tabela ${delegation.exchangeRateTable ?? '\u2013'}, z dnia ${delegation.exchangeRateDate ? formatDate(delegation.exchangeRateDate) : '\u2013'})`]);
    }
    if (delegation.borderCrossingOut) {
      rows.push(['Przekroczenie granicy (wyjazd):', formatDateTime(delegation.borderCrossingOut)]);
    }
    if (delegation.borderCrossingIn) {
      rows.push(['Przekroczenie granicy (powrot):', formatDateTime(delegation.borderCrossingIn)]);
    }
  }

  // Draw box
  const boxHeight = rows.length * rowH + 8;
  doc.rect(MARGIN, y - 4, CONTENT_WIDTH, boxHeight).lineWidth(0.5).strokeColor(COLOR_LIGHT_GRAY).stroke();

  doc.font(FONT_NORMAL).fontSize(FONT_SIZE_NORMAL).fillColor(COLOR_BLACK);
  for (const [label, value] of rows) {
    doc.font(FONT_BOLD).text(label, labelX, y, { continued: false, lineBreak: false });
    doc.font(FONT_NORMAL).text(value, valueX, y, { lineBreak: false });
    y += rowH;
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

  let totalBase = 0;
  let totalDeductions = 0;
  let totalFinal = 0;

  for (const day of days) {
    const base = d2n(day.dietBase);
    const deductions = d2n(day.dietDeductions);
    const final_ = d2n(day.dietFinal);
    totalBase += base;
    totalDeductions += deductions;
    totalFinal += final_;

    // Build deduction description
    const deductionParts: string[] = [];
    if (day.breakfastProvided) deductionParts.push('sn.');
    if (day.lunchProvided) deductionParts.push('ob.');
    if (day.dinnerProvided) deductionParts.push('kol.');

    const deductionText = deductions > 0
      ? `-${formatDecimal(deductions)} (${deductionParts.join(', ')})`
      : '0,00';

    if (isForeign) {
      const segment = day.isForeign ? 'Zagr.' : 'Kraj.';
      rows.push({
        cells: [
          day.dayNumber.toString(),
          formatDate(day.date),
          segment,
          formatDecimal(d2n(day.hoursInDay), 1),
          formatPLN(base),
          deductionText,
          formatPLN(final_),
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
    rows.push({
      cells: [
        '',
        '',
        '',
        'RAZEM',
        formatPLN(totalBase),
        totalDeductions > 0 ? `-${formatDecimal(totalDeductions)}` : '0,00',
        formatPLN(totalFinal),
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
        formatPLN(totalBase),
        totalDeductions > 0 ? `-${formatDecimal(totalDeductions)}` : '0,00',
        formatPLN(totalFinal),
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
    doc.text(
      `Dieta krajowa: ${formatPLN(domesticDietTotal)} | Dieta zagraniczna: ${formatPLN(foreignDietTotal)} (${delegation.foreignCurrency ?? ''})`,
      MARGIN,
      y
    );
  } else {
    doc.text(`Stawka diety: ${formatPLN(45)} / dobe`, MARGIN, y);
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
    { header: 'Rodzaj', width: 200, align: 'left' },
    { header: 'Kwota', width: CONTENT_WIDTH - 30 - 80 - 200, align: 'right' },
  ];

  const rows: TableRow[] = [];
  let total = 0;
  let idx = 1;

  for (const night of nights) {
    const cost = d2n(night.accommodationCost);
    total += cost;
    rows.push({
      cells: [
        idx.toString(),
        formatDate(night.date),
        accommodationTypeLabel(night.accommodationType),
        formatPLN(cost),
      ],
    });
    idx++;
  }

  // Totals row
  rows.push({
    cells: ['', '', 'RAZEM', formatPLN(total)],
    bold: true,
    separator: true,
  });

  y = drawTable(doc, MARGIN, y, columns, rows);
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
    doc.text('Kilometrowka:', MARGIN + 4, y);
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

    doc.text(`Stawka: ${formatDecimal(rateKm)} zl/km`, MARGIN + 8, y);
    y += LINE_HEIGHT;

    doc.text(
      `Obliczenie: ${formatDecimal(distKm, 1)} km x ${formatDecimal(rateKm)} zl/km = ${formatPLN(mileageTotal)}`,
      MARGIN + 8,
      y
    );
    y += LINE_HEIGHT;

    doc.font(FONT_BOLD);
    doc.text(`RAZEM kilometrowka: ${formatPLN(mileageTotal)}`, MARGIN + 8, y, {
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
      { header: 'Opis', width: CONTENT_WIDTH - 30 - 120, align: 'left' },
      { header: 'Kwota', width: 120, align: 'right' },
    ];

    const rows: TableRow[] = [];
    let receiptsTotal = 0;

    for (let i = 0; i < receipts.length; i++) {
      const r = receipts[i];
      const amount = d2n(r.amount);
      receiptsTotal += amount;
      rows.push({
        cells: [(i + 1).toString(), r.description, formatPLN(amount)],
      });
    }

    rows.push({
      cells: ['', 'RAZEM', formatPLN(receiptsTotal)],
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
    { header: 'Opis', width: CONTENT_WIDTH - 30 - 120, align: 'left' },
    { header: 'Kwota', width: 120, align: 'right' },
  ];

  const rows: TableRow[] = [];
  let total = 0;

  for (let i = 0; i < costs.length; i++) {
    const c = costs[i];
    const amount = d2n(c.amount);
    total += amount;
    rows.push({
      cells: [(i + 1).toString(), c.description, formatPLN(amount)],
    });
  }

  rows.push({
    cells: ['', 'RAZEM', formatPLN(total)],
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
  doc.text('PODSUMOWANIE KOSZTOW', MARGIN, y);
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

  const summaryLines: [string, string, boolean][] = isForeign
    ? [
        ['Diety (odcinek krajowy):', formatPLN(domesticDietTotal), false],
        [`Diety (odcinek zagraniczny, ${delegation.foreignCurrency ?? ''}):`, formatPLN(foreignDietTotal), false],
        ...(delegation.exchangeRate
          ? [[`w tym dieta zagraniczna w PLN:`, `${formatPLN(foreignDietTotal * exchangeRate)} (kurs: ${exchangeRate.toFixed(4)})`, false] as [string, string, boolean]]
          : []),
        ['Diety razem:', formatPLN(dietTotal), false],
      ]
    : [
        ['Diety:', formatPLN(dietTotal), false],
      ];

  summaryLines.push(
    ['Noclegi:', formatPLN(accommodationTotal), false],
    ['Transport:', formatPLN(transportTotal), false],
    ['Koszty dodatkowe:', formatPLN(additionalTotal), false],
  );

  const totalLines: [string, string, boolean][] = [
    ['RAZEM:', formatPLN(grandTotal), true],
    ['Zaliczka:', formatPLN(advanceAmount), false],
    ['DO WYPLATY:', formatPLN(amountDue), true],
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
  doc.text(`(slownie: ${words})`, labelX, lineY);

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
  doc.text('Oswiadczam, ze powyzsze dane sa zgodne ze stanem faktycznym.', MARGIN, y);
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
  doc.text('Podpis zatwierdzajacego', rightX, y);
  y += LINE_HEIGHT;

  doc.text('(imie i nazwisko)', leftX, y);
  doc.text('(imie i nazwisko, stanowisko)', rightX, y);
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
  const footerY = PAGE_HEIGHT - MARGIN - 20;

  doc.font(FONT_NORMAL).fontSize(FONT_SIZE_SMALL).fillColor(COLOR_GRAY);

  const now = new Date();
  const genDate = `${format(now, 'dd.MM.yyyy')}, ${format(now, 'HH:mm')}`;

  doc.text(`Dokument wygenerowany: ${genDate}`, MARGIN, footerY);
  doc.text(
    'Podstawa prawna: Rozporzadzenie MPiPS z 25.10.2022 r. (Dz.U. 2022 poz. 2302)',
    MARGIN,
    footerY + 10
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
      Title: `Rozliczenie delegacji - ${generateDelegationNumber(data)}`,
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
