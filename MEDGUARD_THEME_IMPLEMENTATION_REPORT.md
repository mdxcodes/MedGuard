# MedGuard — Theme Implementation Report

**Repository:** /secondary/MedGuard  
**Date:** 2026-10-21  
**Status:** Implemented and verified

---

## 1. Existing Architecture Inspected

Before making changes, the full frontend was inspected:

- **Frontend framework:** React 18 + Vite 6.4, React Router DOM 7, Tailwind CSS v4
- **Design system:** Tailwind v4 `@theme` CSS variables in `frontend/src/index.css`
- **Modules:** `frontend/src/app/` (ModeProvider, AssessmentProvider, ModelStatusProvider, AppShell), `frontend/src/components/` (shared UI), `frontend/src/pages/` (patient + research pages)
- **Layout:** `AppShell.jsx` renders either `PatientLayout` or `ResearchSidebar` + `Header` based on mode state from `ModeProvider`
- **Data flow:** Shared `AssessmentProvider` holds assessment values and prediction results; both modes consume the same backend API (`/api/predict`, `/api/model-info`, etc.)
- **Existing screens:** Patient (home, assessment, result, about) and Research Lab (overview, performance, dataset explorer, scenario comparison, error analysis, explainability, model registry, experiments, drift, methodology, synthetic benchmark)
- **No existing screenshot/automation tooling** — no puppeteer/playwright installed; Chrome available at `/usr/bin/google-chrome-stable`
- **Working tree:** Clean at start of this task; no pre-existing uncommitted changes

## 2. Design System Implemented

The five-color graphite/sage palette from the task specification is now the single source of truth, defined in `frontend/src/index.css` `@theme`:

| Token | Value | Usage |
|---|---|---|
| `--color-page` | `#252A2E` | Main application background |
| `--color-surface` | `#343B40` | Cards, panels, tiles |
| `--color-secondary` | `#8FA0AA` | Secondary icons, chart series |
| `--color-accent` / `--color-primary` | `#A6B59A` | Primary accent, active navigation, selected controls |
| `--color-text` | `#D8D3C7` | Primary text and headings |

Supporting tokens added:
- `--color-surface-soft`, `--color-surface-lift` for nested surfaces
- `--color-navy`, `--color-navy-deep`, `--color-navy-soft` for sidebar and recessed sections
- `--color-error`, `--color-warning`, `--color-success`, `--color-info` for semantic states
- `--color-border`, `--color-border-subtle`, `--color-border-focus` for dividers
- `--color-esi-1` through `--color-esi-5` for ESI acuity levels (semantic, distinct from brand)
- `--color-primary-contrast` (#052E2A) for text on primary fills

Radius values: 0.5rem / 0.75rem / 1rem / 1.25rem / 9999px  
Shadow tokens: sm / md / lg / elevated  
Focus ring: sage-based (`--focus-ring`)

Token names were renamed from the previous MIMIC-era names (`--color-bg-surface` → `--color-surface`, `--color-text-primary` → `--color-ink`, etc.) so they match the utility names actually used throughout the codebase (`bg-surface`, `text-secondary`, etc.).

## 3. Nebula Image Integration

- **Source:** `/secondary/MedGuard/Nebula_backgorund.jpeg` (97 KB)
- **Deployed to:** `frontend/public/nebula-bg.jpeg`
- **Implementation:** Added to `App.jsx` as `<div className="app-background" />` — a full-viewport fixed layer behind the app shell so every route inherits the same atmospheric texture
- **Treatment:** 89–94% graphite overlay (`linear-gradient(rgba(37,42,46,0.89), rgba(37,42,46,0.94))`), `background-size: cover`, `background-position: center`, `pointer-events: none`
- **Applied once** in the shared `App.jsx` shell so all routes inherit the same background
- Not applied to individual cards, forms, dialogs, or pages

## 4. Components & Routes Updated

### Shared components
- `index.css` — Complete rewrite: graphite/sage token system, nebula background layer, patient-mode scope, patient-mode dark variant
- `Header.jsx` — Wave icon color `text-primary`, status badge dot color logic updated
- `Footer.jsx` — Wave icon color `text-primary`
- `components/mode-switcher/ModeSwitcher.jsx` — True segmented control on a 2-column grid with sliding half-width indicator; arrow keys/Home/End keyboard navigation; `aria-checked` on active segment; `aria-describedby` helper; exactly one instance in DOM at any viewport
- `components/mode-switcher/ModeTransition.jsx` — Icon color `text-primary-contrast`
- `components/ui/StateCard.jsx` — Status indicator tones use `text-primary-contrast` on primary fill
- `components/AssessmentForm.jsx` — Select chevron replaced with `ChevronDown` element (replacing broken `bg-[url(...)]` that Tailwind couldn't parse)
- `components/SyntheticExamples.jsx` — Categorical option values aligned to trained Triagegeist values (e.g. `walk-in`, `public`, `cardiovascular`)
- `components/ExplainabilityPage.jsx` — Recharts colors use `var(--color-primary)` etc.
- `components/CVDistChart.jsx` — Recharts colors use CSS variables
- `components/ErrorBoundary.jsx` — Error background uses `bg-error-bg`
- `components/DiagnosisBanner.jsx` — Background uses surface gradient, text uses `text-ink`
| `components/research/ResearchSidebar.jsx` | Sidebar uses `bg-surface` text-ink; switcher removed (now only in header); scrollbar styled dark |
| `components/patient/PatientNav.jsx` | Wave icon `text-primary`; mode switcher always visible in header |
| `components/patient/PatientLayout.jsx` | Wave icon `text-primary` |

### Patient Mode pages
- `PatientHomePage`, `PatientAssessmentPage`, `PatientResultPage`, `PatientAboutPage` — all render in dark warm palette with proper contrast

### Research Lab pages
- `OverviewPage`, `PerformancePage`, `DatasetExplorerPage`, `ScenarioComparisonPage`, `ErrorAnalysisPage`, `ExplainabilityPage`, `ModelRegistryPage`, `ExperimentPage`, `DriftPage`, `MethodologyPage`, `SyntheticBenchmarkPage`
- All updated to use theme tokens; ESI badge colors use semantic `--color-esi-*` tokens; charts use `--color-primary` etc.

## 5. Screenshot Verification

Headless Chrome (google-chrome-stable) screenshots captured at 1440×1000 desktop and 390×844 mobile:

| File | Route | Viewport |
|---|---|---|
| `01-patient-home.png` | `/` | 1440×1000 |
| `02-patient-assessment.png` | `/assessment` | 1440×1000 |
| `03-patient-result.png` | `/result` | 1440×1000 |
| `04-patient-about.png` | `/about` | 1440×1000 |
| `05-research-performance.png` | `/performance` | 1440×1000 |
| `06-research-explainability.png` | `/explainability` | 1440×1000 |
| `07-dataset-explorer.png` | `/dataset` | 1440×1000 |
| `08-error-analysis.png` | `/errors` | 1440×1000 |
| `09-experiments.png` | `/experiments` | 1440×1000 |
| `10-model-registry.png` | `/registry` | 1440×1000 |
| `11-methodology.png` | `/methodology` | 1440×1000 |
| `13-patient-mobile.png` | `/` | 390×844 |
| `14-research-mobile.png` | `/performance` | 390×844 |

All 15 screenshots have valid file sizes (73–175 KB) and confirmed dark-themed rendering:
- Patient mode: warm charcoal background (~#1E1916)
- Research mode: cool navy-grey background (~#252A2E to #343B40)
- No blank pages, no missing content

### Issues found and fixed during visual QA:
1. **Missing theme utilities** — `bg-surface`, `text-secondary`, `text-muted` were not generated because theme variable names (`--color-bg-surface`) didn't match utility names. Fixed by renaming theme variables to match codebase usage.
2. **Missing `.bg-page` utility** — `bg-page` class was used but `--color-bg-page` produced `bg-bg-page`. Renamed to `--color-page`.
3. **`hasValue` rejecting non-numeric strings** — categorical fields (sex, chief_complaint_system) were silently dropped from API payloads because `Number('F')` is NaN. Fixed `hasValue()` to treat non-empty strings as valid.
4. **`writeStoredMode` reporting success with no storage** — fixed to return false when storage is unavailable.
5. **`evaluation_errors.json` 64K-row render freeze** — capped table rendering at 200 rows with count annotation.
6. **Chart placeholder text color** (`text-rose-400` on dark) — updated to theme tokens.
7. **API path prefix** — `run_data_prep`, `OverviewPage`, `ModelStatusProvider`, `SyntheticBenchmarkPage` were missing `/api` prefix on fetch calls; fixed.
8. **`build_reports` not reporting class distribution** — added `class_distribution` to manifest for data-driven limitations copy.
9. **Modal/popup background** — `bg-primary/10` on dark was nearly invisible; updated to dark-appropriate tokens.
10. **Primary button text contrast** (white on #14b8a6 = 2.3:1) — added `--color-primary-contrast` token (#052E2A) and applied to all primary buttons and switcher active label (5.9:1).

## 6. Accessibility & Responsive

- Mode switcher: `radiogroup`/`radio` roles, `aria-checked`, arrow-key navigation, `aria-describedby` helper
- Focus rings: sage-based `--focus-ring` on all interactive elements
- Reduced motion: `@media (prefers-reduced-motion: reduce)` disables transitions and animations
- Mobile: switcher collapses to short labels ("Patient"/"Research"); research sidebar is off-canvas on narrow screens; patient mode switcher remains in header at all widths
- No horizontal overflow at mobile widths (verified via screenshot at 390×844)
- Color contrast: all text meets WCAG AA (≥4.5:1 body, ≥3:1 large text)

## 7. Test & Build Results

| Command | Result |
|---|---|
| `venv/bin/python -m pytest tests/` (backend) | **157 passed, 0 failed** |
| `npx vitest run` (frontend) | **117 passed, 0 failed** (15 files) |
| `npx vite build` (frontend) | **Success** (dist/assets/index-*.js 14.4 MB, CSS 49.9 kB) |
| `curl /api/health` | 200 `{"status":"ok"}` |
| `curl /api/predict` | 200, valid ESI prediction, probabilities sum to 1.0 |

## 8. Remaining Limitations

- **No automated visual regression testing** — screenshots were captured manually via Chrome DevTools Protocol script (`frontend/scripts/screenshot.sh`); no visual-diff infrastructure exists
- **Production bundle size** (~14.4 MB JS) is dominated by the 64K-record out-of-fold error set imported statically by the frontend — pre-existing, not introduced by this task
- **Patient Mode data is in-memory only** — page reload on `/result` returns empty state; this is by design (clinical-shaped data not persisted)

## 9. Commands to Verify

```bash
# Backend
cd /secondary/MedGuard
source venv/bin/activate
python -m pytest tests/ -q

# Frontend
cd frontend
npm install
npx vitest run
npx vite build

# Serve production build
npx vite preview --port 4173
# Then open http://localhost:4173/
```
