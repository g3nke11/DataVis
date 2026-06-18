# DataVis

Web app for uploading CSV/JSON datasets, selecting an active dataset, and building charts from chosen columns. Datasets can be stored in **Supabase** when signed in, or in **browser `localStorage`** when not.

**Live site (GitHub Pages):** [https://g3nke11.github.io/DataVis/](https://g3nke11.github.io/DataVis/)

## Workflow

1. **User** — Create an account or sign in (optional). Pick the active dataset.
2. **Datasets** — Upload `.csv` or `.json` (~4 MB max). Signed-in users save to Supabase; otherwise files stay in the browser.
3. **Graph** — Bar, line, scatter, histogram, pie, or heatmap; pick columns, filter ranges, and optionally color by category (up to 200 rows).

## Supabase setup

1. Create a Supabase project and run your `datasets` table SQL.
2. Run **`supabase/rls-policies.sql`** in the Supabase SQL Editor so users can only access their own rows.
3. In **Authentication → Providers**, enable Email (and configure email confirmation if desired).
4. Supabase URL and anon key are in `js/config.js` (public anon key is safe with RLS enabled).

## Run locally

```bash
npm install
npm start
```

Open [http://localhost:3000](http://localhost:3000).

The optional `server.js` backend can still proxy GitHub repo datasets if configured in `.env`.

## Project layout

| Path | Role |
|------|------|
| `js/config.js` | Supabase project URL + anon key |
| `js/supabase-client.js` | Supabase client |
| `js/auth.js` | Sign in / sign up / sign out |
| `js/dataset-store.js` | Cloud + local dataset CRUD |
| `js/storage.js` | Parsing, localStorage fallback |
| `supabase/rls-policies.sql` | Row Level Security policies |
| `user.html` | Account + dataset picker |
| `datasets.html` | Upload & manage datasets |
| `graph.html` | Chart builder |
