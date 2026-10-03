// Client hydration for [data-live] scalars and [data-live-block] regions.
// One fetch to /api/stats covers the whole page, mirroring portfolio's proxy method.

import { ago, compactNumber as compact, fullNumber as full } from '../lib/format';

type Json = any;

const LANG_COLORS: Record<string, string> = {
  Python: '#3572A5',
  TypeScript: '#3178c6',
  JavaScript: '#f1e05a',
  Go: '#00ADD8',
  Rust: '#dea584',
  Java: '#b07219',
  Ruby: '#701516',
  PHP: '#4F5D95',
  'C++': '#f34b7d',
  C: '#555555',
  'C#': '#178600',
  Shell: '#89e051',
  HTML: '#e34c26',
  CSS: '#563d7c',
  Vue: '#41b883',
  Svelte: '#ff3e00',
  Dockerfile: '#384d54',
  Makefile: '#427819',
  Nix: '#7e7eff',
  Zig: '#ec915c',
  Lua: '#000080',
  Kotlin: '#A97BFF',
  Swift: '#F05138',
  Dart: '#00B4AB',
  Elixir: '#6e4a7e',
  Haskell: '#5e5086',
  Scala: '#c22d40',
  R: '#198CE7',
  Julia: '#a270ba',
};

function langColor(name: string | undefined, provided?: string | null): string {
  if (provided) return provided;
  return (name && LANG_COLORS[name]) || 'var(--color-accent)';
}

function get(data: Json, path: string): Json {
  return path.split('.').reduce((acc, part) => (acc == null ? undefined : acc[part]), data);
}

function format(path: string, value: Json): string {
  if (value == null || value === '') return '—';
  if (/(stars|forks|issues|downloads|followers|publicRepos|contributions|current|longest)$/.test(path)) {
    return typeof value === 'number' ? compact.format(value) : String(value);
  }
  if (/(date|publishedAt|pushedAt|committedAt)$/.test(path)) return ago(String(value)) || '—';
  return String(value);
}

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

function link(className: string, href: string, text: string): HTMLAnchorElement {
  const a = el('a', className, text);
  a.href = href;
  a.target = '_blank';
  a.rel = 'noopener noreferrer';
  return a;
}

function languageBar(languages: Array<{ name?: string; size?: number; color?: string | null }>, compactMode = false): HTMLElement {
  const valid = languages.filter((l) => (l.size ?? 0) > 0);
  const total = valid.reduce((sum, l) => sum + (l.size ?? 0), 0);
  const wrap = el('div', 'relative w-full');

  if (!total) {
    wrap.append(el('p', 'font-[family-name:var(--font-mono)] text-[10px] text-(--color-text-dim)', 'No language data'));
    return wrap;
  }

  const bar = el('div', 'flex h-2 overflow-hidden bg-(--color-border-subtle)');
  bar.style.borderRadius = 'var(--radius)';
  const legend = el('div', 'mt-2 flex flex-wrap gap-x-3 gap-y-1');

  valid.forEach((lang, i) => {
    const pct = ((lang.size ?? 0) / total) * 100;
    if (compactMode && pct < 2 && i > 3) return;

    const color = langColor(lang.name, lang.color);
    const seg = el('div', 'h-full');
    seg.style.width = `${pct}%`;
    seg.style.background = color;
    seg.title = `${lang.name ?? 'Other'} ${pct.toFixed(1)}%`;
    bar.append(seg);

    if (!compactMode) {
      const item = el('span', 'inline-flex items-center gap-1 font-[family-name:var(--font-mono)] text-[10px] text-(--color-text-muted)');
      const dot = el('span', 'inline-block h-1.5 w-1.5');
      dot.style.background = color;
      item.append(dot, document.createTextNode(`${lang.name ?? 'Other'} ${Math.round(pct)}%`));
      legend.append(item);
    }
  });

  wrap.append(bar);
  if (!compactMode) wrap.append(legend);
  return wrap;
}

function renderBlock(container: HTMLElement, path: string, data: Json): void {
  container.replaceChildren();

  if (data == null) {
    container.dataset.state = 'error';
    container.append(el('p', 'font-[family-name:var(--font-mono)] text-[10px] text-(--color-text-dim)', '—'));
    return;
  }

  container.dataset.state = 'ready';
  const kind = path.split('.').pop() ?? '';

  if (kind === 'languages') {
    container.append(languageBar(Array.isArray(data) ? data : []));
    return;
  }

  if (kind === 'contributors') {
    if (!Array.isArray(data) || data.length === 0) {
      container.append(el('p', 'font-[family-name:var(--font-mono)] text-[10px] text-(--color-text-dim)', 'No contributors yet'));
      return;
    }
    const list = el('div', 'flex flex-wrap gap-3');
    for (const c of (Array.isArray(data) ? data : []).slice(0, 12)) {
      const item = el('div', 'flex items-center gap-2');
      if (c.avatarUrl) {
        const img = el('img', 'h-6 w-6 border border-(--color-border-subtle)');
        img.src = c.avatarUrl;
        img.alt = '';
        img.loading = 'lazy';
        img.style.borderRadius = 'var(--radius)';
        item.append(img);
      }
      const meta = el('div', 'leading-tight');
      meta.append(
        link('block font-[family-name:var(--font-mono)] text-[11px] text-(--color-text-bright) hover:text-(--color-accent)', c.url, c.login),
        el('span', 'block font-[family-name:var(--font-mono)] text-[9px] text-(--color-text-dim)', `${full.format(c.contributions ?? 0)} commits`),
      );
      item.append(meta);
      list.append(item);
    }
    container.append(list);
    return;
  }

  if (kind === 'releases') {
    if (!Array.isArray(data) || data.length === 0) {
      container.append(el('p', 'font-[family-name:var(--font-mono)] text-[10px] text-(--color-text-dim)', 'No releases yet'));
      return;
    }
    const list = el('div', 'space-y-1');
    for (const r of (Array.isArray(data) ? data : []).slice(0, 4)) {
      const row = el('div', 'flex items-center justify-between gap-3 border-b border-(--color-border-subtle) py-1.5 last:border-0');
      const left = el('div', 'min-w-0');
      left.append(
        link('block truncate font-[family-name:var(--font-mono)] text-[11px] text-(--color-text-bright) hover:text-(--color-accent)', r.url, r.tag || r.name || 'release'),
        el('span', 'block text-[10px] text-(--color-text-dim)', ago(r.publishedAt)),
      );
      row.append(left);
      if (typeof r.downloads === 'number') {
        row.append(el('span', 'font-[family-name:var(--font-mono)] text-[10px] text-(--color-text-dim)', `${compact.format(r.downloads)} dl`));
      }
      list.append(row);
    }
    container.append(list);
    return;
  }

  if (kind === 'lastCommit') {
    const wrap = el('div', 'min-w-0');
    const top = el('div', 'flex items-center gap-2');
    top.append(el('span', 'inline-block h-1.5 w-1.5 shrink-0', ''));
    (top.lastElementChild as HTMLElement).style.background = 'var(--color-accent)';
    top.append(
      link('truncate font-[family-name:var(--font-mono)] text-[11px] text-(--color-text-bright) hover:text-(--color-accent)', data.url, data.repo || ''),
    );
    wrap.append(top);
    wrap.append(el('p', 'mt-1 truncate font-[family-name:var(--font-mono)] text-[11px] text-(--color-text-muted)', data.message || ''));
    wrap.append(el('p', 'mt-1 font-[family-name:var(--font-mono)] text-[9px] text-(--color-text-dim)', `${data.author ? data.author + ' · ' : ''}${ago(data.date)}`));
    container.append(wrap);
    return;
  }

  if (kind === 'lastPr' || kind === 'lastIssue') {
    const wrap = el('div', 'min-w-0');
    wrap.append(link('block truncate font-[family-name:var(--font-mono)] text-[11px] text-(--color-text-bright) hover:text-(--color-accent)', data.url, `${data.repo ? data.repo + ' ' : ''}#${data.number}`));
    wrap.append(el('p', 'mt-1 truncate text-[11px] text-(--color-text-muted)', data.title || ''));
    wrap.append(el('p', 'mt-1 font-[family-name:var(--font-mono)] text-[9px] text-(--color-text-dim)', ago(data.date)));
    container.append(wrap);
    return;
  }

  if (kind === 'latestRelease') {
    const wrap = el('div', 'min-w-0');
    wrap.append(link('block truncate font-[family-name:var(--font-mono)] text-[11px] text-(--color-text-bright) hover:text-(--color-accent)', data.url, data.tag || data.name || 'release'));
    wrap.append(el('p', 'mt-1 truncate text-[11px] text-(--color-text-muted)', data.repo || data.name || ''));
    wrap.append(el('p', 'mt-1 font-[family-name:var(--font-mono)] text-[9px] text-(--color-text-dim)', ago(data.publishedAt)));
    container.append(wrap);
    return;
  }

  container.append(el('p', 'text-[11px] text-(--color-text-muted)', String(data)));
}

async function hydrate(): Promise<void> {
  const scalars = Array.from(document.querySelectorAll<HTMLElement>('[data-live]'));
  const blocks = Array.from(document.querySelectorAll<HTMLElement>('[data-live-block]'));
  if (!scalars.length && !blocks.length) return;

  const paths = [...scalars.map((s) => s.dataset.live!), ...blocks.map((b) => b.dataset.liveBlock!)];
  const projects = [...new Set(paths.filter((p) => p.startsWith('project.')).map((p) => p.split('.')[1]))];
  const orgs = [...new Set(paths.filter((p) => p.startsWith('orgs.')).map((p) => p.split('.')[1]))];
  const wantProfile = paths.some((p) => p.startsWith('profile.'));

  const qs = new URLSearchParams();
  if (wantProfile) qs.set('profile', '1');
  if (orgs.length) qs.set('orgs', orgs.join(','));
  if (projects.length) qs.set('projects', projects.join(','));

  let stats: Json = null;
  try {
    const res = await fetch(`/api/stats?${qs}`, { headers: { accept: 'application/json' } });
    if (!res.ok) throw new Error(String(res.status));
    stats = await res.json();
  } catch {
    for (const s of scalars) s.dataset.state = 'error';
    for (const b of blocks) b.dataset.state = 'error';
    return;
  }

  for (const node of scalars) {
    const path = node.dataset.live!;
    const value = get(stats, path);
    node.dataset.state = value == null || value === '' ? 'error' : 'ready';
    if (value == null || value === '') {
      node.textContent = node.dataset.liveFallback ?? '—';
    } else if (path.endsWith('topLanguage')) {
      node.textContent = String(value);
    } else {
      node.textContent = format(path, value);
    }
  }

  for (const node of blocks) {
    renderBlock(node, node.dataset.liveBlock!, get(stats, node.dataset.liveBlock!));
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', hydrate, { once: true });
} else {
  hydrate();
}
