import { getConfig, type ResolvedConfig, type ResolvedProject } from './config';
import { extractDownloads, extractVersion, packageEndpoints } from './registries';

const KATIB_BASE = 'https://katib.jsn.cam';
const GITHUB_API = 'https://api.github.com';
const GITHUB_GRAPHQL = 'https://api.github.com/graphql';

export interface CommitInfo {
  repo: string;
  message: string;
  sha: string | null;
  url: string | null;
  date: string | null;
  author: string | null;
}

export interface IssueInfo {
  repo: string | null;
  number: number | null;
  title: string;
  url: string | null;
  date: string | null;
}

export interface ReleaseInfo {
  repo: string | null;
  name: string | null;
  tag: string | null;
  url: string | null;
  publishedAt: string | null;
  downloads: number | null;
}

export interface LanguageInfo {
  name: string;
  size: number;
  color?: string | null;
}

export interface ContributorInfo {
  login: string;
  avatarUrl: string | null;
  contributions: number;
  url: string | null;
}

export interface PackageStats {
  url: string;
  version: string | null;
  downloads: number | null;
}

export interface ProjectStats {
  stars: number | null;
  forks: number | null;
  openIssues: number | null;
  watchers: number | null;
  license: string | null;
  archived: boolean | null;
  pushedAt: string | null;
  topLanguage: string | null;
  downloads: number | null;
  lastCommit: CommitInfo | null;
  languages: LanguageInfo[];
  contributors: ContributorInfo[];
  releases: ReleaseInfo[];
  packages: Record<string, PackageStats>;
}

export interface ProfileStats {
  login: string;
  followers: number | null;
  publicRepos: number | null;
  streak: { current: number | null; highest: number | null } | null;
  lastCommit: CommitInfo | null;
  lastPr: IssueInfo | null;
  lastIssue: IssueInfo | null;
  latestRelease: ReleaseInfo | null;
  languages: LanguageInfo[];
}

export interface OrgStats {
  login: string;
  name: string | null;
  description: string | null;
  url: string | null;
  avatarUrl: string | null;
  publicRepos: number | null;
  followers: number | null;
}

export interface StatsPayload {
  fetchedAt: string;
  profile?: ProfileStats | null;
  orgs: Record<string, OrgStats>;
  projects: Record<string, ProjectStats>;
  errors: string[];
}

export interface StatsQuery {
  profile: boolean;
  orgs: string[];
  projects: string[];
}

function getToken(): string {
  const fromRuntime = typeof process !== 'undefined' ? process.env?.KATIB_GITHUB_TOKEN : undefined;
  const fromBuild = import.meta.env.KATIB_GITHUB_TOKEN as string | undefined;
  return fromRuntime || fromBuild || '';
}

function githubHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    accept: 'application/vnd.github+json',
    'user-agent': 'foss.emiliano-go.com',
  };
  const token = getToken();
  if (token) headers.authorization = `Bearer ${token}`;
  return headers;
}

function katibHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    accept: 'application/json',
    'user-agent': 'foss.emiliano-go.com',
  };
  const token = getToken();
  if (token) headers.authorization = `Bearer ${token}`;
  return headers;
}

let activeRequests = 0;
const waiting: Array<() => void> = [];
const lastHostHit = new Map<string, number>();

// pypistats allows small bursts before returning 429, so its requests are spaced.
const HOST_INTERVALS: Record<string, number> = { 'pypistats.org': 1000 };

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function gate<T>(fn: () => Promise<T>): Promise<T> {
  if (activeRequests >= 12) {
    await new Promise<void>((resolve) => waiting.push(resolve));
  }
  activeRequests++;
  try {
    return await fn();
  } finally {
    activeRequests--;
    waiting.shift()?.();
  }
}

async function fetchJson(
  url: string,
  headers: Record<string, string> = {},
  init: RequestInit = {},
): Promise<any> {
  const host = new URL(url).hostname;
  const interval = HOST_INTERVALS[host] ?? 0;
  if (interval) {
    const now = Date.now();
    const wait = Math.max(0, (lastHostHit.get(host) ?? 0) + interval - now);
    lastHostHit.set(host, now + wait);
    if (wait) await sleep(wait);
  }

  return gate(async () => {
    const res = await fetch(url, { ...init, headers });
    if (res.status === 429) {
      await sleep(4000);
      const retry = await fetch(url, { ...init, headers });
      if (!retry.ok) throw new Error(`${retry.status} ${url}`);
      return retry.json();
    }
    if (!res.ok) throw new Error(`${res.status} ${url}`);
    return res.json();
  });
}

async function settle<T>(label: string, promise: Promise<T>, errors: string[]): Promise<T | null> {
  try {
    return await promise;
  } catch (error) {
    errors.push(`${label}: ${(error as Error).message}`);
    return null;
  }
}

function num(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function katibCommit(raw: any): CommitInfo | null {
  if (!raw) return null;
  return {
    repo: String(raw.repo ?? '').replace(/^[^/]+\//, ''),
    message: String(raw.messageHeadline ?? raw.message ?? '').split('\n')[0],
    sha: raw.oid ?? raw.sha ?? null,
    url: raw.commitUrl ?? null,
    date: raw.committedDate ?? null,
    author: raw.authorLogin ?? raw.author_login ?? null,
  };
}

function githubCommit(raw: any): CommitInfo | null {
  if (!raw) return null;
  return {
    repo: '',
    message: String(raw.commit?.message ?? '').split('\n')[0],
    sha: raw.sha ?? null,
    url: raw.html_url ?? null,
    date: raw.commit?.author?.date ?? raw.commit?.committer?.date ?? null,
    author: raw.author?.login ?? raw.commit?.author?.name ?? null,
  };
}

function searchIssue(raw: any): IssueInfo | null {
  const item = raw?.items?.[0];
  if (!item) return null;
  return {
    repo: typeof item.repository_url === 'string' ? item.repository_url.replace(`${GITHUB_API}/repos/`, '') : null,
    number: item.number ?? null,
    title: String(item.title ?? ''),
    url: item.html_url ?? null,
    date: item.created_at ?? null,
  };
}

function searchCommit(raw: any): CommitInfo | null {
  const item = raw?.items?.[0];
  if (!item) return null;
  return {
    repo: String(item.repository?.full_name ?? '').replace(/^[^/]+\//, ''),
    message: String(item.commit?.message ?? '').split('\n')[0],
    sha: item.sha ?? null,
    url: item.html_url ?? null,
    date: item.commit?.committer?.date ?? item.commit?.author?.date ?? null,
    author: item.author?.login ?? item.commit?.author?.name ?? null,
  };
}

function githubRelease(raw: any, repo: string | null = null): ReleaseInfo | null {
  if (!raw) return null;
  const downloads = Array.isArray(raw.assets)
    ? raw.assets.reduce((sum: number, asset: any) => sum + (Number(asset?.download_count) || 0), 0)
    : null;
  return {
    repo,
    name: raw.name ?? null,
    tag: raw.tag_name ?? null,
    url: raw.html_url ?? null,
    publishedAt: raw.published_at ?? null,
    downloads,
  };
}

function languagesFrom(raw: unknown): LanguageInfo[] {
  if (!raw || typeof raw !== 'object') return [];
  return Object.entries(raw as Record<string, unknown>)
    .map(([name, size]) => ({ name, size: Number(size) || 0 }))
    .filter((l) => l.size > 0)
    .sort((a, b) => b.size - a.size)
    .slice(0, 12);
}

function releaseQuery(owners: string[]): string {
  const repoFields = `repositories(first: 100, orderBy: {field: PUSHED_AT, direction: DESC}) {
    nodes {
      name
      releases(first: 5, orderBy: {field: CREATED_AT, direction: DESC}) {
        nodes { tagName name publishedAt isDraft isPrerelease url }
      }
    }
  }`;
  const parts = owners.map(
    (owner, i) => `o${i}: repositoryOwner(login: ${JSON.stringify(owner)}) {
      ... on User { ${repoFields} }
      ... on Organization { ${repoFields} }
    }`,
  );
  return `query { ${parts.join('\n')} }`;
}

// Latest published (non-draft, stable-first) release across the user's own
// repositories and declared orgs. One GraphQL call per owner, not per repo.
async function loadLatestRelease(config: ResolvedConfig, errors: string[]): Promise<ReleaseInfo | null> {
  const owners = [config.site.githubUser, ...config.orgs.map((org) => org.login)];
  try {
    const data = await fetchJson(
      GITHUB_GRAPHQL,
      { ...githubHeaders(), 'content-type': 'application/json' },
      { method: 'POST', body: JSON.stringify({ query: releaseQuery(owners) }) },
    );
    const candidates: ReleaseInfo[] = [];
    owners.forEach((owner, i) => {
      const nodes = data?.data?.[`o${i}`]?.repositories?.nodes;
      if (!Array.isArray(nodes)) return;
      for (const repo of nodes) {
        const releases = (Array.isArray(repo?.releases?.nodes) ? repo.releases.nodes : [])
          .filter((release: any) => !release?.isDraft)
          .sort((a: any, b: any) => String(b.publishedAt).localeCompare(String(a.publishedAt)));
        const best = releases.find((release: any) => !release.isPrerelease) ?? releases[0];
        if (best?.publishedAt) {
          candidates.push({
            repo: `${owner}/${repo.name}`,
            name: best.name ?? null,
            tag: best.tagName ?? null,
            url: best.url ?? null,
            publishedAt: best.publishedAt,
            downloads: null,
          });
        }
      }
    });
    candidates.sort((a, b) => String(b.publishedAt).localeCompare(String(a.publishedAt)));
    return candidates[0] ?? null;
  } catch (error) {
    errors.push(`latest-release: ${(error as Error).message}`);
    return null;
  }
}

async function loadProfile(config: ResolvedConfig, payload: StatsPayload, errors: string[]): Promise<void> {
  const login = config.site.githubUser;
  const [user, commits, streak, lastPr, lastIssue, lastCommitSearch] = await Promise.all([
    settle('github:user', fetchJson(`${GITHUB_API}/users/${login}`, githubHeaders()), errors),
    settle('katib:commits', fetchJson(`${KATIB_BASE}/v2/commits/latest?username=${encodeURIComponent(login)}&limit=5`, katibHeaders()), errors),
    settle('katib:streak', fetchJson(`${KATIB_BASE}/streak?username=${encodeURIComponent(login)}`, katibHeaders()), errors),
    settle(
      'github:last-pr',
      fetchJson(
        `${GITHUB_API}/search/issues?q=${encodeURIComponent(`author:${login} type:pr`)}&sort=created&order=desc&per_page=1`,
        githubHeaders(),
      ),
      errors,
    ),
    settle(
      'github:last-issue',
      fetchJson(
        `${GITHUB_API}/search/issues?q=${encodeURIComponent(`author:${login} type:issue`)}&sort=created&order=desc&per_page=1`,
        githubHeaders(),
      ),
      errors,
    ),
    settle(
      'github:last-commit',
      fetchJson(
        `${GITHUB_API}/search/commits?q=${encodeURIComponent(`author:${login}`)}&sort=committer-date&order=desc&per_page=1`,
        githubHeaders(),
      ),
      errors,
    ),
  ]);

  const latestRelease = await loadLatestRelease(config, errors);

  payload.profile = {
    login,
    followers: num(user?.followers),
    publicRepos: num(user?.public_repos),
    streak: streak
      ? { current: num(streak.currentStreak), highest: num(streak.highestStreak) }
      : null,
    lastCommit: searchCommit(lastCommitSearch) ?? katibCommit(commits?.commits?.[0]) ?? (commits ? katibCommit(commits) : null),
    lastPr: searchIssue(lastPr),
    lastIssue: searchIssue(lastIssue),
    latestRelease,
    languages: Array.isArray(commits?.languages)
      ? (commits.languages as any[]).map((l) => ({ name: String(l.name ?? 'Other'), size: Number(l.size) || 0, color: l.color ?? null }))
      : [],
  };
}

async function loadOrgs(
  config: ResolvedConfig,
  query: StatsQuery,
  payload: StatsPayload,
  errors: string[],
): Promise<void> {
  await Promise.all(
    query.orgs.map(async (login) => {
      const declared = config.orgs.find((org) => org.login.toLowerCase() === login.toLowerCase());
      if (!declared) {
        errors.push(`unknown org: ${login}`);
        return;
      }
      const data = await settle(`github:org:${login}`, fetchJson(`${GITHUB_API}/orgs/${declared.login}`, githubHeaders()), errors);
      payload.orgs[declared.login] = {
        login: declared.login,
        name: data?.name ?? declared.name,
        description: data?.description ?? declared.description,
        url: data?.html_url ?? declared.url,
        avatarUrl: data?.avatar_url ?? null,
        publicRepos: num(data?.public_repos),
        followers: num(data?.followers),
      };
    }),
  );
}

async function loadProject(project: ResolvedProject, payload: StatsPayload, errors: string[]): Promise<void> {
  const repo = project.repo;
  const stats: ProjectStats = {
    stars: null,
    forks: null,
    openIssues: null,
    watchers: null,
    license: null,
    archived: null,
    pushedAt: null,
    topLanguage: null,
    downloads: null,
    lastCommit: null,
    languages: [],
    contributors: [],
    releases: [],
    packages: {},
  };
  payload.projects[project.key] = stats;

  if (!repo) return;

  // Only fetch what the card stats and the enabled page sections actually need
  // (releases can carry 100 entries, so they are the expensive call).
  const needsCommits = project.stats.includes('last_commit') || project.page.last_commit;
  const needsLanguages = project.stats.includes('languages') || project.page.languages;
  const needsContributors = project.page.contributors;
  const needsReleases =
    project.stats.includes('downloads') ||
    project.stats.includes('release') ||
    project.page.releases ||
    project.packages.some((pkg) => pkg.registry === 'github');

  const [repoInfo, commit, languages, contributors, releases] = await Promise.all([
    settle(`github:repo:${repo}`, fetchJson(`${GITHUB_API}/repos/${repo}`, githubHeaders()), errors),
    needsCommits
      ? settle(`github:commits:${repo}`, fetchJson(`${GITHUB_API}/repos/${repo}/commits?per_page=1`, githubHeaders()), errors)
      : Promise.resolve(null),
    needsLanguages
      ? settle(`github:languages:${repo}`, fetchJson(`${GITHUB_API}/repos/${repo}/languages`, githubHeaders()), errors)
      : Promise.resolve(null),
    needsContributors
      ? settle(
          `github:contributors:${repo}`,
          fetchJson(`${GITHUB_API}/repos/${repo}/contributors?per_page=12`, githubHeaders()),
          errors,
        )
      : Promise.resolve(null),
    needsReleases
      ? settle(`github:releases:${repo}`, fetchJson(`${GITHUB_API}/repos/${repo}/releases?per_page=100`, githubHeaders()), errors)
      : Promise.resolve(null),
  ]);

  stats.stars = num(repoInfo?.stargazers_count);
  stats.forks = num(repoInfo?.forks_count);
  stats.openIssues = num(repoInfo?.open_issues_count);
  stats.watchers = num(repoInfo?.subscribers_count ?? repoInfo?.watchers_count);
  stats.license = repoInfo?.license?.spdx_id ?? repoInfo?.license?.name ?? null;
  stats.archived = typeof repoInfo?.archived === 'boolean' ? repoInfo.archived : null;
  stats.pushedAt = repoInfo?.pushed_at ?? null;

  const commitInfo = githubCommit(Array.isArray(commit) ? commit[0] : null);
  stats.lastCommit = commitInfo ? { ...commitInfo, repo } : null;

  stats.languages = languagesFrom(languages);
  stats.topLanguage = stats.languages[0]?.name ?? null;

  if (Array.isArray(contributors)) {
    stats.contributors = contributors
      .filter((c: any) => c && c.type !== 'Bot')
      .slice(0, 12)
      .map((c: any) => ({
        login: String(c.login ?? ''),
        avatarUrl: c.avatar_url ?? null,
        contributions: Number(c.contributions) || 0,
        url: c.html_url ?? null,
      }));
  }

  let releaseDownloads = 0;
  if (Array.isArray(releases)) {
    stats.releases = releases
      .map((r: any) => githubRelease(r, repo))
      .filter((r: ReleaseInfo | null): r is ReleaseInfo => Boolean(r))
      .slice(0, 5);
    releaseDownloads = releases.reduce(
      (sum: number, r: any) =>
        sum +
        (Array.isArray(r?.assets) ? r.assets.reduce((s: number, a: any) => s + (Number(a?.download_count) || 0), 0) : 0),
      0,
    );
  }

  await Promise.all(
    project.packages.map(async (pkg) => {
      const entry: PackageStats = { url: pkg.url, version: null, downloads: null };
      stats.packages[pkg.id] = entry;

      if (pkg.registry === 'github') {
        entry.version = stats.releases[0]?.tag ?? null;
        entry.downloads = releaseDownloads;
        return;
      }
      if (pkg.registry === 'ghcr') return;

      const cached = packageCache.get(pkg.id);
      if (cached && Date.now() < cached.expires) {
        entry.version = cached.data.version;
        entry.downloads = cached.data.downloads;
        return;
      }

      const endpoints = packageEndpoints(pkg.registry, pkg.name);
      const versionUrl = pkg.show.includes('version') ? endpoints.version : null;
      const downloadsUrl = pkg.show.includes('downloads') ? endpoints.downloads : null;

      const [versionData, downloadsData] = await Promise.all([
        versionUrl
          ? settle(`pkg:${pkg.id}:version`, fetchJson(versionUrl, endpoints.headers ?? {}), errors)
          : Promise.resolve(null),
        downloadsUrl
          ? settle(`pkg:${pkg.id}:downloads`, fetchJson(downloadsUrl, endpoints.headers ?? {}), errors)
          : Promise.resolve(null),
      ]);

      entry.version = extractVersion(pkg.registry, versionData);
      entry.downloads = extractDownloads(pkg.registry, downloadsData);

      if (entry.version != null || entry.downloads != null) {
        packageCache.set(pkg.id, { data: entry, expires: Date.now() + PACKAGE_CACHE_MS });
      }
    }),
  );

  let totalDownloads = releaseDownloads;
  for (const [id, pkg] of Object.entries(stats.packages)) {
    if (!id.startsWith('github:')) totalDownloads += pkg.downloads ?? 0;
  }
  stats.downloads = totalDownloads > 0 ? totalDownloads : null;
}

const cache = new Map<string, { data: StatsPayload; expires: number }>();
const packageCache = new Map<string, { data: PackageStats; expires: number }>();
const PACKAGE_CACHE_MS = 6 * 60 * 60 * 1000;

export async function getStats(query: StatsQuery): Promise<StatsPayload> {
  const config = getConfig();
  const key = JSON.stringify({
    profile: query.profile,
    orgs: [...query.orgs].sort(),
    projects: [...query.projects].sort(),
  });
  const hit = cache.get(key);
  if (hit && Date.now() < hit.expires) return hit.data;

  const payload: StatsPayload = {
    fetchedAt: new Date().toISOString(),
    orgs: {},
    projects: {},
    errors: [],
  };

  const tasks: Array<Promise<void>> = [];
  if (query.profile && config.profile) tasks.push(loadProfile(config, payload, payload.errors));
  if (query.orgs.length) tasks.push(loadOrgs(config, query, payload, payload.errors));
  for (const projectKey of query.projects) {
    const project = config.byKey[projectKey];
    if (project) tasks.push(loadProject(project, payload, payload.errors));
  }
  await Promise.all(tasks);

  cache.set(key, { data: payload, expires: Date.now() + config.site.cacheMinutes * 60_000 });
  return payload;
}
