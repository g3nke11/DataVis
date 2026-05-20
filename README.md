# DataVis

Web scaffold for browsing datasets stored in a **GitHub repository folder**. Includes a **home** page, **user** preferences (browser `localStorage`), and a **datasets** explorer that loads files through a small Node backend (no GitHub secrets in the browser).

**Live site (GitHub Pages):** [https://g3nke11.github.io/DataVis/](https://g3nke11.github.io/DataVis/)

Use that URL (not the GitHub repo page) when linking to the app. The repo page at [github.com/g3nke11/DataVis](https://github.com/g3nke11/DataVis) only shows this README.

## Prerequisites

- [Node.js](https://nodejs.org/) 18+

## Configure GitHub access

1. Copy `.env.example` to `.env`.
2. Set `GITHUB_OWNER` and `GITHUB_REPO` to the repository that hosts your CSV/JSON (or other text) datasets.
3. Set `GITHUB_DATA_PATH` to the folder **inside that repo** (default `datasets`). Commit files under that folder in GitHub.
4. Optionally set `GITHUB_TOKEN` (fine‑grained or classic PAT with **Contents: Read** on that repo) to raise API rate limits and support private repos.

## Run locally

```bash
npm install
npm start
```

Open [http://localhost:3000](http://localhost:3000) — Pages: `/`, `/user.html`, `/datasets.html`.

Dataset API calls require the Node server; GitHub Pages serves the static UI only.

## Project layout

| Path | Role |
|------|------|
| `server.js` | Express app; `/api/config`, `/api/datasets`, `/api/datasets/raw` |
| `index.html` | Home (GitHub Pages entry) |
| `user.html` | User / preferences UI |
| `datasets.html` | Listing + previews |
| `css/styles.css` | Shared styles |
| `js/*.js` | API helper + page scripts |
| `.nojekyll` | Disables Jekyll so GitHub Pages serves static files as-is |
