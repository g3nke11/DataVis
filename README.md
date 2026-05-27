# DataVis

Web app for uploading CSV/JSON datasets to **browser `localStorage`**, selecting an active dataset, and building **comparative bar charts** from chosen columns.

**Live site (GitHub Pages):** [https://g3nke11.github.io/DataVis/](https://g3nke11.github.io/DataVis/)

## Workflow

1. **Datasets** — Upload `.csv` or `.json` (stored locally, ~4 MB max per file).
2. **User** — Pick the active dataset and save display preferences.
3. **Graph** — Bar, line, scatter, histogram, pie, or heatmap; pick columns and optionally color by a category (up to 200 rows).

## Run locally (optional API)

The UI works fully on GitHub Pages without Node. The optional `server.js` backend still supports GitHub repo dataset proxying if configured.

```bash
npm install
npm start
```

Open [http://localhost:3000](http://localhost:3000).

## Project layout

| Path | Role |
|------|------|
| `index.html` | Home |
| `datasets.html` | Upload & manage local datasets |
| `user.html` | Preferences + active dataset selection |
| `graph.html` | Column picker + comparative chart |
| `js/storage.js` | `localStorage` catalog & parsing |
| `js/datasets.js` | Upload UI |
| `js/user.js` | User prefs & dataset picker |
| `js/graph.js` | Canvas bar chart |
| `server.js` | Optional Express + GitHub API |
| `.nojekyll` | Static GitHub Pages |
