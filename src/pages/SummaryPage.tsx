import { useState, useEffect, useRef } from 'react';
import { useBill } from '../context/BillContext';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { calculateSplitBill, formatCurrency, getAssignmentCompletion } from '../utils/calculator';
import { generateTextSummary, copyToClipboard, shareText, exportAsImage, exportAsPDF } from '../utils/export';
import type { ParticipantSummary } from '../types';
import {
  CheckCircle, Circle, Share2, Copy, Download, FileText,
  ChevronDown, ChevronUp, AlertTriangle, Wallet,
} from 'lucide-react';

function PersonCard({
  summary,
  expanded,
  onToggle,
  onTogglePaid,
}: Readonly<{
  summary: ParticipantSummary;
  expanded: boolean;
  onToggle: () => void;
  onTogglePaid: () => void;
}>) {
  const { participant: p, items, subtotalItems, taxShare, serviceShare, discountShare, grandTotal } = summary;

  return (
    <div className={`person-card ${p.isPaid ? 'person-card--paid' : ''}`}>
      <button type="button" className="person-card-header" onClick={onToggle}>
        <div className="person-card-left">
          <div className="avatar" style={{ background: p.avatarColor }}>
            {p.name.charAt(0).toUpperCase()}
          </div>
          <div className="person-card-meta">
            <span className="person-card-name">{p.name}</span>
            <span className="person-card-items">{items.length} item</span>
          </div>
        </div>
        <div className="person-card-right">
          <span className="person-card-total">{formatCurrency(grandTotal)}</span>
          {expanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
        </div>
      </button>

      {expanded && (
        <div className="person-card-body">
          {items.map(({ item, portion, amount }) => (
            <div key={item.id} className="breakdown-row">
              <span className="breakdown-name">
                {item.name}
                {item.qty > 1 && <span className="breakdown-qty"> ×{item.qty}</span>}
                {portion < 1 && (
                  <span className="breakdown-pct"> ({Math.round(portion * 100)}%)</span>
                )}
              </span>
              <span className="breakdown-amount">{formatCurrency(amount)}</span>
            </div>
          ))}
          <div className="breakdown-divider" />
          <div className="breakdown-row">
            <span className="breakdown-label">Subtotal item</span>
            <span className="breakdown-amount">{formatCurrency(subtotalItems)}</span>
          </div>
          {taxShare > 0 && (
            <div className="breakdown-row breakdown-extra">
              <span className="breakdown-label">+ Pajak</span>
              <span className="breakdown-amount">{formatCurrency(taxShare)}</span>
            </div>
          )}
          {serviceShare > 0 && (
            <div className="breakdown-row breakdown-extra">
              <span className="breakdown-label">+ Service</span>
              <span className="breakdown-amount">{formatCurrency(serviceShare)}</span>
            </div>
          )}
          {discountShare > 0 && (
            <div className="breakdown-row breakdown-extra negative">
              <span className="breakdown-label">− Diskon</span>
              <span className="breakdown-amount">-{formatCurrency(discountShare)}</span>
            </div>
          )}
          <div className="breakdown-total-row">
            <span>Total Bayar</span>
            <span className="breakdown-grand">{formatCurrency(grandTotal)}</span>
          </div>

          <button
            className={`btn-paid ${p.isPaid ? 'btn-paid--done' : ''}`}
            onClick={e => { e.stopPropagation(); onTogglePaid(); }}
          >
            {p.isPaid ? (
              <><CheckCircle size={16} /> Sudah Bayar ✓</>
            ) : (
              <><Circle size={16} /> Tandai Sudah Bayar</>
            )}
          </button>
        </div>
      )}
    </div>
  );
}

export default function SummaryPage() {
  const { state, dispatch, navigate } = useBill();
  const { user, isGuest } = useAuth();
  const { receipt, participants, assignments, settings } = state;
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [copyFeedback, setCopyFeedback] = useState(false);
  const [summaries, setSummaries] = useState<ParticipantSummary[]>([]);
  const [exporting, setExporting] = useState<string | null>(null);
  const savedRef = useRef(false);

  useEffect(() => {
    if (!receipt || participants.length === 0) return;
    const result = calculateSplitBill(receipt, participants, assignments, settings.taxSplitMode);
    setSummaries(result);
  }, [receipt, participants, assignments, settings.taxSplitMode]);

  // Save to Supabase once per summary visit (Google users only)
  useEffect(() => {
    if (!receipt || participants.length === 0) return;
    if (!user || isGuest) return;
    if (savedRef.current) return;
    savedRef.current = true;
    supabase.from('bill_history').insert({
      user_id: user.id,
      merchant_name: receipt.merchantName || null,
      transaction_date: receipt.transactionDate || null,
      grand_total: receipt.grandTotal,
      participant_count: participants.length,
      receipt: receipt as unknown as Record<string, unknown>,
      participants: participants as unknown as Record<string, unknown>[],
      assignments: assignments as unknown as Record<string, unknown>[],
    }).then(() => { /* silent */ });
  }, [receipt, participants, assignments, user, isGuest]);

  if (!receipt) return null;

  const completion = getAssignmentCompletion(receipt, assignments);
  const sumGrand = summaries.reduce((s, p) => s + p.grandTotal, 0);
  const diff = receipt.grandTotal > 0 ? receipt.grandTotal - sumGrand : 0;
  const paidCount = participants.filter(p => p.isPaid).length;

  const textSummary = summaries.length > 0 ? generateTextSummary(receipt, summaries) : '';

  const handleCopy = async () => {
    await copyToClipboard(textSummary);
    setCopyFeedback(true);
    setTimeout(() => setCopyFeedback(false), 2000);
  };

  const handleShare = () => shareText(textSummary, `Split Bill - ${receipt.merchantName}`);

  const handleExport = async (type: 'image' | 'pdf') => {
    setExporting(type);
    try {
      if (type === 'image') await exportAsImage('summary-export');
      else await exportAsPDF('summary-export');
    } finally {
      setExporting(null);
    }
  };

  return (
    <div className="page summary-page">
      {/* Bill header */}
      <div className="summary-header">
        <h2 className="summary-merchant">{receipt.merchantName}</h2>
        <p className="summary-date">{receipt.transactionDate}</p>
        <div className="summary-grand">
          <span className="summary-grand-label">Grand Total</span>
          <span className="summary-grand-value">{formatCurrency(receipt.grandTotal)}</span>
        </div>
        <div className="summary-stats">
          <div className="stat-chip">
            <Wallet size={13} /> {participants.length} orang
          </div>
          <div className="stat-chip">
            <CheckCircle size={13} /> {paidCount}/{participants.length} bayar
          </div>
        </div>
      </div>

      {/* Warning if not fully assigned */}
      {completion < 1 && (
        <div className="warning-banner">
          <AlertTriangle size={16} />
          <span>Beberapa item belum di-assign. <button className="link-btn" onClick={() => navigate('assign')}>Kembali assign</button></span>
        </div>
      )}

      {/* Diff warning */}
      {Math.abs(diff) > 10 && (
        <div className="warning-banner">
          <AlertTriangle size={16} />
          <span>Selisih kalkulasi: {formatCurrency(Math.abs(diff))}. Periksa item yang belum di-assign.</span>
        </div>
      )}

      {/* Person cards - exportable area */}
      <div id="summary-export" className="summary-cards">
        <div className="export-header-meta">
          <p className="export-merchant">{receipt.merchantName} · {receipt.transactionDate}</p>
        </div>
        {summaries.map(s => (
          <PersonCard
            key={s.participant.id}
            summary={s}
            expanded={expandedId === s.participant.id}
            onToggle={() => setExpandedId(prev => prev === s.participant.id ? null : s.participant.id)}
            onTogglePaid={() => dispatch({ type: 'TOGGLE_PAID', payload: s.participant.id })}
          />
        ))}
        {/* Totals reconcile */}
        <div className="summary-total-row">
          <span>Total semua</span>
          <span>{formatCurrency(sumGrand)}</span>
        </div>
        <div className="export-watermark">Dibuat dengan SplitBill 🍽️</div>
      </div>

      {/* Tax mode toggle */}
      <div className="section-card settings-row">
        <span className="settings-label">Mode bagi pajak</span>
        <div className="toggle-group">
          <button
            className={`toggle-btn ${settings.taxSplitMode === 'proportional' ? 'active' : ''}`}
            onClick={() => dispatch({ type: 'UPDATE_SETTINGS', payload: { taxSplitMode: 'proportional' } })}
          >
            Proporsional
          </button>
          <button
            className={`toggle-btn ${settings.taxSplitMode === 'equal' ? 'active' : ''}`}
            onClick={() => dispatch({ type: 'UPDATE_SETTINGS', payload: { taxSplitMode: 'equal' } })}
          >
            Rata
          </button>
        </div>
      </div>

      {/* Share & Export */}
      <div className="section-card">
        <h3 className="section-title">Bagikan Hasil</h3>
        <div className="share-grid">
          <button className="share-btn" onClick={handleCopy}>
            {copyFeedback ? <CheckCircle size={18} /> : <Copy size={18} />}
            <span>{copyFeedback ? 'Tersalin!' : 'Salin Teks'}</span>
          </button>
          <button className="share-btn" onClick={handleShare}>
            <Share2 size={18} />
            <span>Share</span>
          </button>
          <button className="share-btn" onClick={() => handleExport('image')} disabled={exporting === 'image'}>
            <Download size={18} />
            <span>{exporting === 'image' ? '...' : 'Simpan Gambar'}</span>
          </button>
          <button className="share-btn" onClick={() => handleExport('pdf')} disabled={exporting === 'pdf'}>
            <FileText size={18} />
            <span>{exporting === 'pdf' ? '...' : 'Export PDF'}</span>
          </button>
        </div>
      </div>

      <div className="page-actions">
        <button className="btn-ghost" onClick={() => navigate('assign')}>← Edit Assign</button>
        <button className="btn-secondary" onClick={() => { dispatch({ type: 'RESET_BILL' }); navigate('home'); }}>
          Split Bill Baru
        </button>
      </div>
    </div>
  );
}
