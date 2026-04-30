import { useState } from 'react';
import { useBill } from '../context/BillContext';
import type { ReceiptItem } from '../types';
import { formatCurrency } from '../utils/calculator';
import {
  Edit3, Trash2, Plus, Check, X, AlertTriangle, Image as ImageIcon
} from 'lucide-react';

function generateId() {
  return `item_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

interface ItemRowProps {
  item: ReceiptItem;
  onUpdate: (item: ReceiptItem) => void;
  onDelete: (id: string) => void;
}

function ItemRow({ item, onUpdate, onDelete }: Readonly<ItemRowProps>) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(item);
  const [discountMode, setDiscountMode] = useState<'value' | 'pct'>('value');
  const [discountPct, setDiscountPct] = useState(
    item.discountAmount && item.totalPrice
      ? Math.round((item.discountAmount / item.totalPrice) * 100)
      : 0
  );

  const save = () => {
    const updated = {
      ...draft,
      unitPrice: Number(draft.unitPrice),
      qty: Number(draft.qty),
      totalPrice: Number(draft.qty) * Number(draft.unitPrice),
    };
    onUpdate(updated);
    setEditing(false);
  };

  const cancel = () => { setDraft(item); setEditing(false); };

  if (editing) {
    return (
      <div className="item-row item-row--editing">
        <div className="item-edit-grid">
          <div className="field-group">
            <label htmlFor="item-name">Nama Item</label>
            <input
              id="item-name"
              className="input-sm"
              value={draft.name}
              onChange={e => setDraft({ ...draft, name: e.target.value })}
              autoFocus
            />
          </div>
          <div className="field-row-2">
            <div className="field-group">
              <label htmlFor="item-qty">Qty</label>
              <input
                id="item-qty"
                className="input-sm"
                type="number"
                min={1}
                value={draft.qty}
                onChange={e => setDraft({ ...draft, qty: Number.parseInt(e.target.value) || 1, totalPrice: (Number.parseInt(e.target.value) || 1) * draft.unitPrice })}
              />
            </div>
            <div className="field-group">
              <label htmlFor="item-price">Harga Satuan</label>
              <input
                id="item-price"
                className="input-sm"
                type="number"
                min={0}
                value={draft.unitPrice}
                onChange={e => setDraft({ ...draft, unitPrice: Number.parseInt(e.target.value) || 0, totalPrice: draft.qty * (Number.parseInt(e.target.value) || 0) })}
              />
            </div>
          </div>
          <div className="field-group">
            <label htmlFor="item-total">Total Harga</label>
            <input
              id="item-total"
              className="input-sm"
              type="number"
              min={0}
              value={draft.totalPrice}
              onChange={e => setDraft({ ...draft, totalPrice: Number.parseInt(e.target.value) || 0 })}
            />
          </div>
          <div className="field-group">
            <label htmlFor="item-discount">Diskon Item (opsional)</label>
            <div className="discount-input-row">
              <input
                id="item-discount"
                className="input-sm"
                type="number"
                min={0}
                max={discountMode === 'pct' ? 100 : undefined}
                value={discountMode === 'pct' ? (discountPct || '') : (draft.discountAmount || '')}
                placeholder="0"
                onChange={e => {
                  if (discountMode === 'pct') {
                    const pct = Math.min(100, Number.parseInt(e.target.value) || 0);
                    setDiscountPct(pct);
                    setDraft({ ...draft, discountAmount: Math.round(draft.totalPrice * pct / 100) });
                  } else {
                    setDraft({ ...draft, discountAmount: Number.parseInt(e.target.value) || 0 });
                  }
                }}
              />
              <div className="discount-mode-toggle">
                <button
                  type="button"
                  className={`toggle-btn ${discountMode === 'value' ? 'active' : ''}`}
                  onClick={() => setDiscountMode('value')}
                >Rp</button>
                <button
                  type="button"
                  className={`toggle-btn ${discountMode === 'pct' ? 'active' : ''}`}
                  onClick={() => {
                    setDiscountMode('pct');
                    setDiscountPct(
                      draft.discountAmount && draft.totalPrice
                        ? Math.round((draft.discountAmount / draft.totalPrice) * 100)
                        : 0
                    );
                  }}
                >%</button>
              </div>
            </div>
          </div>
        </div>
        <div className="item-edit-actions">
          <button className="btn-icon-success" onClick={save}><Check size={16} /></button>
          <button className="btn-icon-danger" onClick={cancel}><X size={16} /></button>
        </div>
      </div>
    );
  }

  const netPrice = item.totalPrice - (item.discountAmount ?? 0);

  return (
    <div className="item-row">
      <div className="item-info">
        <span className="item-name">{item.name}</span>
        <span className="item-meta">{item.qty}x @ {formatCurrency(item.unitPrice)}</span>
        {(item.discountAmount ?? 0) > 0 && (
          <span className="item-discount-tag">Diskon: -{formatCurrency(item.discountAmount!)}</span>
        )}
      </div>
      <div className="item-right">
        {(item.discountAmount ?? 0) > 0 ? (
          <div className="item-price-group">
            <span className="item-total-original">{formatCurrency(item.totalPrice)}</span>
            <span className="item-total item-total--net">{formatCurrency(netPrice)}</span>
          </div>
        ) : (
          <span className="item-total">{formatCurrency(item.totalPrice)}</span>
        )}
        <button className="btn-icon" onClick={() => setEditing(true)}><Edit3 size={15} /></button>
        <button className="btn-icon btn-icon--danger" onClick={() => onDelete(item.id)}><Trash2 size={15} /></button>
      </div>
    </div>
  );
}

export default function ReviewPage() {
  const { state, dispatch, navigate } = useBill();
  const receipt = state.receipt;
  const [showImage, setShowImage] = useState(false);
  const [addingItem, setAddingItem] = useState(false);
  const [newItem, setNewItem] = useState<Partial<ReceiptItem>>({ name: '', qty: 1, unitPrice: 0, totalPrice: 0 });
  const [newDiscountMode, setNewDiscountMode] = useState<'value' | 'pct'>('value');
  const [newDiscountPct, setNewDiscountPct] = useState(0);

  if (!receipt) {
    return (
      <div className="page center-page">
        <p>Belum ada resi. <button className="link-btn" onClick={() => navigate('upload')}>Upload sekarang</button></p>
      </div>
    );
  }

  const subtotalFromItems = receipt.items.reduce((s, i) => s + i.totalPrice - (i.discountAmount ?? 0), 0);
  const computedGrandTotal = subtotalFromItems + receipt.taxAmount + receipt.serviceAmount - receipt.discountAmount + receipt.roundingAmount;
  const grandTotalMismatch = receipt.grandTotal > 0 && Math.abs(receipt.grandTotal - computedGrandTotal) > 5;

  const addItem = () => {
    if (!newItem.name?.trim()) return;
    const qty = newItem.qty || 1;
    const unitPrice = newItem.unitPrice || 0;
    dispatch({
      type: 'ADD_ITEM',
      payload: {
        id: generateId(),
        name: newItem.name.trim(),
        qty,
        unitPrice,
        totalPrice: newItem.totalPrice || qty * unitPrice,
        discountAmount: newItem.discountAmount || 0,
      },
    });
    setNewItem({ name: '', qty: 1, unitPrice: 0, totalPrice: 0, discountAmount: 0 });
    setNewDiscountPct(0);
    setNewDiscountMode('value');
    setAddingItem(false);
  };

  const updateTaxField = (field: string, val: number) => {
    dispatch({ type: 'UPDATE_RECEIPT_FIELD', payload: { [field]: val } });
  };

  return (
    <div className="page review-page">
      {/* Header info */}
      <div className="review-header">
        <div className="review-merchant">
          <h2 className="merchant-name">
            <input
              className="input-merchant"
              value={receipt.merchantName}
              onChange={e => dispatch({ type: 'UPDATE_RECEIPT_FIELD', payload: { merchantName: e.target.value } })}
              placeholder="Nama Merchant"
            />
          </h2>
          <span className="merchant-date">
            <input
              className="input-date"
              value={receipt.transactionDate}
              onChange={e => dispatch({ type: 'UPDATE_RECEIPT_FIELD', payload: { transactionDate: e.target.value } })}
              placeholder="Tanggal"
            />
          </span>
        </div>
        {receipt.imageUrl && (
          <button className="btn-icon" onClick={() => setShowImage(v => !v)}>
            <ImageIcon size={18} />
          </button>
        )}
      </div>

      {showImage && receipt.imageUrl && (
        <div className="receipt-image-preview">
          <img src={receipt.imageUrl} alt="Resi" />
        </div>
      )}

      {/* Items */}
      <div className="section-card">
        <div className="section-header">
          <h3 className="section-title">Daftar Item</h3>
          <button className="btn-add" onClick={() => setAddingItem(v => !v)}>
            {addingItem ? <X size={16} /> : <Plus size={16} />}
            {addingItem ? 'Batal' : 'Tambah'}
          </button>
        </div>

        {addingItem && (
          <div className="add-item-form">
            <input className="input-sm" placeholder="Nama item" value={newItem.name} onChange={e => setNewItem({ ...newItem, name: e.target.value })} autoFocus />
            <div className="field-row-3">
              <input className="input-sm" type="number" placeholder="Qty" min={1} value={newItem.qty} onChange={e => setNewItem({ ...newItem, qty: Number.parseInt(e.target.value) || 1 })} />
              <input className="input-sm" type="number" placeholder="Harga satuan" min={0} value={newItem.unitPrice || ''} onChange={e => setNewItem({ ...newItem, unitPrice: Number.parseInt(e.target.value) || 0, totalPrice: (newItem.qty || 1) * (Number.parseInt(e.target.value) || 0) })} />
              <input className="input-sm" type="number" placeholder="Total" min={0} value={newItem.totalPrice || ''} onChange={e => setNewItem({ ...newItem, totalPrice: Number.parseInt(e.target.value) || 0 })} />
            </div>
            <div className="discount-input-row">
              <input
                className="input-sm"
                type="number"
                placeholder="Diskon (opsional)"
                min={0}
                max={newDiscountMode === 'pct' ? 100 : undefined}
                value={newDiscountMode === 'pct' ? (newDiscountPct || '') : (newItem.discountAmount || '')}
                onChange={e => {
                  if (newDiscountMode === 'pct') {
                    const pct = Math.min(100, Number.parseInt(e.target.value) || 0);
                    setNewDiscountPct(pct);
                    setNewItem({ ...newItem, discountAmount: Math.round((newItem.totalPrice || 0) * pct / 100) });
                  } else {
                    setNewItem({ ...newItem, discountAmount: Number.parseInt(e.target.value) || 0 });
                  }
                }}
              />
              <div className="discount-mode-toggle">
                <button type="button" className={`toggle-btn ${newDiscountMode === 'value' ? 'active' : ''}`} onClick={() => setNewDiscountMode('value')}>Rp</button>
                <button type="button" className={`toggle-btn ${newDiscountMode === 'pct' ? 'active' : ''}`} onClick={() => { setNewDiscountMode('pct'); setNewDiscountPct(0); }}>%</button>
              </div>
            </div>
            <button className="btn-primary" onClick={addItem}>+ Tambahkan Item</button>
          </div>
        )}

        <div className="item-list">
          {receipt.items.length === 0 && (
            <p className="empty-hint">Belum ada item. Tambahkan item di atas.</p>
          )}
          {receipt.items.map(item => (
            <ItemRow
              key={item.id}
              item={item}
              onUpdate={updated => dispatch({ type: 'UPDATE_ITEM', payload: updated })}
              onDelete={id => dispatch({ type: 'DELETE_ITEM', payload: id })}
            />
          ))}
        </div>
      </div>

      {/* Taxes & totals */}
      <div className="section-card">
        <h3 className="section-title">Subtotal &amp; Biaya Tambahan</h3>
        <div className="totals-grid">
          <TotalRow label="Subtotal item" value={subtotalFromItems} readonly />
          <TotalRow label="Pajak (PB1/PPN/Tax)" value={receipt.taxAmount} onChange={v => updateTaxField('taxAmount', v)} />
          <TotalRow label="Biaya Layanan (Service)" value={receipt.serviceAmount} onChange={v => updateTaxField('serviceAmount', v)} />
          <TotalRow label="Diskon" value={receipt.discountAmount} negative onChange={v => updateTaxField('discountAmount', v)} />
          <TotalRow label="Pembulatan" value={receipt.roundingAmount} onChange={v => updateTaxField('roundingAmount', v)} />
          <TotalRow label="Grand Total (resi)" value={receipt.grandTotal} bold onChange={v => updateTaxField('grandTotal', v)} />
        </div>

        {grandTotalMismatch && (
          <div className="warning-banner">
            <AlertTriangle size={16} />
            <span>Grand total tidak cocok dengan kalkulasi (selisih Rp {Math.abs(receipt.grandTotal - computedGrandTotal).toLocaleString('id-ID')}). Periksa item atau pajak.</span>
          </div>
        )}
      </div>

      <div className="page-actions">
        <button className="btn-ghost" onClick={() => navigate('upload')}>← Kembali</button>
        <button
          className="btn-primary"
          onClick={() => navigate('participants')}
          disabled={receipt.items.length === 0}
        >
          Lanjut: Setup Peserta →
        </button>
      </div>
    </div>
  );
}

function TotalRow({
  label, value, negative = false, readonly = false, bold = false, onChange,
}: Readonly<{
  label: string; value: number; negative?: boolean; readonly?: boolean; bold?: boolean;
  onChange?: (v: number) => void;
}>) {
  return (
    <div className={`total-row ${bold ? 'total-row--bold' : ''}`}>
      <span className="total-label">{label}</span>
      {readonly ? (
        <span className={`total-value ${negative ? 'negative' : ''}`}>
          {negative ? '- ' : ''}{formatCurrency(value)}
        </span>
      ) : (
        <div className="total-input-wrap">
          {negative && <span className="total-prefix">-</span>}
          <input
            className="input-total"
            type="number"
            min={0}
            value={value || ''}
            placeholder="0"
            onChange={e => onChange?.(Number.parseInt(e.target.value) || 0)}
          />
        </div>
      )}
    </div>
  );
}
