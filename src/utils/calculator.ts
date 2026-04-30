import type {
  Receipt,
  Participant,
  ItemAssignment,
  ParticipantSummary,
  TaxSplitMode,
} from '../types';

export function calculateSplitBill(
  receipt: Receipt,
  participants: Participant[],
  assignments: ItemAssignment[],
  taxSplitMode: TaxSplitMode = 'proportional'
): ParticipantSummary[] {
  const assignMap = new Map<string, ItemAssignment>(assignments.map(a => [a.itemId, a]));

  // Build per-person item totals
  const personItemTotals = new Map<string, number>(participants.map(p => [p.id, 0]));

  const summaries: ParticipantSummary[] = participants.map(p => ({
    participant: p,
    items: [],
    subtotalItems: 0,
    taxShare: 0,
    serviceShare: 0,
    discountShare: 0,
    roundingShare: 0,
    grandTotal: 0,
  }));

  const summaryMap = new Map<string, ParticipantSummary>(summaries.map(s => [s.participant.id, s]));

  // Distribute items
  for (const item of receipt.items) {
    const assignment = assignMap.get(item.id);
    if (!assignment) continue;

    for (const [pid, fraction] of Object.entries(assignment.portions)) {
      const summary = summaryMap.get(pid);
      if (!summary || fraction <= 0) continue;
      const amount = Math.round((item.totalPrice - (item.discountAmount ?? 0)) * fraction);
      summary.items.push({ item, portion: fraction, amount });
      summary.subtotalItems += amount;
      personItemTotals.set(pid, (personItemTotals.get(pid) ?? 0) + amount);
    }
  }

  const totalSubtotalAssigned = [...personItemTotals.values()].reduce((a, b) => a + b, 0);
  const safeTotal = totalSubtotalAssigned || 1;

  // Distribute tax, service, discount, rounding
  for (const summary of summaries) {
    const pid = summary.participant.id;
    const personSub = personItemTotals.get(pid) ?? 0;

    if (taxSplitMode === 'proportional') {
      const ratio = personSub / safeTotal;
      summary.taxShare = Math.round(receipt.taxAmount * ratio);
      summary.serviceShare = Math.round(receipt.serviceAmount * ratio);
      summary.discountShare = Math.round(receipt.discountAmount * ratio);
      summary.roundingShare = Math.round(receipt.roundingAmount * ratio);
    } else {
      // Equal split
      const count = participants.length || 1;
      summary.taxShare = Math.round(receipt.taxAmount / count);
      summary.serviceShare = Math.round(receipt.serviceAmount / count);
      summary.discountShare = Math.round(receipt.discountAmount / count);
      summary.roundingShare = Math.round(receipt.roundingAmount / count);
    }

    summary.grandTotal =
      summary.subtotalItems +
      summary.taxShare +
      summary.serviceShare -
      summary.discountShare +
      summary.roundingShare;
  }

  // Rounding correction: only apply when grandTotal was explicitly set
  // and the difference is small (≤ participant count, i.e. pure rounding cents).
  const sumGrand = summaries.reduce((s, p) => s + p.grandTotal, 0);
  if (receipt.grandTotal > 0) {
    const diff = receipt.grandTotal - sumGrand;
    const maxAllowedDiff = participants.length + 1; // rounding noise only
    if (diff !== 0 && Math.abs(diff) <= maxAllowedDiff && summaries.length > 0) {
      const maxSummary = summaries.reduce((a, b) =>
        a.subtotalItems >= b.subtotalItems ? a : b
      , summaries[0]);
      maxSummary.grandTotal += diff;
    }
  }

  return summaries;
}

export function getUnassignedItems(
  receipt: Receipt,
  assignments: ItemAssignment[]
): string[] {
  const assignedIds = new Set(assignments.map(a => a.itemId));
  return receipt.items.filter(it => !assignedIds.has(it.id)).map(it => it.id);
}

export function getAssignmentCompletion(
  receipt: Receipt,
  assignments: ItemAssignment[]
): number {
  if (!receipt.items.length) return 1;
  const assignedCount = assignments.filter(a => {
    const totalPortion = Object.values(a.portions).reduce((s, v) => s + v, 0);
    return Math.abs(totalPortion - 1) < 0.01;
  }).length;
  return assignedCount / receipt.items.length;
}

export function formatCurrency(amount: number, currency = 'IDR'): string {
  if (currency === 'IDR') {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
    }).format(amount);
  }
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
  }).format(amount);
}

export function formatNumber(amount: number): string {
  return new Intl.NumberFormat('id-ID').format(amount);
}
