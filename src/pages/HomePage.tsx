import { useEffect, useState } from 'react';
import { useBill } from '../context/BillContext';
import { useAuth } from '../context/AuthContext';
import type { BillHistory } from '../types';
import { supabase } from '../lib/supabase';
import { formatCurrency } from '../utils/calculator';
import { Camera, FileText, Receipt, Sparkles, Clock, ChevronRight, Trash2 } from 'lucide-react';

const EMPTY_RECEIPT = {
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

export default function HomePage() {
  const { navigate, dispatch } = useBill();
  const { user, isGuest } = useAuth();
  const [history, setHistory] = useState<BillHistory[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  useEffect(() => {
    if (!user || isGuest) return;
    setHistoryLoading(true);
    supabase
      .from('bill_history')
      .select('id, merchant_name, transaction_date, grand_total, participant_count, receipt, participants, assignments, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(10)
      .then(({ data }) => {
        if (data) {
          setHistory(data.map(r => ({
            id: r.id as string,
            merchantName: (r.merchant_name as string) ?? '—',
            transactionDate: (r.transaction_date as string) ?? '',
            grandTotal: r.grand_total as number,
            participantCount: r.participant_count as number,
            createdAt: r.created_at as string,
            receipt: r.receipt,
            participants: r.participants,
            assignments: r.assignments,
          } as BillHistory)));
        }
        setHistoryLoading(false);
      });
  }, [user, isGuest]);

  const deleteHistory = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    await supabase.from('bill_history').delete().eq('id', id);
    setHistory(prev => prev.filter(h => h.id !== id));
  };

  function startNew(mode: 'upload' | 'manual') {
    dispatch({ type: 'RESET_BILL' });
    if (mode === 'manual') {
      dispatch({ type: 'SET_RECEIPT', payload: EMPTY_RECEIPT });
      navigate('review');
    } else {
      navigate('upload');
    }
  }

  function loadHistory(h: BillHistory) {
    dispatch({
      type: 'LOAD_BILL_FROM_HISTORY',
      payload: { receipt: h.receipt, participants: h.participants, assignments: h.assignments },
    });
  }

  return (
    <div className="page home-page">
      {/* Hero */}
      <div className="hero-section">
        <div className="hero-icon">
          <Receipt size={40} />
        </div>
        <h1 className="hero-title">SplitBill</h1>
        <p className="hero-sub">Bagi tagihan dengan mudah &amp; transparan</p>
      </div>

      {/* CTA Buttons */}
      <div className="cta-group">
        <button className="btn-primary btn-large" onClick={() => startNew('upload')}>
          <Camera size={22} />
          <span>Scan / Upload Resi</span>
          <Sparkles size={16} className="btn-icon-end" />
        </button>
        <button className="btn-secondary btn-large" onClick={() => startNew('manual')}>
          <FileText size={20} />
          <span>Input Manual</span>
        </button>
      </div>

      {/* Features */}
      <div className="features-grid">
        {[
          { icon: '📸', label: 'Scan Resi', desc: 'OCR otomatis' },
          { icon: '👥', label: 'Multi Orang', desc: 'Assign item' },
          { icon: '🧮', label: 'Kalkulasi', desc: 'Pajak adil' },
          { icon: '📤', label: 'Share', desc: 'PDF & teks' },
        ].map(f => (
          <div key={f.label} className="feature-card">
            <span className="feature-icon">{f.icon}</span>
            <span className="feature-label">{f.label}</span>
            <span className="feature-desc">{f.desc}</span>
          </div>
        ))}
      </div>

      {/* History — Google users only */}
      {!isGuest && (
        <section className="history-section">
          <h2 className="history-heading">
            <Clock size={16} /> Riwayat Split Bill
          </h2>
          {historyLoading && <p className="history-empty">Memuat riwayat…</p>}
          {!historyLoading && history.length === 0 && (
            <p className="history-empty">Belum ada riwayat. Mulai split bill pertamamu!</p>
          )}
          <div className="history-list">
            {history.map(h => (
              <button key={h.id} className="history-card" onClick={() => loadHistory(h)}>
                <div className="history-info">
                  <span className="history-merchant">{h.merchantName || '(tanpa nama)'}</span>
                  <span className="history-meta">
                    {h.transactionDate || new Date(h.createdAt).toLocaleDateString('id-ID')}
                    {' · '}{h.participantCount} orang
                  </span>
                </div>
                <div className="history-right">
                  <span className="history-total">{formatCurrency(h.grandTotal)}</span>
                  <ChevronRight size={16} className="history-arrow" />
                  <button
                    className="btn-icon btn-icon--danger history-delete"
                    title="Hapus"
                    onClick={e => deleteHistory(h.id, e)}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </button>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

