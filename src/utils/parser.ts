import type { Receipt, ReceiptItem } from '../types';

// ─── Number Parsing ───────────────────────────────────────────────
// Handles Indonesian format: 1.000 (thousand sep) and 1,000 or 1000
function parseIndonesianNumber(str: string): number {
  if (!str) return 0;
  let s = str.replace(/[Rp\s]/gi, '').trim();

  if (s.includes(',') && s.includes('.')) {
    // Both separators: determine which is decimal by position
    const lastDot = s.lastIndexOf('.');
    const lastComma = s.lastIndexOf(',');
    if (lastComma > lastDot) {
      // Indonesian style: 1.234,50 → dot=thousand, comma=decimal
      s = s.replace(/\./g, '').replace(',', '.');
    } else {
      // Western style: 1,234.50 → comma=thousand, dot=decimal
      s = s.replace(/,/g, '');
    }
  } else if (s.includes(',')) {
    // Comma only: if followed by exactly 3 digits at end → thousand sep
    if (/,\d{3}(,\d{3})*$/.test(s)) {
      s = s.replace(/,/g, '');
    } else {
      // Decimal comma: "35,5" → "35.5"
      s = s.replace(',', '.');
    }
  } else if (s.includes('.')) {
    const parts = s.split('.');
    // Multiple dots OR single dot with 3-digit fractional part → thousand seps
    if (parts.length > 2 || (parts.length === 2 && parts[1].length === 3)) {
      s = s.replace(/\./g, '');
    }
    // else single dot with 1-2 digit fraction → decimal (keep as-is)
  }

  const n = parseFloat(s);
  return isNaN(n) ? 0 : n;
}

// ─── Keyword Matchers ─────────────────────────────────────────────
const SUBTOTAL_KW = /subtotal|sub\s*total|sub-total/i;
const TAX_KW = /\b(pajak|pb1|ppn|tax|vat)\b/i;
const SERVICE_KW = /\b(service|biaya\s*pelayanan|servis|sc)\b/i;
const DISCOUNT_KW = /\b(diskon|discount|promo|potongan)\b/i;
const ROUNDING_KW = /\b(rounding|pembulatan|bulatkan)\b/i;
const GRAND_TOTAL_KW = /grand\s*total|total\s*bayar|total\s*tagihan|total\s*akhir/i;
// Plain "TOTAL" on its own (not subtotal, not "total item/qty")
const PLAIN_TOTAL_KW = /^\s*total\s*[\d.,]/i;
const TOTAL_KW = /^total\s*[:=]?\s*[\d,.]+/i;
const DATE_KW = /\b(date|tanggal|tgl|tagihan|waktu)\b/i;
// Address line heuristics — skip these for merchant detection
const ADDRESS_KW = /\b(jl\.|jln\.|jalan|no\.|gang|gg\.|blok|komplek|ruko|gedung|lantai|lt\.|kota|jakarta|bandung|surabaya|bali|bogor|depok|bekasi|tangerang)\b/i;
// Payment / junk lines that should never become items
const PAYMENT_KW = /\b(qris|cash|debit|kredit|tunai|kembalian|change|bayar|paid|not\s+paid|wifi|pass(?:word)?|ig:|instagram|follow)\b/i;
const MONTH_NAMES = /\b(jan|feb|mar|apr|may|mei|jun|jul|aug|agu|sep|oct|okt|nov|dec|des)\b/i;

// Item line patterns:
// Pattern A: "Nasi Goreng\n2x @15.000\n30.000"  (two lines)
// Pattern B: "2   Nasi Goreng    30.000"
// Pattern C: "Nasi Goreng   30.000"
const ITEM_QTY_PRICE_LINE = /^(\d+)\s*x?\s*@?\s*([\d.,]+)/i; // "2x @15.000" or "3 @14.000"
const ITEM_NAME_TOTAL = /^(.+?)\s{2,}([\d.,]+)\s*$/;         // "Nasi Goreng   30.000"
const ITEM_QTY_NAME_TOTAL = /^(\d+)\s+(.+?)\s{2,}([\d.,]+)\s*$/; // "2 Nasi Goreng   30.000"

// ─── Main Parser ──────────────────────────────────────────────────
export function parseReceiptText(rawText: string): Partial<Receipt> {
  const lines = rawText
    .split('\n')
    .map(l => l.trim())
    .filter(l => l.length > 1);

  const result: Partial<Receipt> = {
    merchantName: '',
    transactionDate: '',
    items: [],
    subtotal: 0,
    taxAmount: 0,
    serviceAmount: 0,
    discountAmount: 0,
    roundingAmount: 0,
    grandTotal: 0,
    currency: 'IDR',
  };

  const items: ReceiptItem[] = [];
  let merchantDetected = false;

  // ── Pass 1: Extract header & footer numbers ────────────────────
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const nextLine = lines[i + 1] || '';

    // Merchant: first non-empty, non-address, non-date, non-number line in top 12 lines
    if (!merchantDetected && i < 12 && !DATE_KW.test(line) && !/^[\d\W]/.test(line) && !ADDRESS_KW.test(line) && !/\d{3,}/.test(line) && !/^(table|pax|pos|op:|rcpt|cashier)/i.test(line)) {
      result.merchantName = line;
      merchantDetected = true;
      continue;
    }

    // Date
    if (!result.transactionDate && DATE_KW.test(line)) {
      const dateMatch = line.match(/(\d{1,2}[-\/]\d{1,2}[-\/]\d{2,4})|(\d{2}-\d{2}-\d{4})/);
      const timeMatch = line.match(/\d{2}:\d{2}/);
      if (dateMatch) {
        result.transactionDate = dateMatch[0] + (timeMatch ? ' ' + timeMatch[0] : '');
      } else {
        // Month-name format: "16 Apr 26 12:40" or "16 Apr 2026"
        const mnMatch = line.match(/(\d{1,2})\s+(jan|feb|mar|apr|may|mei|jun|jul|aug|agu|sep|oct|okt|nov|dec|des)\s+(\d{2,4})(?:\s+(\d{2}:\d{2}))?/i);
        if (mnMatch) {
          result.transactionDate = `${mnMatch[1]} ${mnMatch[2]} ${mnMatch[3]}` + (mnMatch[4] ? ' ' + mnMatch[4] : '');
        }
      }
    }

    // Also check standalone date line (e.g. date embedded in Rcpt# line)
    if (!result.transactionDate) {
      const dateMatch = line.match(/(\d{1,2}[-\/]\d{1,2}[-\/]\d{2,4}\s+\d{2}:\d{2})/);
      if (dateMatch) result.transactionDate = dateMatch[0];
    }

    // Subtotal
    if (SUBTOTAL_KW.test(line)) {
      const num = extractTrailingNumber(line) ?? extractTrailingNumber(nextLine);
      if (num !== null) result.subtotal = num;
    }

    // Tax
    if (TAX_KW.test(line) && !SUBTOTAL_KW.test(line)) {
      const num = extractTrailingNumber(line) ?? extractTrailingNumber(nextLine);
      if (num !== null) result.taxAmount = num;
    }

    // Service
    if (SERVICE_KW.test(line)) {
      const num = extractTrailingNumber(line) ?? extractTrailingNumber(nextLine);
      if (num !== null) result.serviceAmount = num;
    }

    // Discount
    if (DISCOUNT_KW.test(line)) {
      const num = extractTrailingNumber(line) ?? extractTrailingNumber(nextLine);
      if (num !== null) result.discountAmount = num;
    }

    // Rounding
    if (ROUNDING_KW.test(line)) {
      const num = extractTrailingNumber(line);
      if (num !== null) result.roundingAmount = num;
    }

    // Grand Total (highest priority)
    if (GRAND_TOTAL_KW.test(line)) {
      const num = extractTrailingNumber(line) ?? extractTrailingNumber(nextLine);
      if (num !== null) result.grandTotal = num;
    }

    // Plain "TOTAL  693,000" line (fallback, only if grandTotal not yet found)
    if (!result.grandTotal && PLAIN_TOTAL_KW.test(line) && !SUBTOTAL_KW.test(line)) {
      const num = extractTrailingNumber(line) ?? extractTrailingNumber(nextLine);
      if (num !== null) result.grandTotal = num;
    }
  }

  // ── Pass 2: Extract items ──────────────────────────────────────
  // Strategy: group lines into item blocks
  // An item block = name line + optional "qty x @price" sub-line
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    const nextLine = lines[i + 1] || '';

    // Skip header/footer keywords
    if (
      SUBTOTAL_KW.test(line) ||
      TAX_KW.test(line) ||
      SERVICE_KW.test(line) ||
      DISCOUNT_KW.test(line) ||
      GRAND_TOTAL_KW.test(line) ||
      PLAIN_TOTAL_KW.test(line) ||
      ROUNDING_KW.test(line) ||
      ADDRESS_KW.test(line) ||
      PAYMENT_KW.test(line) ||
      MONTH_NAMES.test(line) ||
      /^\d+\s+items?\b/i.test(line) ||
      /\d+\s+items?\b.*\d+\s+(produk|qty|pcs)\b/i.test(line) ||
      /^(date|time\s*in?|server|table|cashier|purpose|pax|no|sales|tagihan|dicetak|rcpt|pos[\s:$]|op:|presettlement|this\s+is|less\s+waste|not\s+paid|total\s+item|total\s+qty)/i.test(line) ||
      /^[-=*\s]+$/.test(line) ||
      /^\(?\+?\d[\d\s()\-]{6,}$/.test(line) ||
      line.length < 3
    ) {
      i++;
      continue;
    }

    // Pattern: name line → standalone total line → "qty x @unitPrice" line
    // e.g. "Nasi Rames\n42.000\n3x @14.000"  (OCR splits total to its own line)
    if (!isFooterLine(line) && /^[\d.,]+\s*$/.test(nextLine)) {
      const lineAfterNext = lines[i + 2] || '';
      const qtyUnitOnL2 = ITEM_QTY_PRICE_LINE.exec(normalizeOCRLine(lineAfterNext));
      if (qtyUnitOnL2) {
        const total = parseIndonesianNumber(nextLine.trim());
        const qty = parseInt(qtyUnitOnL2[1]);
        const unitPrice = parseIndonesianNumber(qtyUnitOnL2[2]);
        const name = line.replace(/[\d.,]+\s*$/, '').trim();
        if (name && qty > 0 && total > 0) {
          items.push(makeItem(name, qty, unitPrice > 0 ? unitPrice : total / qty, total));
          i += 3;
          continue;
        }
      }
    }

    // Pattern: item name line, followed by "qty x @unitPrice" line
    const qtyUnitMatch = ITEM_QTY_PRICE_LINE.exec(normalizeOCRLine(nextLine));
    if (qtyUnitMatch && !isFooterLine(line)) {
      // nextLine is "2x @15.000"
      const qty = parseInt(qtyUnitMatch[1]);
      const unitPrice = parseIndonesianNumber(qtyUnitMatch[2]);
      // Try to find total from the line after or from item name line suffix
      let total = extractTrailingNumber(line);
      if (total === null || total < unitPrice) {
        // look two lines ahead for total
        const lineAfterNext = lines[i + 2] || '';
        const possibleTotal = extractTrailingNumber(lineAfterNext);
        if (possibleTotal !== null && possibleTotal > 0) {
          total = possibleTotal;
          i++; // skip total line
        } else {
          total = qty * unitPrice;
        }
      }
      const name = line.replace(/[\d.,]+$/, '').trim();
      if (name && qty > 0 && unitPrice > 0) {
        items.push(makeItem(name, qty, unitPrice, total ?? qty * unitPrice));
        i += 2; // skip name + qty line
        continue;
      }
    }

    // Pattern: "qty  Name  Total" on one line
    const qtyNameTotal = ITEM_QTY_NAME_TOTAL.exec(line);
    if (qtyNameTotal) {
      const qty = parseInt(qtyNameTotal[1]);
      const name = qtyNameTotal[2].trim();
      const total = parseIndonesianNumber(qtyNameTotal[3]);
      if (!isFooterLine(name) && qty > 0 && total > 0 && name.length > 1) {
        items.push(makeItem(name, qty, total / qty, total));
        i++;
        continue;
      }
    }

    // Pattern: "Name  Total" on one line (qty assumed 1)
    const nameTotal = ITEM_NAME_TOTAL.exec(line);
    if (nameTotal) {
      const name = nameTotal[1].trim();
      const total = parseIndonesianNumber(nameTotal[2]);
      if (!isFooterLine(name) && total > 0 && name.length > 1 && total < 10_000_000) {
        items.push(makeItem(name, 1, total, total));
        i++;
        continue;
      }
    }

    // Fallback: single-space "Name Total" — OCR often drops alignment spaces.
    // Require total ≥ 1,000 to avoid false positives on short number-only lines.
    const loosMatch = /^(.+?)\s([\d.,]+)\s*$/.exec(line);
    if (loosMatch) {
      const name = loosMatch[1].trim();
      const total = parseIndonesianNumber(loosMatch[2]);
      if (!isFooterLine(name) && total >= 1000 && name.length > 2 && total < 10_000_000 && !/^\d+$/.test(name)) {
        items.push(makeItem(name, 1, total, total));
        i++;
        continue;
      }
    }

    i++;
  }

  result.items = items;

  // ── Reconcile: if subtotal missing, sum items ──────────────────
  if (!result.subtotal && items.length > 0) {
    result.subtotal = items.reduce((s, it) => s + it.totalPrice, 0);
  }

  // ── Reconcile: if grandTotal missing ──────────────────────────
  if (!result.grandTotal && result.subtotal) {
    result.grandTotal =
      result.subtotal +
      (result.taxAmount ?? 0) +
      (result.serviceAmount ?? 0) -
      (result.discountAmount ?? 0) +
      (result.roundingAmount ?? 0);
  }

  return result;
}

// ─── Helpers ──────────────────────────────────────────────────────
/**
 * Fix common OCR character misreads within number regions of a line.
 * Targets the price part after '@' or 'x' where l→1, O→0 are frequent.
 */
function normalizeOCRLine(line: string): string {
  return line
    // After @ sign: fix l/I→1 and O→0 in the price token
    .replace(/(@\s*)([\w.,]+)/g, (_, at, num) =>
      at + num.replace(/[lI]/g, '1').replace(/[oO]/g, '0')
    )
    // Normalize multiply signs: ×, x, X before @
    .replace(/(\d+)\s*[×xX]\s*@/g, '$1x @');
}

let _itemCounter = 1;
function makeItem(name: string, qty: number, unitPrice: number, totalPrice: number): ReceiptItem {
  return {
    id: `item_${Date.now()}_${_itemCounter++}`,
    name: name.trim(),
    qty,
    unitPrice: Math.round(unitPrice),
    totalPrice: Math.round(totalPrice),
  };
}

function extractTrailingNumber(line: string): number | null {
  // Find last number-like sequence at end of line
  const match = line.match(/([\d.]+,\d+|[\d,]+\.?\d*)[\s]*$/);
  if (match) {
    const n = parseIndonesianNumber(match[1]);
    if (!isNaN(n) && n > 0) return n;
  }
  return null;
}

function isFooterLine(s: string): boolean {
  return (
    SUBTOTAL_KW.test(s) ||
    TAX_KW.test(s) ||
    SERVICE_KW.test(s) ||
    DISCOUNT_KW.test(s) ||
    GRAND_TOTAL_KW.test(s) ||
    PLAIN_TOTAL_KW.test(s) ||
    TOTAL_KW.test(s) ||
    PAYMENT_KW.test(s) ||
    /^(date|time|server|table|cashier|purpose|pax|items|produk|thank|total\s+item|total\s+qty)\b/i.test(s)
  );
}
