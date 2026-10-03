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

`oss.config.toml` is validated at build time with Zod; a typo fails
`npm run build` with a readable `[oss.config.toml]` error.

```toml
[site]
title = "FOSS"
url = "https://foss.example.com"   # also used for canonical URLs
github_user = "your-login"
cache_minutes = 15

[theme]
name = "portfolio"                 # portfolio | terminal | paper
palette = "teal"                   # teal | indigo | amber | rose | green
mode = "auto"                      # dark | light | auto
switcher = true

[profile.features]                 # every profile card is a toggle
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

[orgs.my-org]
name = "My Org"
description = "What the org does."

[projects.example]
url = "https://github.com/you/example"
description = "What it does."
group = "tools"
featured = true
stats = ["stars", "forks", "downloads", "last_commit", "license"]
related = ["other-project"]

[projects.example.stack]
languages = ["Python"]
frameworks = ["FastAPI"]
platforms = ["Docker"]

[[projects.example.packages]]
url = "https://pypi.org/project/example/"   # registry/name inferred from URL

[projects.example.page]            # per-project page sections
why = true
releases = true
contributors = true
```

Also available per project: `repo` (owner/name), `why`, `status`
(`production | beta | alpha | experimental | wip | archived`), `archived`,
`links.docs`, `links.changelog`, `links.examples[]`, `links.benchmarks[]`,
`used_by[]` (only with permission), and `fallback` values for offline stat
display.

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
