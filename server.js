import 'dotenv/config';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();
const PORT = Number(process.env.PORT) || 3000;

const GITHUB_OWNER = process.env.GITHUB_OWNER || '';
const GITHUB_REPO = process.env.GITHUB_REPO || '';
const GITHUB_DATA_PATH = (process.env.GITHUB_DATA_PATH || 'datasets').replace(/^\/+|\/+$/g, '');
const GITHUB_TOKEN = process.env.GITHUB_TOKEN || '';

function assertRepoConfig(res) {
  if (!GITHUB_OWNER || !GITHUB_REPO) {
    res.status(503).json({
      error: 'missing_config',
      message: 'Set GITHUB_OWNER and GITHUB_REPO in .env (see .env.example)',
    });
    return false;
  }
  return true;
}

async function ghFetch(apiPath, res) {
  const url = `https://api.github.com${apiPath}`;
  const headers = {
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': 'DataVis-Web/1.0',
  };
  if (GITHUB_TOKEN) {
    headers.Authorization = `Bearer ${GITHUB_TOKEN}`;
  }
  const r = await fetch(url, { headers });
  const text = await r.text();
  let body;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  if (!r.ok) {
    const msg =
      typeof body === 'object' && body?.message
        ? body.message
        : text || `HTTP ${r.status}`;
    res.status(r.status >= 400 ? r.status : 502).json({
      error: 'github_api',
      status: r.status,
      message: msg,
    });
    return null;
  }
  return body;
}

const webRoot = __dirname;

app.use('/css', express.static(path.join(webRoot, 'css')));
app.use('/js', express.static(path.join(webRoot, 'js')));

app.get(['/', '/index.html'], (_req, res) => {
  res.sendFile(path.join(webRoot, 'index.html'));
});

app.get('/user.html', (_req, res) => {
  res.sendFile(path.join(webRoot, 'user.html'));
});

app.get('/datasets.html', (_req, res) => {
  res.sendFile(path.join(webRoot, 'datasets.html'));
});

app.get('/graph.html', (_req, res) => {
  res.sendFile(path.join(webRoot, 'graph.html'));
});

/** Old layout used public/ — keep bookmarks working after deploy */
app.get(/^\/public\/?(.*)$/, (req, res) => {
  const rest = req.params[0] || '';
  res.redirect(301, `/${rest}`);
});

app.get('/api/config', (_req, res) => {
  res.json({
    owner: GITHUB_OWNER || null,
    repo: GITHUB_REPO || null,
    dataPath: GITHUB_DATA_PATH,
    tokenConfigured: Boolean(GITHUB_TOKEN),
  });
});

app.get('/api/datasets', async (_req, res) => {
  if (!assertRepoConfig(res)) return;
  const enc = encodeURIComponent(GITHUB_DATA_PATH).replace(/%2F/g, '/');
  const apiPath = `/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${enc}`;
  const body = await ghFetch(apiPath, res);
  if (!body) return;
  if (!Array.isArray(body)) {
    res.status(409).json({
      error: 'not_a_directory',
      message:
        'GITHUB_DATA_PATH must point to a directory in the repository, not a single file.',
    });
    return;
  }
  const items = body
    .filter((entry) => entry.type === 'file')
    .map((entry) => ({
      name: entry.name,
      path: entry.path,
      size: entry.size,
      sha: entry.sha,
      downloadUrl: entry.download_url || null,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
  res.json({ path: GITHUB_DATA_PATH, items });
});

app.get('/api/datasets/raw', async (req, res) => {
  if (!assertRepoConfig(res)) return;
  const relPath = typeof req.query.path === 'string' ? req.query.path.trim() : '';
  if (!relPath || relPath.includes('..')) {
    res.status(400).json({
      error: 'bad_path',
      message: 'Query "path" must be set to a repo-relative file path.',
    });
    return;
  }
  const base = `${GITHUB_DATA_PATH.replace(/\/$/, '')}/`;
  if (!(relPath === GITHUB_DATA_PATH || relPath.startsWith(base))) {
    res.status(403).json({
      error: 'path_not_allowed',
      message: `File must be inside "${GITHUB_DATA_PATH}".`,
    });
    return;
  }
  const enc = relPath
    .split('/')
    .map((segment) => encodeURIComponent(segment))
    .join('/');
  const apiPath = `/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${enc}`;
  const body = await ghFetch(apiPath, res);
  if (!body) return;
  if (!body.content || body.type !== 'file') {
    res.status(400).json({ error: 'not_a_file', message: 'Path is not a single file.' });
    return;
  }
  let raw;
  try {
    raw = Buffer.from(body.content, 'base64').toString('utf8');
  } catch {
    res.status(500).json({
      error: 'decode_failed',
      message: 'GitHub payload could not be decoded as UTF-8 text.',
    });
    return;
  }
  const encoding = body.encoding === 'none' ? 'utf-8' : 'utf-8';
  const name = relPath.split('/').pop();
  const lower = name.toLowerCase();
  let mime = 'text/plain';
  if (lower.endsWith('.json')) mime = 'application/json';
  else if (lower.endsWith('.csv')) mime = 'text/csv';

  res.json({
    path: body.path,
    name,
    sha: body.sha,
    encoding,
    mime,
    text: raw,
  });
});

app.listen(PORT, () => {
  console.log(`DataVis server http://localhost:${PORT}`);
});
