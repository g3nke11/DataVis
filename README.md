# DataVis

Web scaffold for browsing datasets stored in a **GitHub repository folder**. Includes a **home** page, **user** preferences (browser `localStorage`), and a **datasets** explorer that loads files through a small Node backend (no GitHub secrets in the browser).

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

Open [http://localhost:3000](http://localhost:3000) — Pages: `/` (home), `/user.html`, `/datasets.html`.

## Project layout

| Path | Role |
|------|------|
| `server.js` | Express app; `/api/config`, `/api/datasets`, `/api/datasets/raw` |
| `public/index.html` | Home |
| `public/user.html` | User / preferences UI |
| `public/datasets.html` | Listing + previews |
| `public/css/styles.css` | Shared styles |
| `public/js/*.js` | API helper + page scripts |
