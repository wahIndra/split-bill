import React, { createContext, useContext, useReducer, useMemo, useCallback } from 'react';
import type {
  BillState,
  BillAction,
  Participant,
  ItemAssignment,
  PageName,
} from '../types';

const AVATAR_COLORS = [
  '#6366f1', '#ec4899', '#10b981', '#f59e0b',
  '#3b82f6', '#8b5cf6', '#ef4444', '#14b8a6',
];

export function getNextAvatarColor(participants: Participant[]): string {
  const used = new Set(participants.map(p => p.avatarColor));
  return AVATAR_COLORS.find(c => !used.has(c)) ?? AVATAR_COLORS[participants.length % AVATAR_COLORS.length];
}

const initialState: BillState = {
  receipt: null,
  participants: [],
  assignments: [],
  settings: { taxSplitMode: 'proportional', language: 'id' },
  currentPage: 'home',
};

function reducer(state: BillState, action: BillAction): BillState {
  switch (action.type) {
    case 'SET_RECEIPT':
      return { ...state, receipt: action.payload, assignments: [] };

    case 'UPDATE_RECEIPT_FIELD':
      if (!state.receipt) return state;
      return { ...state, receipt: { ...state.receipt, ...action.payload } };

    case 'ADD_ITEM': {
      if (!state.receipt) return state;
      return {
        ...state,
        receipt: { ...state.receipt, items: [...state.receipt.items, action.payload] },
      };
    }

    case 'UPDATE_ITEM': {
      if (!state.receipt) return state;
      return {
        ...state,
        receipt: {
          ...state.receipt,
          items: state.receipt.items.map(it => it.id === action.payload.id ? action.payload : it),
        },
      };
    }

    case 'DELETE_ITEM': {
      if (!state.receipt) return state;
      return {
        ...state,
        receipt: {
          ...state.receipt,
          items: state.receipt.items.filter(it => it.id !== action.payload),
        },
        assignments: state.assignments.filter(a => a.itemId !== action.payload),
      };
    }

    case 'ADD_PARTICIPANT':
      return { ...state, participants: [...state.participants, action.payload] };

    case 'UPDATE_PARTICIPANT':
      return {
        ...state,
        participants: state.participants.map(p => p.id === action.payload.id ? action.payload : p),
      };

    case 'DELETE_PARTICIPANT': {
      const newParticipants = state.participants.filter(p => p.id !== action.payload);
      // Clean up assignments that reference deleted participant
      const newAssignments = state.assignments.map(a => {
        const { [action.payload]: _removed, ...rest } = a.portions;
        const total = Object.values(rest).reduce((s, v) => s + v, 0);
        if (total <= 0) return null;
        return { ...a, portions: rest };
      }).filter(Boolean) as ItemAssignment[];
      return { ...state, participants: newParticipants, assignments: newAssignments };
    }

    case 'TOGGLE_PAID':
      return {
        ...state,
        participants: state.participants.map(p =>
          p.id === action.payload ? { ...p, isPaid: !p.isPaid } : p
        ),
      };

    case 'SET_ASSIGNMENT': {
      const exists = state.assignments.find(a => a.itemId === action.payload.itemId);
      if (exists) {
        return {
          ...state,
          assignments: state.assignments.map(a =>
            a.itemId === action.payload.itemId ? action.payload : a
          ),
        };
      }
      return { ...state, assignments: [...state.assignments, action.payload] };
    }

    case 'CLEAR_ASSIGNMENT':
      return { ...state, assignments: state.assignments.filter(a => a.itemId !== action.payload) };

    case 'SET_PAGE':
      return { ...state, currentPage: action.payload };

    case 'UPDATE_SETTINGS':
      return { ...state, settings: { ...state.settings, ...action.payload } };

    case 'RESET_BILL':
      return {
        ...initialState,
        settings: state.settings,
      };

    case 'LOAD_BILL_FROM_HISTORY':
      return {
        ...state,
        receipt: action.payload.receipt,
        participants: action.payload.participants,
        assignments: action.payload.assignments,
        currentPage: 'summary',
      };

    default:
      return state;
  }
}

interface BillContextType {
  state: BillState;
  dispatch: React.Dispatch<BillAction>;
  navigate: (page: PageName) => void;
}

const BillContext = createContext<BillContextType | null>(null);

export function BillProvider({ children }: Readonly<{ children: React.ReactNode }>) {
  const [state, dispatch] = useReducer(reducer, initialState);

  const navigate = useCallback((page: PageName) => dispatch({ type: 'SET_PAGE', payload: page }), []);

  const contextValue = useMemo(() => ({ state, dispatch, navigate }), [state, dispatch]);

  return (
    <BillContext.Provider value={contextValue}>
      {children}
    </BillContext.Provider>
  );
}

export function useBill() {
  const ctx = useContext(BillContext);
  if (!ctx) throw new Error('useBill must be inside BillProvider');
  return ctx;
}
