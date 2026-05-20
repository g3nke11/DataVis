import { fetchConfig } from './api.js';

function setGithubStatus(cfg) {
  const el = document.getElementById('github-status');
  if (!el) return;

  const ready = !!(cfg.owner && cfg.repo);
  el.classList.remove('ok', 'warn', 'err');

  if (ready) {
    el.classList.add('ok');
    el.textContent = `GitHub repo: ${cfg.owner}/${cfg.repo} · path: ${cfg.dataPath}`;
    if (!cfg.tokenConfigured) {
      el.textContent +=
        ' · unauthenticated requests (fine for small public repos; add GITHUB_TOKEN for higher limits)';
    }
  } else {
    el.classList.add('warn');
    el.textContent = 'GitHub repo not configured — copy .env.example to .env and set owner/repo.';
  }
}

fetchConfig().then(setGithubStatus).catch(() => {
  const el = document.getElementById('github-status');
  if (el) {
    el.classList.add('err');
    el.textContent = 'Could not reach the server API.';
  }
});
