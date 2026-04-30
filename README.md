# 🍽️ SplitBill

A mobile-first web app to split restaurant bills fairly — scan a receipt with your camera, assign items to people, and instantly see how much everyone owes.

## Features

- **Scan / OCR** — Upload or photograph a receipt; Tesseract.js reads it automatically
- **Manual input** — Add items by hand without needing a receipt photo
- **Multi-person assignment** — Assign each item to one person, split equally, or set custom percentages
- **Per-item discount** — Add discounts as a fixed amount or percentage per item
- **Tax & service split** — Proportional or equal split of PB1, PPN, SC, and other charges
- **Summary view** — Per-person breakdown with paid/unpaid status
- **Export** — Share as text, copy to clipboard, save as image or PDF
- **Auth + History** — Sign in with Google (Supabase) to persist bill history; guest mode for quick use

## Tech Stack

| Layer     | Tech                                                |
| --------- | --------------------------------------------------- |
| UI        | React 19 + TypeScript + Vite                        |
| Styling   | Plain CSS (custom design system)                    |
| OCR       | Tesseract.js (ind + eng)                            |
| Export    | html2canvas + jsPDF                                 |
| Auth + DB | Supabase (Google OAuth, anonymous auth, PostgreSQL) |
| Icons     | Lucide React                                        |

## Getting Started

```bash
npm install
npm run dev
```

The app runs fully offline without Supabase — auth and history are skipped automatically when credentials are missing.

### With Supabase (optional)

1. Create a project at [supabase.com](https://supabase.com)
2. Copy your credentials into `.env.local`:
   ```
   VITE_SUPABASE_URL=https://xxxx.supabase.co
   VITE_SUPABASE_ANON_KEY=eyJ...
   ```
3. Run this SQL in your Supabase SQL Editor:

   ```sql
   create table public.bill_history (
     id uuid default gen_random_uuid() primary key,
     user_id uuid references auth.users(id) on delete cascade not null,
     merchant_name text,
     transaction_date text,
     grand_total numeric default 0,
     participant_count int default 0,
     receipt jsonb,
     participants jsonb,
     assignments jsonb,
     created_at timestamptz default now()
   );

   alter table public.bill_history enable row level security;

   create policy "Users manage own history"
     on public.bill_history for all
     using (auth.uid() = user_id)
     with check (auth.uid() = user_id);
   ```

4. Enable Google OAuth in Supabase → Authentication → Providers → Google

## Build

```bash
npm run build
```

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend updating the configuration to enable type-aware lint rules:

```js
export default defineConfig([
  globalIgnores(["dist"]),
  {
    files: ["**/*.{ts,tsx}"],
    extends: [
      // Other configs...

      // Remove tseslint.configs.recommended and replace with this
      tseslint.configs.recommendedTypeChecked,
      // Alternatively, use this for stricter rules
      tseslint.configs.strictTypeChecked,
      // Optionally, add this for stylistic rules
      tseslint.configs.stylisticTypeChecked,

      // Other configs...
    ],
    languageOptions: {
      parserOptions: {
        project: ["./tsconfig.node.json", "./tsconfig.app.json"],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
]);
```

You can also install [eslint-plugin-react-x](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-x) and [eslint-plugin-react-dom](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-dom) for React-specific lint rules:

```js
// eslint.config.js
import reactX from "eslint-plugin-react-x";
import reactDom from "eslint-plugin-react-dom";

export default defineConfig([
  globalIgnores(["dist"]),
  {
    files: ["**/*.{ts,tsx}"],
    extends: [
      // Other configs...
      // Enable lint rules for React
      reactX.configs["recommended-typescript"],
      // Enable lint rules for React DOM
      reactDom.configs.recommended,
    ],
    languageOptions: {
      parserOptions: {
        project: ["./tsconfig.node.json", "./tsconfig.app.json"],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
]);
```
