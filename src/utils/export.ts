import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import type { ParticipantSummary, Receipt } from '../types';
import { formatCurrency } from './calculator';

export function generateTextSummary(
  receipt: Receipt,
  summaries: ParticipantSummary[]
): string {
  const lines: string[] = [];
  lines.push(`🧾 SPLIT BILL — ${receipt.merchantName}`);
  lines.push(`📅 ${receipt.transactionDate}`);
  lines.push('─'.repeat(40));

  for (const s of summaries) {
    lines.push(`\n👤 ${s.participant.name}`);
    for (const pi of s.items) {
      const pct = Math.round(pi.portion * 100);
      lines.push(
        `  • ${pi.item.name} (${pi.item.qty > 1 ? pi.item.qty + 'x ' : ''}${pct < 100 ? pct + '%' : ''}) → ${formatCurrency(pi.amount)}`
      );
    }
    if (s.taxShare > 0) lines.push(`  + Pajak: ${formatCurrency(s.taxShare)}`);
    if (s.serviceShare > 0) lines.push(`  + Service: ${formatCurrency(s.serviceShare)}`);
    if (s.discountShare > 0) lines.push(`  - Diskon: ${formatCurrency(s.discountShare)}`);
    lines.push(`  💰 Total: ${formatCurrency(s.grandTotal)}`);
    lines.push(`  Status: ${s.participant.isPaid ? '✅ Sudah bayar' : '⏳ Belum bayar'}`);
  }

  lines.push('\n' + '─'.repeat(40));
  lines.push(`Grand Total: ${formatCurrency(receipt.grandTotal)}`);
  lines.push('\nDibuat dengan SplitBill App 🍽️');
  return lines.join('\n');
}

export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Fallback
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    return ok;
  }
}

export async function shareText(text: string, title = 'Split Bill'): Promise<boolean> {
  if (navigator.share) {
    try {
      await navigator.share({ title, text });
      return true;
    } catch {
      return false;
    }
  }
  return copyToClipboard(text);
}

export async function exportAsImage(elementId: string): Promise<void> {
  const el = document.getElementById(elementId);
  if (!el) return;
  const canvas = await html2canvas(el, { scale: 2, backgroundColor: '#0f0f1a' });
  const url = canvas.toDataURL('image/png');
  const a = document.createElement('a');
  a.href = url;
  a.download = 'splitbill-summary.png';
  a.click();
}

export async function exportAsPDF(elementId: string): Promise<void> {
  const el = document.getElementById(elementId);
  if (!el) return;
  const canvas = await html2canvas(el, { scale: 2, backgroundColor: '#0f0f1a' });
  const imgData = canvas.toDataURL('image/png');
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'px', format: [canvas.width / 2, canvas.height / 2] });
  pdf.addImage(imgData, 'PNG', 0, 0, canvas.width / 2, canvas.height / 2);
  pdf.save('splitbill-summary.pdf');
}
