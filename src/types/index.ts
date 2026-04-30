export interface ReceiptItem {
  id: string;
  name: string;
  qty: number;
  unitPrice: number;
  totalPrice: number;
  discountAmount?: number; // per-item discount
}

export interface Receipt {
  merchantName: string;
  transactionDate: string;
  items: ReceiptItem[];
  subtotal: number;
  taxAmount: number;
  serviceAmount: number;
  discountAmount: number;
  roundingAmount: number;
  grandTotal: number;
  currency: string;
  imageUrl?: string;
}

export type SplitMethod = 'full' | 'equal' | 'custom';

export interface ItemAssignment {
  itemId: string;
  method: SplitMethod;
  // For 'full': one participantId
  // For 'equal': list of participantIds (equal share)
  // For 'custom': portions map (participantId -> 0..1)
  portions: Record<string, number>; // participantId -> fraction (0-1)
}

export interface Participant {
  id: string;
  name: string;
  avatarColor: string;
  isPaid: boolean;
}

export interface PersonItemShare {
  item: ReceiptItem;
  portion: number; // fraction
  amount: number;
}

export interface ParticipantSummary {
  participant: Participant;
  items: PersonItemShare[];
  subtotalItems: number;
  taxShare: number;
  serviceShare: number;
  discountShare: number;
  roundingShare: number;
  grandTotal: number;
}

export type TaxSplitMode = 'proportional' | 'equal';
export type Language = 'id' | 'en';

export interface AppSettings {
  taxSplitMode: TaxSplitMode;
  language: Language;
}

export interface BillState {
  receipt: Receipt | null;
  participants: Participant[];
  assignments: ItemAssignment[];
  settings: AppSettings;
  currentPage: PageName;
}

export type PageName = 'home' | 'upload' | 'review' | 'participants' | 'assign' | 'summary';

export interface BillHistory {
  id: string;
  merchantName: string;
  transactionDate: string;
  grandTotal: number;
  participantCount: number;
  createdAt: string;
  receipt: Receipt;
  participants: Participant[];
  assignments: ItemAssignment[];
}

export type BillAction =
  | { type: 'SET_RECEIPT'; payload: Receipt }
  | { type: 'UPDATE_RECEIPT_FIELD'; payload: Partial<Receipt> }
  | { type: 'ADD_ITEM'; payload: ReceiptItem }
  | { type: 'UPDATE_ITEM'; payload: ReceiptItem }
  | { type: 'DELETE_ITEM'; payload: string }
  | { type: 'ADD_PARTICIPANT'; payload: Participant }
  | { type: 'UPDATE_PARTICIPANT'; payload: Participant }
  | { type: 'DELETE_PARTICIPANT'; payload: string }
  | { type: 'TOGGLE_PAID'; payload: string }
  | { type: 'SET_ASSIGNMENT'; payload: ItemAssignment }
  | { type: 'CLEAR_ASSIGNMENT'; payload: string }
  | { type: 'SET_PAGE'; payload: PageName }
  | { type: 'UPDATE_SETTINGS'; payload: Partial<AppSettings> }
  | { type: 'RESET_BILL' }
  | { type: 'LOAD_BILL_FROM_HISTORY'; payload: { receipt: Receipt; participants: Participant[]; assignments: ItemAssignment[] } };
