import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

// True only when real credentials are provided (not placeholders/empty)
export const isSupabaseConfigured =
  !!supabaseUrl &&
  !!supabaseAnonKey &&
  !supabaseUrl.startsWith('your_') &&
  !supabaseAnonKey.startsWith('your_');

if (!isSupabaseConfigured) {
  console.info('[SplitBill] Running in offline mode - auth & history require Supabase credentials.');
}

export const supabase = createClient(
  isSupabaseConfigured ? supabaseUrl : 'https://placeholder.supabase.co',
  isSupabaseConfigured ? supabaseAnonKey : 'placeholder',
);

export type Database = {
  public: {
    Tables: {
      bill_history: {
        Row: {
          id: string;
          user_id: string;
          merchant_name: string | null;
          transaction_date: string | null;
          grand_total: number;
          participant_count: number;
          receipt: unknown;
          participants: unknown;
          assignments: unknown;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['bill_history']['Row'], 'id' | 'created_at'>;
      };
    };
  };
};
