# Holo Spotify Stats — Agent Guide

## Project Overview

Two-part system: (1) Python cron job scrapes monthly listener/follower counts for Hololive talents from Spotify's internal GraphQL API, stores data as per-artist JSON files committed to git; (2) Static Vite website built with OWL UI framework + Chart.js that renders rankings and timelines.

**Live:** https://holo-spotify-stats.jirikunes.eu/

---

## Tech Stack

| Layer | Technology | Version |
|---|---|---|
| Python runtime | CPython | >=3.11, <4.0 |
| Python package mgr | uv | 0.9.15 |
| Python linter | ruff | 0.12.2 |
| UI framework | @odoo/owl | 2.2.6 |
| CSS framework | bootstrap (custom theme) | 5.0.2 |
| Charts | chart.js + chartjs-adapter-moment + moment | 4.4.1 + 1.0.1 + 2.10.2 |
| Build | vite + sass + postcss | 4.3.9 |
| Pre-commit | prek | 0.2.3 |
| JS linter | eslint | 8.43.0 |
| Container | Docker (python:3.11-slim-bullseye) | — |

---

## Directory Structure

```
.
├── AGENTS.md                         # This file
├── README.md                         # User-facing project readme
├── cron.py                           # Scheduler: infinite loop, triggers fetch on schedule
├── fetch_spotify_stats.py            # Core: Playwright -> Spotify GraphQL -> save JSON
├── cron_logfile.sh                   # Shell wrapper: cron.py with log rotation
├── config.default.json               # Template for config.json
├── config.json                       # Actual config (gitignored)
├── pyproject.toml                    # Python deps + exhaustive ruff config
├── uv.lock                           # Locked Python deps
├── docker-compose.yml                # Docker Compose service
├── opencode.json                     # AI tool config (denies read access to spotify_stats/)
├── .docker/
│   ├── Dockerfile                    # Python 3.11 + uv + Playwright
│   ├── launch.sh                     # Container entrypoint
│   └── pkglist                       # APT packages
├── .pre-commit-config.yaml           # prek hooks: uv-lock, ruff, eslint
├── .editorconfig                     # Editor config (indent, line length)
├── .dockerignore                     # Docker build ignores
├── .gitignore                        # Git ignores
├── .eslintignore                     # ESLint ignores
├── .eslintrc.json                    # ESLint config
├── spotify_stats/                    # DATA: per-artist JSON files
│   ├── hololive_jp/
│   ├── hololive_en/
│   ├── hololive_id/
│   ├── dev_is/
│   ├── holostars_jp/
│   ├── holostars_en/
│   ├── independent/
│   └── other/
├── website/
│   ├── package.json
│   ├── package-lock.json
│   ├── vite.config.js
│   ├── .gitignore
│   ├── public/                       # Static assets (empty)
│   ├── plugins/
│   │   ├── vite-plugin-owl-xml-loader.js   # Loads .xml?owl as OWL templates
│   │   └── vite-plugin-build-stats.js      # Builds dist/stats.json from spotify_stats/
│   └── src/
│       ├── index.html                      # HTML entry
│       ├── main.js                         # JS entry: imports bootstrap, mounts app
│       ├── main.scss                       # SCSS: Bootstrap 5 + custom CSS theme
│       ├── boot.js                         # OWL App bootstrap + env setup
│       ├── state.js                        # Global reactive state (OWL reactive)
│       ├── artist.js                       # ArtistData model + data loading + helpers
│       ├── assets.js                       # OWL template container
│       ├── utils/
│       │   └── string.js                   # sprintf utility
│       └── components/
│           ├── webclient/                  # Root component (tabs, view routing, search)
│           │   ├── webclient.js
│           │   └── webclient.xml
│           ├── rank_view/                  # Horizontal bar chart (all artists)
│           │   ├── rank_view.js
│           │   └── rank_view.xml
│           ├── timeline_view/              # Line chart (filtered artists)
│           │   ├── timeline_view.js
│           │   └── timeline_view.xml
│           ├── compare_view/               # Compare up to 5 artists
│           │   ├── compare_view.js
│           │   └── compare_view.xml
│           └── artist_detail/              # Single artist detail
│               ├── artist_detail.js
│               └── artist_detail.xml
```

---

## Commands

### Python
| Command | Purpose |
|---|---|
| `uv sync --locked` | Install deps from lockfile |
| `uv run python cron.py` | Run scheduler daemon |
| `uv run python fetch_spotify_stats.py --force` | Force-fetch all stats |
| `ruff check --fix` | Lint & auto-fix Python |
| `ruff format` | Format Python |

### Website
| Command | Purpose |
|---|---|
| `npm install` | Install JS deps (run from `website/`) |
| `npm run build` | `vite build` -> produces `dist/` |
| `npm run preview` | `vite preview` -> serves `dist/` locally |
| `npx eslint src/ --fix` | Lint JS (run from `website/`) |

### Docker
| Command | Purpose |
|---|---|
| `docker compose up -d` | Start collector container |
| `docker compose logs -f` | Tail logs |

---

## Architecture & Data Flow

```
Spotify API (open.spotify.com)
  └─ Playwright -> intercept /api/token -> get auth token
    └─ POST api-partner.spotify.com GraphQL (persisted query hash)
      └─ Parse monthlyListeners + followers
        └─ Update spotify_stats/<branch>/<artist>.json
          └─ git commit + push (via cron.py)

Vite build:
  spotify_stats/**/*.json
    └─ vite-plugin-build-stats (buildEnd hook)
      └─ dist/stats.json (single merged array)

Browser runtime:
  fetch('/stats.json') -> artist.js -> reactive STATE.artistIndex
    └─ RankView / TimelineView -> Chart.js (horizontal bar / line)
```

### Component Tree
```
WebClient (root)
  ├─ Nav tabs: Listeners | Timeline | Followers | Timeline | Compare
  ├─ RankView (t-if chartType === 'rank')
  │    ├─ Branch filter buttons (toggle visibility)
  │    └─ Chart.js horizontal bar chart (all visible artists, click bar → ArtistDetail)
  ├─ TimelineView (t-if chartType === 'timeline')
  │    ├─ Branch filter buttons (toggle visibility)
  │    ├─ Artist count display (with warning when >30)
  │    └─ Chart.js line chart (visible artists only, with decimation)
  ├─ CompareView (t-if chartType === 'compare')
  │    ├─ Typeahead search (select up to 5 artists)
  │    └─ Chart.js line chart (selected artists only)
  └─ ArtistDetailView (t-if chartType === 'artist-detail')
       ├─ Back button, artist header, stat cards
       └─ Chart.js single-artist line chart (filled)
```

### Page Routing (hash-based)
- URL hash drives navigation: `#rank/listeners`, `#timeline/followers`, `#compare`, `#artist/<id>`
- `state.page` values: `listeners:rank`, `listeners:timeline`, `followers:rank`, `followers:timeline`, `none:compare`, `none:artist-detail`
- Parsed into `chartDataType` (listeners/followers) and `chartChartType` (rank/timeline/compare/artist-detail)
- `window.location.hash` set on nav click; `hashchange` listener syncs state

---

## Key Conventions

### General
- **Never remove or modify existing human-written comments and docstrings.** The codebase relies on them for understanding intent.
- **Every class, method, function, and module must have a JSDoc or docstring** describing its purpose, parameters, and return value.

### Python
- **Python 3.11+** with full type annotations (`typing.Literal`, `X | None`)
- **snake_case** for functions/vars, **UPPER_CASE** for constants, **CamelCase** for classes
- Double quotes, 120-char line length, 4-space indent
- Imports: stdlib first, then third-party (sorted by isort/ruff)
- Logging: `_logger = logging.getLogger(__name__)` pattern
- `pyproject.toml` has ~300 lines of ruff rules — run `ruff check` before committing
- Custom `NoIndentEncoder` keeps artist JSON compact for arrays, pretty for outer structure

### JavaScript
- **ES2022 modules** (`type: "module"`)
- **camelCase** for functions/vars, **PascalCase** for classes
- 4-space indent, Unix LF, single quotes, semicolons required
- Stroustrup brace style (`brace-style: "stroustrup"`)
- `let`/`const` only, one declaration per line
- Project imports via `~` alias (resolves to `src/`)
- No tests configured

### OWL Patterns
- Two files per component: `name.js` (class extending `owl.Component`) + `name.xml` (template)
- Templates loaded via `import './name.xml?owl'` → custom Vite plugin registers in `window.__OWL_TEMPLATES__`
- Env object in `boot.js` carries `debug`, `state`, `bus`, `services`, `_t`, `_lt`
- `onError` handler in WebClient prevents OWL from destroying the whole app on unhandled errors

### Data Files
- Artist JSON files named `<generation>__<name>.json` (e.g., `0__tokino_sora.json`)
- Schema: `{ id, name, color, generations: [[branch, gen]], stats: { "YYYY-MM-DD": { monthlyListeners, followers } } }`
- All artist files aggregated into single `stats.json` at build time (static site constraint)

---

## Development Workflow

1. **Edit Python collector**: Modify `fetch_spotify_stats.py` or `cron.py`, run `ruff check --fix && ruff format`
2. **Edit website**: Modify files under `website/src/`, run `eslint . --fix` from `website/`
3. **Build website**: `npm run build` from `website/` — produces `website/dist/`
4. **Preview build**: `npm run preview` from `website/`
5. **Test Docker**: `docker compose up -d` then check `docker compose logs -f`
6. **Pre-commit hooks** (run by `prek`): `uv-lock` → `ruff check --fix` → `ruff format` → `eslint --fix`

---

## Important Gotchas

1. **No tests exist** — any test framework would need to be added from scratch
2. **API scraping approach**: Uses Playwright to open `open.spotify.com`, intercept `/api/token` response for auth, then calls Spotify's internal GraphQL. Fragile if Spotify changes their internal API.
3. **zstd decompression**: Spotify may return `zstd`-compressed responses; `decode_response()` handles this
4. **No `__init__.py`** files — ruff rule `INP` (no PEP 420 implicit namespaces) is enabled, meaning packages need `__init__.py`
5. **Artist JSON uses `NoIndent`** sentinel class for compact serialization of nested arrays (generations, per-date stats). `json.dumps` is overridden to handle this.
6. **Config file**: `config.json` is gitignored; `config.default.json` is the reference template
7. **Git-as-database**: Each fetch produces commit `DATA:YYYY-MM-DD`. SSH keys are mounted into the container for push access.
8. **Vite dev server won't work** for the stats plugin since it reads `spotify_stats/` from the repo root (outside `website/`). The build plugin uses relative path `../../spotify_stats/`. For dev, build and use `preview`.
9. **OWL v2 error handling**: Without the `onError` boundary in WebClient, any component error destroys the entire app
10. **`opencode.json`** explicitly denies reading `spotify_stats/` directory — be aware when using AI tools
11. **Rank/Timeline flex grid**: Both views use `row > col-auto + col`. The `.col` (`flex: 1 0 0%`) has `flex-shrink: 0` + default `min-width: auto`, which prevents shrinking below content min-width (e.g., canvas default 300px). This causes `flex-wrap: wrap` to stack sidebar and chart vertically. Fix: `.tab-pane .row > .col { min-width: 0 }` in `main.scss`.
