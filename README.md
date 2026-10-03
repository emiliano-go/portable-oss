# portable-oss

Config-driven dashboard for your open source projects. Every page, group, org,
project, stat, link and theme is generated from a single `oss.config.toml`.

Built with **Astro 6 + Tailwind 4 + `@astrojs/node`**. Live stats (stars, forks,
releases, last commit, contributors, package downloads) are fetched server-side
through one cached `/api/stats` endpoint: no build-time bake, no tokens in the
browser.

## Features

- **One config**: `oss.config.toml` defines site, theme, profile, groups, orgs,
  projects, packages, stats, links and per-page section toggles.
- **Live stats** via a cached proxy: katib (last commit, languages, streak),
  GitHub REST (stars, forks, PRs, issues, releases, contributors, licenses) and
  package registries (npm, PyPI, crates.io, GitHub Releases, Docker Hub).
- **Project pages** generated from config with optional sections: *why*, stack,
  last commit, languages, releases, packages, contributors, real-world usage,
  related projects.
- **Organizations**: `[orgs.<login>]` renders a dedicated homepage section with
  live repo/follower counts; projects join by repo owner or `org = "login"`.
- **Theme system**: `portfolio`, `terminal` and `paper` themes, five accent
  palettes, dark/light/auto mode, optional in-page switcher, persisted in
  `localStorage`; high-contrast and large-font accessibility modes.
- **Graceful degradation**: failed providers return `null`; cards show config
  `fallback` values or a placeholder; errors are listed in `errors[]`.
- **Deploy-ready**: Docker image, GHCR push on push, non-root runtime.

## Use this template

Click **Use this template** on GitHub, or:

```bash
gh repo create my-dashboard --public --template emiliano-go/portable-oss
cd my-dashboard
```

Then edit `oss.config.toml` (the sample ships with real projects; replace
them), set your theme, and optionally add a `KATIB_GITHUB_TOKEN`.

## Quickstart

```bash
cp .env.example .env      # then put your GitHub token in it
npm install
npm run dev               # http://localhost:4321
```

The token is optional but strongly recommended: without it katib returns 401
and unauthenticated GitHub API calls are limited to 60/hour. A classic PAT with
no scopes is enough for public data; add `repo` if you want private activity in
the profile cards.

## Configuration

Everything lives in `oss.config.toml`. It is validated at build time with Zod;
a typo fails `npm run build` with a readable `[oss.config.toml]` error. The
build also verifies cross references: unknown groups, unknown orgs, unknown
`related` projects, self references and duplicate package ids are all errors.

Minimal example:

```toml
[site]
title = "FOSS"
tagline = "Open source by Jane Doe"
description = "Every project I build and maintain."
url = "https://foss.example.com"
github_user = "jane-doe"

[theme]
name = "portfolio"
palette = "teal"
mode = "auto"
switcher = true

[profile]
name = "Jane Doe"
bio = "I build free software."

[profile.features]
last_commit = true
last_pr = true
last_issue = true
languages = true
followers = true
latest_release = true
streak = true

[groups.tools]
label = "Tools"
order = 1

[projects.example]
url = "https://github.com/jane-doe/example"
description = "What it does."
group = "tools"
featured = true
stats = ["stars", "forks", "downloads", "last_commit", "license"]

[projects.example.stack]
languages = ["Python"]
frameworks = ["FastAPI"]
platforms = ["Docker"]

[[projects.example.packages]]
url = "https://pypi.org/project/example/"

[projects.example.page]
why = true
releases = true
contributors = true
```

### `[site]`

| Key | Type | Default | Description |
|---|---|---|---|
| `title` | string, required | | Short site name used in the nav and page titles |
| `tagline` | string | `""` | Hero subtitle and default meta title suffix |
| `description` | string | `""` | Default meta description and hero paragraph |
| `url` | URL, required | | Public site URL; also sets Astro `site` and canonical URLs |
| `github_user` | string, required | | GitHub login for the profile section and stats |
| `cache_minutes` | integer | `15` | TTL of the `/api/stats` in-memory cache |

`[[site.links]]` adds nav and footer links. Both keys are required:

```toml
[[site.links]]
label = "Portfolio"
url = "https://example.com"
```

### `[theme]`

| Key | Type | Default | Description |
|---|---|---|---|
| `name` | `portfolio`, `terminal`, `paper` | `portfolio` | Neutrals, fonts and radius |
| `palette` | `teal`, `indigo`, `amber`, `rose`, `green` | `teal` | Accent and status colors |
| `mode` | `dark`, `light`, `auto` | `auto` | Initial mode; `auto` follows the OS preference |
| `switcher` | boolean | `true` | Show the in-page theme switcher in the nav |

`[theme.colors]` overrides individual design tokens. `radius` maps to
`--radius`, keys starting with `font-` map to `--font-*`, and every other key
maps to `--color-<key>` (`accent` becomes `--color-accent`). Values are
sanitized before being emitted.

```toml
[theme.colors]
accent = "#5ba3a8"
radius = "3px"
```

### `[profile]`

Omit the whole table to hide the profile section.

| Key | Type | Default | Description |
|---|---|---|---|
| `enabled` | boolean | `true` | Render the profile section |
| `name` | string, required | | Display name |
| `bio` | string | | Short bio |
| `avatar` | URL | | Optional avatar image |

`[profile.features]` toggles each card; every key defaults to `true`:
`last_commit`, `last_pr`, `last_issue`, `languages`, `followers`,
`latest_release`, `streak`.

### `[groups.<id>]`

Homepage sections for projects that are not featured and do not belong to an
org. `<id>` is an arbitrary key used in `group = "<id>"`.

| Key | Type | Default | Description |
|---|---|---|---|
| `label` | string, required | | Section heading |
| `order` | number | `100` | Section sort order |

Projects without a `group` fall into an implicit *Other* section (order 1000).
Referencing an undeclared group fails the build.

### `[orgs.<login>]`

Each declared org renders its own homepage section with live repository and
follower counts. Projects join an org when their repo owner matches `<login>`
(case-insensitive) or when they set `org = "<login>"`. Org projects are
excluded from group sections.

| Key | Type | Default | Description |
|---|---|---|---|
| `name` | string | `<login>` | Section heading |
| `description` | string | | Short paragraph under the heading |
| `url` | URL | `https://github.com/<login>` | Link shown in the heading |
| `order` | number | declaration order | Section sort order |

```toml
[orgs.my-org]
name = "My Org"
description = "What the org does."
url = "https://github.com/my-org"
order = 1
```

### `[projects.<key>]`

`<key>` is the URL slug: `/projects/<key>`. Repo-less projects are allowed
(for example an org landing entry); they simply show no repo stats.

| Key | Type | Default | Description |
|---|---|---|---|
| `name` | string | `<key>` | Display name |
| `url` | URL, required | | Project link; the website/demo chip when it differs from the repo |
| `repo` | `owner/repo` | inferred from a GitHub URL | Repository used for all live stats |
| `org` | string | inferred from repo owner | Attach to a declared org |
| `description` | string | | Card and page summary |
| `why` | string | | Renders the *why does this exist?* blockquote when `page.why` is on |
| `status` | enum, see below | | Status badge |
| `group` | string | `other` | Homepage group; must be declared |
| `featured` | boolean | `false` | Feature in the top *Featured* section (not repeated in group or org grids) |
| `archived` | boolean | `false` | Show the archived badge |
| `stats` | array of stat keys | `[]` | Stats shown on cards and the page strip |
| `related` | array of project keys | `[]` | Related projects grid; must reference real projects |

Stat keys: `stars`, `forks`, `issues`, `downloads`, `last_commit`,
`license`, `release`, `languages`. `downloads` sums package downloads plus
GitHub release asset downloads. `languages` shows the top language name.

Status values: `production`, `beta`, `alpha`, `experimental`, `wip`,
`archived`.

### `[projects.<key>.stack]`

Display-only tags. All three keys are optional string arrays: `languages`,
`frameworks`, `platforms`.

### `[projects.<key>.links]`

| Key | Type | Description |
|---|---|---|
| `docs` | URL | Documentation link |
| `changelog` | URL | Changelog link |

`[[projects.<key>.links.examples]]` and
`[[projects.<key>.links.benchmarks]]` are repeatable link tables with a
required `label` and `url`:

```toml
[[projects.example.links.examples]]
label = "Quickstart"
url = "https://example.com/quickstart"

[[projects.example.links.benchmarks]]
label = "Throughput"
url = "https://example.com/bench"
```

### `[[projects.<key>.used_by]]`

Real-world usage cards. Only add entries you have permission to publish.
`name` is required; `url` and `note` are optional.

```toml
[[projects.example.used_by]]
name = "Acme Corp"
url = "https://acme.example"
note = "Runs it in production."
```

### `[[projects.<key>.packages]]`

Distributed packages. Each entry needs only `url` in the common case.

| Key | Type | Default | Description |
|---|---|---|---|
| `url` | URL, required | | Package page; registry and name are inferred from it |
| `registry` | enum, see below | inferred from URL host | Override detection |
| `name` | string | inferred from URL path | Package identifier at the registry |
| `description` | string | | Shown on the package card |
| `show` | array of `version`, `downloads` | both | Which values to display |

Registry values: `pypi`, `npm`, `crates`, `github`, `dockerhub`, `ghcr`.
Downloads come from PyPI (last month via pypistats), npm (last month),
crates.io (all time), Docker Hub (pulls) and GitHub release assets. GHCR
exposes no public download or version API, so those entries are links only.
Duplicate package ids within one project fail the build.

### `[projects.<key>.fallback]`

Optional values shown when live stats are unavailable or a provider fails.
Keys are stat names; values are numbers or strings.

```toml
[projects.example.fallback]
stars = 120
downloads = "10k"
```

### `[projects.<key>.page]`

Toggles for the dedicated project page. Every key defaults to `true`; set
`false` to hide a section. Sections whose source data is empty are skipped
anyway (`usage`, `stack`, `packages`, `related`), while live sections render a
placeholder.

| Key | Type | Default | Renders |
|---|---|---|---|
| `why` | boolean | `true` | The `why` blockquote |
| `usage` | boolean | `true` | `used_by` cards |
| `stack` | boolean | `true` | Language, framework and platform tags |
| `last_commit` | boolean | `true` | Latest commit for the repo |
| `languages` | boolean | `true` | Language breakdown bar |
| `contributors` | boolean | `true` | Top contributors |
| `releases` | boolean | `true` | Recent releases |
| `packages` | boolean | `true` | Package cards with versions and downloads |
| `related` | boolean | `true` | Related projects grid |

## Live data

`GET /api/stats?profile=1&orgs=<login>&projects=<key,...>` returns a single
JSON payload with an in-memory cache (`cache_minutes`, package stats cached for
6h, pypistats requests spaced and retried). Sources:

| Data | Source |
|---|---|
| Last commit, languages, streak | katib |
| Followers, repo count, last PR/issue, last commit | GitHub REST + commit search |
| Stars, forks, issues, license, pushed at | GitHub REST |
| Contributors, per-repo languages, releases | GitHub REST |
| Latest release across your repos/orgs | GitHub GraphQL |
| Package downloads + versions | npm, PyPI, crates.io, GitHub Releases, Docker Hub |

## Deploy

The included GitHub Actions workflow builds and pushes
`ghcr.io/<owner>/<repo>:latest` on every push to `master` or `main`.
`KATIB_GITHUB_TOKEN` is a **runtime** secret: never a build arg and never baked
into the image:

```yaml
services:
  portable-oss:
    image: ghcr.io/you/my-dashboard:latest
    environment:
      KATIB_GITHUB_TOKEN: ${KATIB_GITHUB_TOKEN}
      PORT: 80
    ports:
      - "8080:80"
    restart: unless-stopped
```

Or build locally:

```bash
docker build -t portable-oss .
docker run -p 8080:80 -e KATIB_GITHUB_TOKEN=ghp_... portable-oss
```

## Scripts

| Script | Purpose |
|---|---|
| `npm run dev` | Dev server at `localhost:4321` |
| `npm run build` | Validate config + generate static pages and the server entry |
| `npm run preview` | Run the built server (loads `.env` if present) |
| `npm run check` | `astro check` |
| `npm test` | `node --test` for registry inference and formatting |

## License

Add your own license before publishing your dashboard.
