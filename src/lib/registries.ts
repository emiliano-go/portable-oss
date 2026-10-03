export const REGISTRIES = ['pypi', 'npm', 'crates', 'github', 'dockerhub', 'ghcr'] as const;

export type Registry = (typeof REGISTRIES)[number];

interface ParsedUrl {
  host: string;
  parts: string[];
}

function parseUrl(url: string): ParsedUrl | null {
  try {
    const u = new URL(url);
    return {
      host: u.hostname.replace(/^www\./, ''),
      parts: u.pathname.split('/').filter(Boolean).map(decodeURIComponent),
    };
  } catch {
    return null;
  }
}

export function inferRegistry(url: string): Registry | null {
  const parsed = parseUrl(url);
  if (!parsed) return null;
  const { host, parts } = parsed;

  if (host === 'pypi.org' && parts[0] === 'project' && parts[1]) return 'pypi';
  if (host === 'npmjs.com' && parts[0] === 'package' && parts[1]) return 'npm';
  if (host === 'crates.io' && parts[0] === 'crates' && parts[1]) return 'crates';
  if (host === 'github.com' && parts.length >= 3 && parts[2] === 'releases') return 'github';
  if (host === 'hub.docker.com' && (parts[0] === 'r' || parts[0] === '_') && parts.length >= 3) return 'dockerhub';
  if (host === 'ghcr.io' && parts.length >= 2) return 'ghcr';
  return null;
}

export function inferPackageName(url: string, registry: Registry): string | null {
  const parsed = parseUrl(url);
  if (!parsed) return null;
  const p = parsed.parts;

  switch (registry) {
    case 'pypi':
      return p[1] ?? null;
    case 'npm': {
      const i = p.indexOf('package');
      const nameParts = i >= 0 ? p.slice(i + 1) : p;
      return nameParts.length ? nameParts.join('/') : null;
    }
    case 'crates':
      return p[1] ?? null;
    case 'github':
      return p.length >= 2 ? `${p[0]}/${p[1]}` : null;
    case 'dockerhub':
      return p.length >= 3 ? `${p[1]}/${p[2]}` : null;
    case 'ghcr':
      return p.length >= 2 ? p.join('/') : null;
  }
}

export interface PackageEndpoints {
  downloads: string | null;
  version: string | null;
  headers?: Record<string, string>;
  note?: string;
}

export function packageEndpoints(registry: Registry, name: string): PackageEndpoints {
  switch (registry) {
    case 'pypi':
      return {
        downloads: `https://pypistats.org/api/packages/${name}/recent`,
        version: `https://pypi.org/pypi/${name}/json`,
      };
    case 'npm':
      return {
        downloads: `https://api.npmjs.org/downloads/point/last-month/${name}`,
        version: `https://registry.npmjs.org/${name}/latest`,
      };
    case 'crates':
      return {
        downloads: `https://crates.io/api/v1/crates/${name}`,
        version: `https://crates.io/api/v1/crates/${name}`,
        headers: { 'User-Agent': 'portable-oss' },
      };
    case 'dockerhub':
      return {
        downloads: `https://hub.docker.com/v2/repositories/${name}/`,
        version: `https://hub.docker.com/v2/repositories/${name}/tags/?page_size=1&ordering=last_updated`,
      };
    case 'github':
      return { downloads: null, version: null, note: 'computed from releases' };
    case 'ghcr':
      return { downloads: null, version: null, note: 'GHCR exposes no public download or version API' };
  }
}

export function extractDownloads(registry: Registry, data: unknown): number | null {
  if (!data || typeof data !== 'object') return null;
  const d = data as Record<string, any>;

  switch (registry) {
    case 'pypi':
      return typeof d.data?.last_month === 'number' ? d.data.last_month : null;
    case 'npm':
      return typeof d.downloads === 'number' ? d.downloads : null;
    case 'crates':
      return typeof d.crate?.downloads === 'number' ? d.crate.downloads : null;
    case 'dockerhub':
      return typeof d.pull_count === 'number' ? d.pull_count : null;
    case 'github': {
      if (!Array.isArray(data)) return null;
      let total = 0;
      for (const release of data) {
        if (!Array.isArray(release?.assets)) continue;
        for (const asset of release.assets) total += Number(asset?.download_count) || 0;
      }
      return total;
    }
    default:
      return null;
  }
}

export function extractVersion(registry: Registry, data: unknown): string | null {
  if (!data) return null;

  if (registry === 'github') {
    if (!Array.isArray(data)) return null;
    const tag = data[0]?.tag_name;
    return typeof tag === 'string' ? tag : null;
  }

  if (typeof data !== 'object') return null;
  const d = data as Record<string, any>;

  switch (registry) {
    case 'pypi':
      return typeof d.info?.version === 'string' ? d.info.version : null;
    case 'npm':
      return typeof d.version === 'string' ? d.version : null;
    case 'crates':
      return typeof d.crate?.max_version === 'string' ? d.crate.max_version : null;
    case 'dockerhub':
      return typeof d.results?.[0]?.name === 'string' ? d.results[0].name : null;
    default:
      return null;
  }
}
