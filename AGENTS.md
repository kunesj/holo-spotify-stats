# Holo Spotify Stats — Agent Guide

## Project Overview

Two-part system: (1) Python cron job scrapes monthly listener/follower counts for Hololive talents from Spotify's internal GraphQL API, stores data as per-artist JSON files committed to git; (2) Static Vite website built with OWL UI framework + Chart.js that renders rankings and timelines.

**Live:** https://holo-spotify-stats.jirikunes.eu/

---

## Tech Stack

| Layer | Technology | Version |
|---|---|---|
| Python runtime | CPython | >=3.11, <4.0 |
| Python package mgr | uv | 0.9.13 |
| Python linter | ruff | 0.12.2 |
| UI framework | @odoo/owl | 2.2.6 |
| CSS framework | bootstrap + bootswatch (Flatly) | 5.0.2 |
| Charts | chart.js + chartjs-adapter-moment | 4.4.1 |
| Build | vite + sass + postcss | 4.3.9 |
| Pre-commit | prek | 0.2.3 |
| JS linter | eslint | 8.43.0 |
| Container | Docker (python:3.11-slim-bullseye) | — |

---

## Directory Structure

```
.
├── cron.py                         # Scheduler: infinite loop, triggers fetch on schedule
├── fetch_spotify_stats.py          # Core: Playwright -> Spotify GraphQL -> save JSON
├── cron_logfile.sh                 # Shell wrapper: cron.py with log rotation
├── config.default.json             # Template for config.json
├── config.json                     # Actual config (gitignored)
├── pyproject.toml                  # Python deps + exhaustive ruff config
├── uv.lock                         # Locked Python deps
├── docker-compose.yml              # Docker Compose service
├── .docker/
│   ├── Dockerfile                  # Python 3.11 + uv + Playwright
│   ├── launch.sh                   # Container entrypoint
│   └── pkglist                     # APT packages
├── spotify_stats/                  # DATA: per-artist JSON files
│   ├── hololive_jp/                # 37 artists, one .json each
│   ├── hololive_en/
│   ├── hololive_id/
│   ├── dev_is/
│   ├── holostars_jp/
│   ├── holostars_en/
│   ├── independent/
│   └── other/
        └── website/
    ├── package.json
    ├── package-lock.json
    ├── vite.config.js
    ├── plugins/
    │   ├── vite-plugin-owl-xml-loader.js   # Loads .xml?owl as OWL templates
    │   └── vite-plugin-build-stats.js      # Builds dist/stats.json from spotify_stats/
    └── src/
        ├── index.html                      # HTML entry
        ├── main.js                         # JS entry: imports bootstrap, mounts app
        ├── main.scss                       # SCSS: Bootswatch Flatly theme
        ├── boot.js                         # OWL App bootstrap + env setup
        ├── state.js                        # Global reactive state (OWL reactive)
        ├── artist.js                       # ArtistData model + data loading + helpers
        ├── assets.js                       # OWL template container
        ├── utils/
        │   └── string.js                   # sprintf utility
        └── components/
            ├── webclient/                  # Root component (tabs, view routing)
            │   ├── webclient.js
            │   └── webclient.xml
            ├── rank_view/                  # Horizontal bar chart (all artists)
            │   ├── rank_view.js
            │   └── rank_view.xml
            └── timeline_view/              # Line chart (filtered artists)
                ├── timeline_view.js
                └── timeline_view.xml
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
    └─ stats_chart.js -> Chart.js (bar=rank, line=timeline)
```

### Component Tree
```
WebClient (root)
  ├─ Nav tabs: Listeners Rank | Listeners Timeline | Followers Rank | Followers Timeline
  ├─ RankView (t-if chartType === 'rank')
  │    ├─ Branch filter buttons (toggle visibility)
  │    └─ Chart.js horizontal bar chart (all visible artists)
  └─ TimelineView (t-if chartType === 'timeline')
       ├─ Branch filter buttons (toggle visibility)
       ├─ Artist count display (with warning when >30)
       └─ Chart.js line chart (visible artists only, with decimation)
```

### Page Routing (internal state, no URL-based routing)
- `state.page` values: `listeners:rank`, `listeners:timeline`, `followers:rank`, `followers:timeline`
- Parsed into `chartDataType` (listeners/followers) and `chartChartType` (rank/timeline)

---

## Key Conventions

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
- Env object in `boot.js` carries `debug`, `state`, `bus`, `_t`, `_lt`
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
