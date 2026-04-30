import { useState } from 'react';
import { useBill, getNextAvatarColor } from '../context/BillContext';
import type { Participant } from '../types';
import { UserPlus, Trash2, Edit3, Check, X, Users } from 'lucide-react';

function generateId() {
  return `p_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

const QUICK_COUNTS = [2, 3, 4, 5];
const DEFAULT_NAMES = ['Andi', 'Budi', 'Cici', 'Dedi', 'Eka', 'Fani', 'Gita', 'Hadi'];

export default function ParticipantsPage() {
  const { state, dispatch, navigate } = useBill();
  const { participants } = state;
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [newName, setNewName] = useState('');

  const addParticipant = (name?: string) => {
    const finalName = (name || newName).trim();
    if (!finalName) return;
    dispatch({
      type: 'ADD_PARTICIPANT',
      payload: {
        id: generateId(),
        name: finalName,
        avatarColor: getNextAvatarColor(participants),
        isPaid: false,
      },
    });
    setNewName('');
  };

  const setQuickCount = (n: number) => {
    // Remove all first, then add up to n
    const currentCount = participants.length;
    if (n > currentCount) {
      for (let i = currentCount; i < n; i++) {
        dispatch({
          type: 'ADD_PARTICIPANT',
          payload: {
            id: generateId(),
            name: DEFAULT_NAMES[i] ?? `Orang ${i + 1}`,
            avatarColor: getNextAvatarColor([...participants, ...new Array(i - currentCount).fill(null)].filter(Boolean) as Participant[]),
            isPaid: false,
          },
        });
      }
    }
  };

  const startEdit = (p: Participant) => { setEditingId(p.id); setEditName(p.name); };
  const saveEdit = (p: Participant) => {
    if (editName.trim()) dispatch({ type: 'UPDATE_PARTICIPANT', payload: { ...p, name: editName.trim() } });
    setEditingId(null);
  };

  return (
    <div className="page participants-page">
      <h2 className="page-title">Peserta Split Bill</h2>
      <p className="page-sub">Tambahkan semua orang yang ikut makan</p>

      {/* Quick add */}
      <div className="section-card">
        <h3 className="section-title">Tambah Cepat</h3>
        <div className="quick-count-row">
          {QUICK_COUNTS.map(n => (
            <button
              key={n}
              className={`quick-count-btn ${participants.length === n ? 'active' : ''}`}
              onClick={() => setQuickCount(n)}
            >
              {n} orang
            </button>
          ))}
        </div>
      </div>

      {/* Add manual */}
      <div className="section-card">
        <h3 className="section-title">Tambah Peserta</h3>
        <div className="add-person-row">
          <input
            className="input-sm flex-1"
            placeholder="Nama peserta..."
            value={newName}
            onChange={e => setNewName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && addParticipant()}
          />
          <button className="btn-primary" onClick={() => addParticipant()}>
            <UserPlus size={16} /> Tambah
          </button>
        </div>
      </div>

      {/* List */}
      <div className="section-card">
        <div className="section-header">
          <h3 className="section-title"><Users size={16} /> Daftar Peserta ({participants.length})</h3>
        </div>

        {participants.length === 0 && (
          <p className="empty-hint">Belum ada peserta. Tambahkan minimal 1 orang.</p>
        )}

        <div className="participant-list">
          {participants.map(p => (
            <div key={p.id} className="participant-card">
              <div className="avatar" style={{ background: p.avatarColor }}>
                {p.name.charAt(0).toUpperCase()}
              </div>
              {editingId === p.id ? (
                <input
                  className="input-sm flex-1"
                  value={editName}
                  autoFocus
                  onChange={e => setEditName(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') { saveEdit(p); }
                    else if (e.key === 'Escape') { setEditingId(null); }
                  }}
                />
              ) : (
                <span className="participant-name">{p.name}</span>
              )}
              <div className="participant-actions">
                {editingId === p.id ? (
                  <>
                    <button className="btn-icon-success" onClick={() => saveEdit(p)}><Check size={15} /></button>
                    <button className="btn-icon" onClick={() => setEditingId(null)}><X size={15} /></button>
                  </>
                ) : (
                  <>
                    <button className="btn-icon" onClick={() => startEdit(p)}><Edit3 size={15} /></button>
                    <button className="btn-icon btn-icon--danger" onClick={() => dispatch({ type: 'DELETE_PARTICIPANT', payload: p.id })}><Trash2 size={15} /></button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="page-actions">
        <button className="btn-ghost" onClick={() => navigate('review')}>← Kembali</button>
        <button
          className="btn-primary"
          onClick={() => navigate('assign')}
          disabled={participants.length === 0}
        >
          Lanjut: Assign Item →
        </button>
      </div>
    </div>
  );
}
