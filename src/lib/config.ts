import { parse } from 'smol-toml';
import { z } from 'astro/zod';
import configRaw from '../../oss.config.toml?raw';
import { inferPackageName, inferRegistry, type Registry } from './registries';

export const STAT_KEYS = [
  'stars',
  'forks',
  'issues',
  'downloads',
  'last_commit',
  'license',
  'release',
  'languages',
] as const;
export type StatKey = (typeof STAT_KEYS)[number];

export const STATUSES = ['production', 'beta', 'alpha', 'experimental', 'wip', 'archived'] as const;
export type Status = (typeof STATUSES)[number];

export const PAGE_SECTIONS = [
  'why',
  'usage',
  'stack',
  'last_commit',
  'languages',
  'contributors',
  'releases',
  'packages',
  'related',
] as const;
export type PageSection = (typeof PAGE_SECTIONS)[number];

export const PROFILE_FEATURES = [
  'last_commit',
  'last_pr',
  'last_issue',
  'languages',
  'followers',
  'latest_release',
  'streak',
] as const;
export type ProfileFeature = (typeof PROFILE_FEATURES)[number];

const linkItemSchema = z.object({ label: z.string().min(1), url: z.url() });

const packageSchema = z.object({
  url: z.url(),
  registry: z.enum(['pypi', 'npm', 'crates', 'github', 'dockerhub', 'ghcr']).optional(),
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  show: z.array(z.enum(['version', 'downloads'])).optional(),
});

const projectSchema = z.object({
  name: z.string().min(1).optional(),
  url: z.url(),
  repo: z
    .string()
    .regex(/^[\w.-]+\/[\w.-]+$/, 'must be "owner/repo"')
    .optional(),
  org: z.string().optional(),
  description: z.string().optional(),
  why: z.string().optional(),
  status: z.enum(STATUSES).optional(),
  group: z.string().optional(),
  featured: z.boolean().optional(),
  archived: z.boolean().optional(),
  stats: z.array(z.enum(STAT_KEYS)).optional(),
  related: z.array(z.string()).optional(),
  stack: z
    .object({
      languages: z.array(z.string()).optional(),
      frameworks: z.array(z.string()).optional(),
      platforms: z.array(z.string()).optional(),
    })
    .optional(),
  links: z
    .object({
      docs: z.url().optional(),
      changelog: z.url().optional(),
      examples: z.array(linkItemSchema).optional(),
      benchmarks: z.array(linkItemSchema).optional(),
    })
    .optional(),
  used_by: z
    .array(
      z.object({
        name: z.string().min(1),
        url: z.url().optional(),
        note: z.string().optional(),
      }),
    )
    .optional(),
  packages: z.array(packageSchema).optional(),
  fallback: z.record(z.string(), z.union([z.number(), z.string()])).optional(),
  page: z
    .object({
      why: z.boolean().optional(),
      usage: z.boolean().optional(),
      stack: z.boolean().optional(),
      last_commit: z.boolean().optional(),
      languages: z.boolean().optional(),
      contributors: z.boolean().optional(),
      releases: z.boolean().optional(),
      packages: z.boolean().optional(),
      related: z.boolean().optional(),
    })
    .optional(),
});

const rootSchema = z.object({
  site: z.object({
    title: z.string().min(1),
    tagline: z.string().optional(),
    description: z.string().optional(),
    url: z.url(),
    github_user: z.string().min(1),
    cache_minutes: z.number().int().positive().optional(),
    links: z.array(linkItemSchema).optional(),
  }),
  theme: z
    .object({
      name: z.enum(['portfolio', 'terminal', 'paper']).optional(),
      palette: z.enum(['teal', 'indigo', 'amber', 'rose', 'green']).optional(),
      mode: z.enum(['dark', 'light', 'auto']).optional(),
      switcher: z.boolean().optional(),
      colors: z.record(z.string(), z.string()).optional(),
    })
    .optional(),
  profile: z
    .object({
      enabled: z.boolean().optional(),
      name: z.string().min(1),
      bio: z.string().optional(),
      avatar: z.url().optional(),
      features: z
        .object({
          last_commit: z.boolean().optional(),
          last_pr: z.boolean().optional(),
          last_issue: z.boolean().optional(),
          languages: z.boolean().optional(),
          followers: z.boolean().optional(),
          latest_release: z.boolean().optional(),
          streak: z.boolean().optional(),
        })
        .optional(),
    })
    .optional(),
  groups: z
    .record(z.string(), z.object({ label: z.string().min(1), order: z.number().optional() }))
    .optional(),
  orgs: z
    .record(
      z.string(),
      z.object({
        name: z.string().min(1).optional(),
        description: z.string().optional(),
        url: z.url().optional(),
        order: z.number().optional(),
      }),
    )
    .optional(),
  projects: z.record(z.string(), projectSchema),
});

export interface LinkItem {
  label: string;
  url: string;
}

export interface UsageItem {
  name: string;
  url: string | null;
  note: string | null;
}

export interface ResolvedPackage {
  id: string;
  registry: Registry;
  name: string;
  url: string;
  description: string | null;
  show: Array<'version' | 'downloads'>;
  label: string;
}

export interface ResolvedProject {
  key: string;
  name: string;
  url: string;
  repo: string | null;
  org: string | null;
  description: string | null;
  why: string | null;
  status: Status | null;
  group: string;
  featured: boolean;
  archived: boolean;
  stats: StatKey[];
  related: string[];
  stack: { languages: string[]; frameworks: string[]; platforms: string[] };
  links: { docs: string | null; changelog: string | null; examples: LinkItem[]; benchmarks: LinkItem[] };
  usedBy: UsageItem[];
  packages: ResolvedPackage[];
  fallback: Record<string, number | string>;
  page: Record<PageSection, boolean>;
}

export interface ResolvedGroup {
  id: string;
  label: string;
  order: number;
  projects: ResolvedProject[];
}

export interface ResolvedOrg {
  login: string;
  name: string;
  description: string | null;
  url: string;
  order: number;
  projects: ResolvedProject[];
}

export interface ResolvedConfig {
  site: {
    title: string;
    tagline: string;
    description: string;
    url: string;
    githubUser: string;
    cacheMinutes: number;
    links: LinkItem[];
  };
  theme: {
    name: 'portfolio' | 'terminal' | 'paper';
    palette: 'teal' | 'indigo' | 'amber' | 'rose' | 'green';
    mode: 'dark' | 'light' | 'auto';
    switcher: boolean;
    colors: Record<string, string>;
  };
  profile: {
    enabled: boolean;
    name: string;
    bio: string | null;
    avatar: string | null;
    features: Record<ProfileFeature, boolean>;
  } | null;
  groups: ResolvedGroup[];
  orgs: ResolvedOrg[];
  projects: ResolvedProject[];
  byKey: Record<string, ResolvedProject>;
  featured: ResolvedProject[];
}

function fail(message: string): never {
  throw new Error(`[oss.config.toml] ${message}`);
}

function inferRepoFromUrl(url: string): string | null {
  try {
    const u = new URL(url);
    if (u.hostname.replace(/^www\./, '') !== 'github.com') return null;
    const parts = u.pathname.split('/').filter(Boolean);
    if (parts.length < 2) return null;
    if (['orgs', 'users', 'topics', 'collections', 'sponsors', 'settings'].includes(parts[0])) return null;
    return `${parts[0]}/${parts[1]}`;
  } catch {
    return null;
  }
}

function resolveProject(
  key: string,
  raw: z.infer<typeof projectSchema>,
  groupIds: Set<string>,
  orgIds: Map<string, string>,
): ResolvedProject {
  const group = raw.group ?? 'other';
  if (group !== 'other' && !groupIds.has(group)) {
    fail(`projects.${key}.group: "${group}" is not a declared group (${[...groupIds].join(', ')})`);
  }

  const repo = raw.repo ?? inferRepoFromUrl(raw.url);
  const declaredOrg = raw.org ? orgIds.get(raw.org.toLowerCase()) : undefined;
  if (raw.org && !declaredOrg) {
    fail(`projects.${key}.org: "${raw.org}" is not a declared organization`);
  }
  const owner = repo?.split('/')[0];
  const org = declaredOrg ?? (owner ? orgIds.get(owner.toLowerCase()) : undefined) ?? null;

  const packages: ResolvedPackage[] = [];
  const seenPackages = new Set<string>();
  for (const pkg of raw.packages ?? []) {
    const registry = pkg.registry ?? inferRegistry(pkg.url);
    if (!registry) {
      fail(`projects.${key}.packages: cannot infer registry from "${pkg.url}" — set registry = "pypi|npm|crates|github|dockerhub|ghcr"`);
    }
    const name = pkg.name ?? inferPackageName(pkg.url, registry);
    if (!name) {
      fail(`projects.${key}.packages: cannot infer package name from "${pkg.url}" — set name = "..."`);
    }
    const id = `${registry}:${name}`;
    if (seenPackages.has(id)) fail(`projects.${key}.packages: duplicate package "${id}"`);
    seenPackages.add(id);
    packages.push({
      id,
      registry,
      name,
      url: pkg.url,
      description: pkg.description ?? null,
      show: pkg.show ?? ['version', 'downloads'],
      label: name,
    });
  }

  const pageDefaults = Object.fromEntries(PAGE_SECTIONS.map((s) => [s, true])) as Record<PageSection, boolean>;

  return {
    key,
    name: raw.name ?? key,
    url: raw.url,
    repo,
    org,
    description: raw.description ?? null,
    why: raw.why ?? null,
    status: raw.status ?? null,
    group,
    featured: raw.featured ?? false,
    archived: raw.archived ?? false,
    stats: raw.stats ?? [],
    related: raw.related ?? [],
    stack: {
      languages: raw.stack?.languages ?? [],
      frameworks: raw.stack?.frameworks ?? [],
      platforms: raw.stack?.platforms ?? [],
    },
    links: {
      docs: raw.links?.docs ?? null,
      changelog: raw.links?.changelog ?? null,
      examples: raw.links?.examples ?? [],
      benchmarks: raw.links?.benchmarks ?? [],
    },
    usedBy: (raw.used_by ?? []).map((u) => ({ name: u.name, url: u.url ?? null, note: u.note ?? null })),
    packages,
    fallback: raw.fallback ?? {},
    page: { ...pageDefaults, ...(raw.page ?? {}) },
  };
}

function resolve(raw: unknown): ResolvedConfig {
  const parsed = rootSchema.safeParse(raw);
  if (!parsed.success) {
    const lines = parsed.error.issues.map((i) => `  - ${i.path.join('.') || '(root)'}: ${i.message}`);
    fail(`invalid configuration:\n${lines.join('\n')}`);
  }
  const data = parsed.data;

  const projectKeys = Object.keys(data.projects);
  if (projectKeys.length === 0) fail('no [projects.<name>] tables defined');

  const groupIds = new Set(Object.keys(data.groups ?? {}));
  const orgIds = new Map(Object.keys(data.orgs ?? {}).map((login) => [login.toLowerCase(), login]));
  const projects = projectKeys.map((key) => resolveProject(key, data.projects[key], groupIds, orgIds));
  const byKey: Record<string, ResolvedProject> = Object.fromEntries(projects.map((p) => [p.key, p]));

  for (const project of projects) {
    for (const related of project.related) {
      if (related === project.key) fail(`projects.${project.key}.related: cannot relate a project to itself`);
      if (!byKey[related]) fail(`projects.${project.key}.related: "${related}" is not a project`);
    }
  }

  const groupDefs = [
    ...Object.entries(data.groups ?? {}).map(([id, g]) => ({ id, label: g.label, order: g.order ?? 100 })),
    { id: 'other', label: 'Other', order: 1000 },
  ];
  const groups: ResolvedGroup[] = groupDefs
    .map((g) => ({
      ...g,
      projects: projects
        .filter((p) => p.group === g.id)
        .sort((a, b) => Number(b.featured) - Number(a.featured) || a.name.localeCompare(b.name)),
    }))
    .filter((g) => g.projects.length > 0)
    .sort((a, b) => a.order - b.order);

  const profile = data.profile
    ? {
        enabled: data.profile.enabled ?? true,
        name: data.profile.name,
        bio: data.profile.bio ?? null,
        avatar: data.profile.avatar ?? null,
        features: Object.fromEntries(
          PROFILE_FEATURES.map((f) => [f, data.profile?.features?.[f] ?? true]),
        ) as Record<ProfileFeature, boolean>,
      }
    : null;

  const sortedProjects = [...projects].sort((a, b) => a.name.localeCompare(b.name));

  const orgs: ResolvedOrg[] = Object.entries(data.orgs ?? {})
    .map(([login, org], index) => ({
      login,
      name: org.name ?? login,
      description: org.description ?? null,
      url: org.url ?? `https://github.com/${login}`,
      order: org.order ?? index + 1,
      projects: projects
        .filter((project) => project.org === login)
        .sort((a, b) => Number(b.featured) - Number(a.featured) || a.name.localeCompare(b.name)),
    }))
    .sort((a, b) => a.order - b.order);

  return {
    site: {
      title: data.site.title,
      tagline: data.site.tagline ?? '',
      description: data.site.description ?? '',
      url: data.site.url,
      githubUser: data.site.github_user,
      cacheMinutes: data.site.cache_minutes ?? 15,
      links: data.site.links ?? [],
    },
    theme: {
      name: data.theme?.name ?? 'portfolio',
      palette: data.theme?.palette ?? 'teal',
      mode: data.theme?.mode ?? 'auto',
      switcher: data.theme?.switcher ?? true,
      colors: data.theme?.colors ?? {},
    },
    profile,
    groups,
    orgs,
    projects: sortedProjects,
    byKey,
    featured: sortedProjects.filter((p) => p.featured),
  };
}

let cached: ResolvedConfig | null = null;

export function getConfig(): ResolvedConfig {
  if (!cached) {
    let data: unknown;
    try {
      data = parse(configRaw);
    } catch (error) {
      fail(`could not parse TOML: ${(error as Error).message}`);
    }
    cached = resolve(data);
  }
  return cached;
}
