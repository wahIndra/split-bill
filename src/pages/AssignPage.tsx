import React, { useState } from 'react';
import { useBill } from '../context/BillContext';
import type { ItemAssignment, Participant, ReceiptItem, SplitMethod } from '../types';
import { formatCurrency, getUnassignedItems, getAssignmentCompletion } from '../utils/calculator';
import { Check, AlertCircle, Users, User, Sliders } from 'lucide-react';

// ── Assignment Modal ──────────────────────────────────────────────
interface AssignModalProps {
  item: ReceiptItem;
  participants: Participant[];
  current?: ItemAssignment;
  onSave: (a: ItemAssignment) => void;
  onClose: () => void;
}

function AssignModal({ item, participants, current, onSave, onClose }: Readonly<AssignModalProps>) {
  const [method, setMethod] = useState<SplitMethod>(current?.method ?? 'full');
  const [selected, setSelected] = useState<string[]>(
    current ? Object.keys(current.portions) : []
  );
  const [customPct, setCustomPct] = useState<Record<string, number>>(
    current
      ? Object.fromEntries(Object.entries(current.portions).map(([k, v]) => [k, Math.round(v * 100)]))
      : {}
  );

  const togglePerson = (id: string) => {
    setSelected(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const totalPct = Object.values(customPct).reduce((s, v) => s + v, 0);

  const buildPortions = (): Record<string, number> => {
    if (method === 'full') {
      if (selected.length !== 1) return {};
      return { [selected[0]]: 1 };
    }
    if (method === 'equal') {
      if (!selected.length) return {};
      const share = 1 / selected.length;
      return Object.fromEntries(selected.map(id => [id, share]));
    }
    // custom
    const result: Record<string, number> = {};
    for (const id of selected) {
      result[id] = (customPct[id] ?? 0) / 100;
    }
    return result;
  };

  const isValid = () => {
    if (method === 'full') return selected.length === 1;
    if (method === 'equal') return selected.length > 0;
    // custom: selected pct must sum to 100
    const sum = selected.reduce((s, id) => s + (customPct[id] ?? 0), 0);
    return selected.length > 0 && Math.abs(sum - 100) <= 1;
  };

  const handleSave = () => {
    const portions = buildPortions();
    onSave({ itemId: item.id, method, portions });
    onClose();
  };

  const distributeCustom = () => {
    if (!selected.length) return;
    const share = Math.floor(100 / selected.length);
    const remainder = 100 - share * selected.length;
    const newPct: Record<string, number> = {};
    selected.forEach((id, i) => { newPct[id] = share + (i === 0 ? remainder : 0); });
    setCustomPct(newPct);
  };

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" onClick={e => e.target === e.currentTarget && onClose()} onKeyDown={e => e.key === 'Escape' && onClose()}>
      <div className="modal-sheet">
        <div className="modal-handle" />
        <h3 className="modal-title">Assign: {item.name}</h3>
        <p className="modal-sub">{item.qty > 1 ? `${item.qty}x ` : ''}{formatCurrency(item.totalPrice)}</p>

        {/* Method selector */}
        <div className="method-tabs">
          {([
            { key: 'full', label: 'Full ke 1 orang', icon: <User size={14}/> },
            { key: 'equal', label: 'Bagi rata', icon: <Users size={14}/> },
            { key: 'custom', label: 'Custom %', icon: <Sliders size={14}/> },
          ] as { key: SplitMethod; label: string; icon: React.ReactNode }[]).map(m => (
            <button
              key={m.key}
              className={`method-tab ${method === m.key ? 'active' : ''}`}
              onClick={() => { setMethod(m.key); setSelected([]); }}
            >
              {m.icon} {m.label}
            </button>
          ))}
        </div>

        {/* Person selection */}
        <div className="person-select-list">
          {participants.map(p => {
            const isSelected = selected.includes(p.id);
            return (
              <button
                key={p.id}
                type="button"
                className={`person-select-row ${isSelected ? 'selected' : ''}`}
                onClick={() => {
                  if (method === 'full') {
                    setSelected([p.id]);
                  } else {
                    togglePerson(p.id);
                  }
                }}
              >
                <div className="avatar avatar-sm" style={{ background: p.avatarColor }}>
                  {p.name.charAt(0).toUpperCase()}
                </div>
                <span className="person-select-name">{p.name}</span>

                {method === 'custom' && isSelected && (
                  <div className="custom-pct-wrap" role="group" onClick={e => e.stopPropagation()} onKeyDown={e => e.stopPropagation()}>
                    <input
                      className="input-pct"
                      type="number"
                      min={0}
                      max={100}
                      value={customPct[p.id] ?? ''}
                      onChange={e => setCustomPct(prev => ({ ...prev, [p.id]: Number.parseInt(e.target.value) || 0 }))}
                    />
                    <span>%</span>
                  </div>
                )}

                {method === 'equal' && isSelected && (
                  <span className="equal-share-label">
                    {selected.length > 0 ? formatCurrency(Math.round(item.totalPrice / selected.length)) : ''}
                  </span>
                )}

                {isSelected && method !== 'custom' && (
                  <Check size={16} className="person-check" />
                )}
              </button>
            );
          })}
        </div>

        {method === 'custom' && selected.length > 0 && (
          <div className={`custom-pct-total ${Math.abs(totalPct - 100) > 1 ? 'error' : 'ok'}`}>
            <span>Total: {selected.reduce((s, id) => s + (customPct[id] ?? 0), 0)}%</span>
            <button className="link-btn" onClick={distributeCustom}>Bagi rata</button>
          </div>
        )}

        <div className="modal-actions">
          <button className="btn-ghost" onClick={onClose}>Batal</button>
          <button className="btn-primary" onClick={handleSave} disabled={!isValid()}>
            Simpan Assignment
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Assign Item Row ────────────────────────────────────────────────
function AssignItemRow({
  item, participants, assignment, onAssign,
}: Readonly<{
  item: ReceiptItem;
  participants: Participant[];
  assignment?: ItemAssignment;
  onAssign: () => void;
}>) {
  const isAssigned = assignment && Object.keys(assignment.portions).length > 0;
  const portionTotal = assignment ? Object.values(assignment.portions).reduce((s, v) => s + v, 0) : 0;
  const isComplete = isAssigned && Math.abs(portionTotal - 1) < 0.01;

  const getAssignedNames = () => {
    if (!assignment) return null;
    return Object.entries(assignment.portions)
      .filter(([, v]) => v > 0)
      .map(([id, v]) => {
        const p = participants.find(x => x.id === id);
        if (!p) return '';
        const pct = Math.round(v * 100);
        return pct < 100 ? `${p.name} ${pct}%` : p.name;
      })
      .filter(Boolean)
      .join(', ');
  };

  return (
    <button type="button" className={`assign-row ${isComplete ? 'assign-row--done' : 'assign-row--pending'}`} onClick={onAssign}>
      <div className="assign-item-info">
        <span className="assign-item-name">{item.name}</span>
        <span className="assign-item-meta">{item.qty > 1 ? `${item.qty}x · ` : ''}{formatCurrency(item.totalPrice)}</span>
        {isAssigned && (
          <span className="assign-item-to">→ {getAssignedNames()}</span>
        )}
      </div>
      <div className="assign-item-right">
        {isComplete ? (
          <span className="badge badge--success"><Check size={12} /> Done</span>
        ) : (
          <span className="badge badge--warning"><AlertCircle size={12} /> Belum</span>
        )}
      </div>
    </button>
  );
}

// ── Main Page ──────────────────────────────────────────────────────
export default function AssignPage() {
  const { state, dispatch, navigate } = useBill();
  const { receipt, participants, assignments } = state;
  const [activeItem, setActiveItem] = useState<ReceiptItem | null>(null);

  if (!receipt) return null;

  const completion = getAssignmentCompletion(receipt, assignments);
  const unassigned = getUnassignedItems(receipt, assignments);
  const pct = Math.round(completion * 100);

  const assignAll = (pid: string) => {
    for (const item of receipt.items) {
      dispatch({
        type: 'SET_ASSIGNMENT',
        payload: { itemId: item.id, method: 'full', portions: { [pid]: 1 } },
      });
    }
  };

  const assignAllEqual = () => {
    const share = 1 / participants.length;
    for (const item of receipt.items) {
      dispatch({
        type: 'SET_ASSIGNMENT',
        payload: {
          itemId: item.id,
          method: 'equal',
          portions: Object.fromEntries(participants.map(p => [p.id, share])),
        },
      });
    }
  };

  return (
    <div className="page assign-page">
      <h2 className="page-title">Assign Item</h2>
      <p className="page-sub">Tentukan siapa yang memesan setiap item</p>

      {/* Progress */}
      <div className="assign-progress-card">
        <div className="assign-progress-header">
          <span>Progress assign</span>
          <span className="assign-pct">{pct}%</span>
        </div>
        <div className="progress-track">
          <div className="progress-fill" style={{ width: `${pct}%` }} />
        </div>
        {unassigned.length > 0 && (
          <p className="assign-warning">{unassigned.length} item belum di-assign</p>
        )}
      </div>

      {/* Quick assign shortcuts */}
      {participants.length > 0 && (
        <div className="section-card">
          <h3 className="section-title">Quick Assign Semua Item</h3>
          <div className="quick-assign-row">
            <button className="btn-quick" onClick={assignAllEqual}>
              <Users size={14} /> Bagi rata semua
            </button>
            {participants.length === 1 && (
              <button className="btn-quick" onClick={() => assignAll(participants[0].id)}>
                <User size={14} /> Semua ke {participants[0].name}
              </button>
            )}
          </div>
        </div>
      )}

      {/* Item list */}
      <div className="section-card">
        <h3 className="section-title">Daftar Item ({receipt.items.length})</h3>
        <div className="assign-list">
          {receipt.items.map(item => (
            <AssignItemRow
              key={item.id}
              item={item}
              participants={participants}
              assignment={assignments.find(a => a.itemId === item.id)}
              onAssign={() => setActiveItem(item)}
            />
          ))}
        </div>
      </div>

      <div className="page-actions">
        <button className="btn-ghost" onClick={() => navigate('participants')}>← Kembali</button>
        <button
          className={`btn-primary ${pct < 100 ? 'btn-warning' : ''}`}
          onClick={() => navigate('summary')}
        >
          {pct < 100 ? `Lanjut (${unassigned.length} blm assigned)` : 'Lihat Summary →'}
        </button>
      </div>

      {/* Modal */}
      {activeItem && (
        <AssignModal
          item={activeItem}
          participants={participants}
          current={assignments.find(a => a.itemId === activeItem.id)}
          onSave={a => dispatch({ type: 'SET_ASSIGNMENT', payload: a })}
          onClose={() => setActiveItem(null)}
        />
      )}
    </div>
  );
}
