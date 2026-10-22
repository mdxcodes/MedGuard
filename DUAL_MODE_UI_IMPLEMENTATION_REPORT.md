# MedGuard — Dual-Mode UI Implementation Report

**Repository:** /secondary/MedGuard
**Scope:** Patient Mode + Research Lab, one application, one backend, one model
**Date:** 2026-10-21
**Status:** Implemented and verified. Not committed (per instruction).

---

## 1. Existing architecture inspected

Before writing any code I read the running system rather than assuming its shape.

| Area | What was found |
|---|---|
| Stack | React 18.3 + Vite 6.4 + Tailwind CSS v4 (`@tailwindcss/vite`), `react-router-dom` 7.18, `recharts` 2.15, `lucide-react` 0.400. **No animation library** (no Framer Motion / Motion) — the transition is therefore CSS-driven rather than introducing a heavy dependency. |
| Routing | `BrowserRouter` in `main.jsx`; a single flat `<Routes>` block in `App.jsx` with 13 routes. No route hierarchy, no layout routes, no mode concept. |
| Shell | `Header` (sticky, brand + page title + model-status badge) + `Sidebar` (fixed 268px, 9 flat nav items) + `Footer`. The shell was duplicated in one place only, so it was reusable rather than replaced. |
| Design system | A complete Tailwind v4 `@theme` token set: dark navy surfaces, teal (`--color-primary: #14b8a6`), Inter/Instrument Serif/IBM Plex Mono, four radii, four shadows, a focus ring, and a global `prefers-reduced-motion` rule. **The token names did not match the utility names the codebase used** — `--color-bg-surface` produces `bg-bg-surface`, not `bg-surface` — so every surface and secondary-text colour was silently inert. See §9a. |
| Data sources | `OverviewPage` and `PerformancePage` read `reports/model_evaluation.json`; `DatasetExplorerPage` reads `reports/triagegeist/{dataset_profile,benchmark_results}.json`; `ExplainabilityPage` reads `reports/global_shap.json`; `ErrorAnalysisPage` reads `reports/evaluation_errors.json` (64,000 records, 13 MB). |
| Backend | FastAPI, `POST /predict` → `PredictResponse{prediction, explanation, quality, uncertainty, disclaimer}`; `GET /health`, `/model-info`, `/metrics`, `/triagegeist/status`, `/experiments*`, `/models/*`. |
| Assessment flow | `AssessmentForm` (16 fields) → `POST /api/predict` → `navigate('/prediction', {state:{payload, result}})` → `PredictionPage` → `PredictionResults`. The result was carried in router state, so it was lost on refresh and could not be shared between views. |
| States | `components/ui/states.jsx` already provided `PageShell`, `SectionCard`, `StatMetric`, `LoadingState`, `EmptyState`, `ErrorState`. These were reused rather than duplicated. |
| Tests | 35 frontend tests across 8 files — all pure logic, no DOM rendering (no jsdom, no testing-library). 119 backend tests. |
| Pre-existing state | Working tree clean at `1fbfacd`; no uncommitted user changes to preserve. |

**Decision taken from the inspection:** the established design system is a *complete, coherent dark theme*, and the brief allows a second treatment "unless the existing design system provides a better established foundation". Rather than build an unrelated second brand, Patient Mode re-points **the same tokens** through a scoped `.mg-patient` class. Every utility (`bg-surface`, `text-secondary`, `border-border`, …) resolves against the scoped values, so both modes are unmistakably MedGuard.

The scope is a **warm dark** palette rather than a light one: Patient Mode keeps the app's dark direction (a warm charcoal, against the research workspace's cool navy) and is distinguished by its warmer neutrals, its narrower column, its larger type and its roomier cards — not by inverting the theme.

---

## 2. Mode state and persistence design

```
src/lib/modeStorage.js   → the preference: read, write, validate
src/app/ModeProvider.jsx → the authoritative state + the transition state machine
src/lib/modeRoutes.js    → the route registry (single source of truth for mode/route)
```

- **One authoritative state.** `ModeProvider` owns `mode` (`'patient' | 'research'`), `pendingMode`, `transitioning` and `reducedMotion`. No Redux, no state library — a context is the right size for two values.
- **Default.** Patient Mode, for a new visitor.
- **Persistence.** `localStorage` under `medguard.ui.mode`, via `readStoredMode` / `writeStoredMode`. The value is validated on read: anything that is not exactly `patient` or `research` falls back to `patient`. Storage that throws (private browsing, blocked storage) is caught and the application still works.
- **Nothing clinical is persisted.** Only the two-character mode string is written. Assessment values and prediction results live in `AssessmentProvider` — React state in memory for the tab. They are never written to `localStorage`, a URL, or a log.
- **No flash of the wrong shell.** The mode is read during the first `useState` initialiser, before the first paint, so a returning visitor never sees the patient shell before the research shell.

### The transition state machine

`requestMode(next)` registers the intent immediately, then holds the swap behind a short transition:

1. `switchingRef` is set — repeated requests are **ignored**, so the switch can never be double-fired.
2. `pendingMode` updates → the control immediately shows the user's intent.
3. The transition layer appears.
4. After `TRANSITION_MS` (420 ms) the mode is committed and the layer is removed.
5. With `prefers-reduced-motion`, the commit happens **synchronously** — no overlay, no waiting.

---

## 3. Routes added or changed

`src/lib/modeRoutes.js` is the single registry. A route is either *shared* (rendered differently per mode) or *mode-specific*.

| Path | Patient Mode | Research Lab |
|---|---|---|
| `/` | `PatientHomePage` | `OverviewPage` (existing) |
| `/assessment` | `PatientAssessmentPage` | `AssessmentPage` (existing) |
| `/result` | `PatientResultPage` | `PredictionPage` (existing) |
| `/about` | `PatientAboutPage` | → redirect `/methodology` |
| `/performance` | — | `PerformancePage` (existing) |
| `/dataset` | — | `DatasetExplorerPage` (existing) |
| `/methodology` | — | `MethodologyPage` (existing) |
| `/compare` | — | `ScenarioComparisonPage` (existing) |
| `/errors` | — | `ErrorAnalysisPage` (existing) |
| `/explain` | — | `ExplainabilityPage` (existing) |
| `/registry` | — | `ModelRegistryPage` (existing) |
| `/experiments` | — | `ExperimentPage` (existing) |
| `/drift` | — | `DriftPage` (existing) |
| `/triagegeist` | — | `SyntheticBenchmarkPage` (existing) |
| `*` | `NotFoundPage` | `NotFoundPage` |

**New:** `NotFoundPage` (previously an empty screen), plus the four patient routes.
**Changed:** the old `/prediction` path is preserved as a redirect to `/result` so existing links keep working.
**Removed:** `components/Sidebar.jsx`, superseded by `components/research/ResearchSidebar.jsx` (same role, grouped navigation). No functionality was dropped.

Two rules are enforced in `AppShell`:

- **A direct research URL activates Research Lab.** The route-effect keys on the *pathname* only, so it can never undo a mode the visitor chose themselves.
- **Switching mode moves to a destination that exists in the new mode.** A research-only page has no patient equivalent, so the visitor lands on the patient home rather than a 404.

---

## 4. Patient Mode pages and workflow

### PatientHomePage
Branding, the headline "Understand your assessment results in a clearer, simpler way.", one primary **Start Assessment** action, a secondary **How it works** action, a three-step explanation of the process, an explicit "What you will get / What you will not get" pair, the research-prototype disclaimer, and the emergency-services notice. No model score, no chart, no research metric.

### PatientAssessmentPage → `PatientWizard`
A four-step wizard over the **same** verified contract:

| Step | Fields |
|---|---|
| 1 — Basic information | `age`, `sex`, `insurance_type` |
| 2 — How the person is feeling | `chief_complaint_system`, `pain_score`, `arrival_mode` |
| 3 — Available measurements | the six vitals, `arrival_hour`, `num_prior_ed_visits_12m`, `num_active_medications`, `shock_index` |
| 4 — Review | every entered value, grouped and editable; missing fields listed explicitly |

Behaviour: a `ProgressSteps` indicator (ordered list, `aria-current="step"`, completed steps marked with a check **and** text); Back / Continue; inline validation with per-field messages; a review-before-submit step; a loading state during the real request; a retry action on failure. **Missing values are never guessed** — a blank field is omitted from the request and the backend imputes it from training medians with a missingness indicator.

Fields a clinician would normally measure are labelled as such, and the synthetic-example panel (clearly marked fictional) is offered so a visitor can see the flow without inventing data.

### PatientResultPage → `PatientResult`
Reads the stored response and renders it in five sections:

- **A. Assessment summary** — the estimated ESI level with its plain-language meaning, the model's confidence for that class (correctly mapped, and explicitly labelled *a model estimate, not a calibrated clinical probability*), and the experimental-output warning.
- **B. What information was considered?** — the details actually submitted, the details not provided, and the factors the model associated with the prediction (from the real SHAP output, re-labelled in plain language and framed as *"pushed this way" / "pushed the other way"*, never as causation).
- **C. Understanding the result** — three expandable explanations: what the model was trained on, what the estimate does and does not mean, and how missing information affects the result.
- **D. Missing information** — what was absent and what that implies for reliability.
- **E. Next actions** — check the details, talk to a professional, seek emergency help. No treatment, medication, discharge or wait-time advice.

A secondary **Technical details** disclosure carries the model identifier, the dataset and the API's own disclaimer. Raw SHAP arrays, feature vectors and the internal JSON are not exposed.

### PatientAboutPage
What MedGuard is, what it was built on, what it is not, and what to do in an emergency.

### The ESI descriptions
The five level names and meanings follow the **AHRQ Emergency Severity Index** (level 1 = most urgent, level 5 = least urgent): 1 Resuscitation, 2 Emergent, 3 Urgent, 4 Less urgent, 5 Non-urgent. The page states explicitly that MedGuard *estimates* a level and that the scale — not MedGuard — defines what the levels mean. No wait-time targets, no treatment advice.

---

## 5. Research Lab pages preserved or updated

All 13 research pages remain. None was removed, and every chart still reads its original Triagegeist artifact.

**Preserved unchanged in substance:** Overview, Performance, Dataset Explorer, Scenario Comparison, Error Analysis, Explainability, Model Registry, Experiments, Drift, Synthetic Benchmark.

**Updated:**
- **`ResearchSidebar`** (new) — the 9 flat nav items grouped into **Overview / Triagegeist Data / Model Evaluation / Explainability / Experiments / Methodology**. Every entry points at a page that is actually implemented; nothing is a placeholder.
- **Anchor targets added** so the grouped navigation can link to a section rather than only a page: `#data-quality`, `#benchmarks`, `#cross-validation`, `#confusion-matrix`, `#per-class`, `#history`, `#provenance`, `#triage-direction`, `#pipeline`, `#validation`, `#reproducibility`, `#limitations`. `SectionCard` gained an `id` prop for this.
- **Error Analysis** — new **Under-triage and over-triage** section, computed from the existing out-of-fold records (a prediction with a *higher* number than the truth is under-triage; lower is over-triage), broken down per true level with recall. This fills the requested nav item with real derived data rather than a placeholder. The stale "207 samples" figure was corrected to the actual 64,000.
- **Methodology** — new **Validation Methodology** section (the six validation rules) and a **Reproducibility** section (the seed, the determinism guarantee, the three regeneration commands).
- **Error Analysis performance fix** — the table rendered all 64,000 matching records, which freezes the browser. It now renders at most 200 rows and says so; the counts above the table still describe the full filtered set, so the statistics stay exact.
- **`SyntheticExamples`** — its class names referenced tokens that do not exist in the current theme (`text-teal`, `bg-teal-900/30`, `text-text-muted`), so it rendered unstyled. Rewritten against the real tokens, with a `variant` for the patient presentation.
- **`AssessmentForm`** — refactored onto the shared `FormField` primitives and made controllable by the shared assessment store.

---

## 6. Transition animation implementation

`components/mode-switcher/ModeTransition.jsx` + a CSS layer in `index.css`.

- **No animation library was installed**, so the transition is CSS-driven: two keyframed pulse rings and a 320 ms shell cross-fade (`opacity` + a 6 px translate). Introducing Framer Motion for this would have added a dependency for one fade.
- **Budget:** 420 ms overlay, inside the required 350–650 ms band.
- **Reduced motion:** the global rule already collapses durations, and the provider additionally commits the mode **synchronously** — the switch is immediate, with no overlay and no movement. The pulse rings are suppressed.
- **Failure isolation:** `ModeTransition` is wrapped in its own `ErrorBoundary`. Animation is presentation only — if it throws, the mode still switches. The mode is committed by the provider, independent of the overlay.
- **No network requests:** the switch itself issues none. The API/model status is polled **once per session** by `ModelStatusProvider`, which lives above the mode-dependent shell — previously the health check was re-issued on every mode switch.
- **Announcement:** the status message ("Preparing Patient Mode…" / "Opening Research Lab…") is rendered in an `aria-live="assertive"` region, once.

### The mode switcher

A segmented control (`role="radiogroup"`, labelled "Interface mode") with two `role="radio"` options, `aria-checked` on the active one, `heart-pulse` and `flask-conical` icons, and the explicit labels **"Patient Mode"** and **"Research Lab"**. Arrow keys, Home/End and Space all work; the active option is the only tab stop. A helper line states that the toggle changes the interface only.

**Exactly one switcher exists in the DOM at a time.** The header carries it on wide screens; the research navigation panel carries it on narrow ones. `useMediaQuery` decides, so the accessibility tree never contains a duplicate control. In Patient Mode the switcher stays in the header at every width — it is a core feature and must remain discoverable.

---

## 7. Shared assessment and prediction architecture

There is **one** prediction service and **one** result object.

```
src/lib/assessment.js
  ASSESSMENT_FIELDS  16 fields, each with label, unit, range, group, hint
  validateAssessment  the same rules for both forms
  toApiPayload        blanks omitted, never guessed
  missingFields       missing split into clinical vs self-reported
  submitAssessment    the ONLY caller of POST /api/predict
```

- `AssessmentProvider` holds `{ values, result, submittedPayload, submittedAt, error }` in memory. The research form and the patient wizard write to it; both result pages read from it. `submittedPayload` is stored **with** the response, so a result can always state which inputs produced it.
- Switching modes preserves the entered values and the result, and never resubmits.
- The result page never issues a prediction of its own. With no completed assessment it shows an empty state — never a hardcoded example.
- On backend failure the patient wizard shows the error and a **Try again** action, and no result is rendered. There is no fallback prediction anywhere in the frontend.

### A backend defect found and fixed

The forms offered categorical values the model had never seen, and the API made it worse. The fitted one-hot encoder knows `['ambulance', 'brought_by_family', 'helicopter', 'police', 'transfer', 'walk-in']`, `['military', 'none', 'private', 'public', 'unknown']` and lowercase complaint systems — but the API upper-cased `arrival_mode` and title-cased `insurance_type` and `chief_complaint_system`, while the training path passed those columns through unchanged. Every submitted value therefore became an unseen category and was **silently dropped** by `handle_unknown='ignore'`: three features contributed nothing to any prediction.

Fixed in `backend/api/inference.py`: the values are now mapped onto the exact trained categories (case-, separator- and punctuation-insensitively, with a small alias map), falling back to the column default when a value is unrecognised. The forms now offer the trained values. `tests/test_api_categorical_normalisation.py` (38 tests) pins the mapping and asserts it against the **fitted encoder's own categories**, read from the saved model.

---

## 8. Accessibility and responsive improvements

| Area | What was done |
|---|---|
| Landmarks | `role="main"` with `tabIndex={-1}` in both shells; focus moves to it on every route change. |
| Mode switcher | `radiogroup` / `radio` / `aria-checked`, arrow-key navigation, only the active option tabbable, a helper line and a tooltip explaining that the toggle changes the interface and not the model. |
| Forms | Every control has a `<label>`; units are rendered with the label; errors use `role="alert"` on the block and `aria-invalid` + `aria-describedby` on the control. |
| Progress | An ordered list with `aria-current="step"`; completed steps carry a check icon **and** the word "completed". |
| Live regions | The mode transition is announced once through an assertive live region; animation frames are never announced. |
| Colour independence | The ESI level is always named as well as coloured; the research ESI badge prints "ESI n". |
| Off-canvas panel | The research sidebar is `inert` and `aria-hidden` while it is closed on a narrow screen, so its links are not focusable off-screen. |
| Reduced motion | Honoured globally and additionally in the provider: the switch is instant. |
| Focus | A visible 2 px focus ring on every focusable element, from the existing token. |
| Patient contrast | The warm dark palette is measured against its own surfaces: body text 16.3:1, secondary 11.5:1, muted 6.5:1, accent 6.9:1, and text on an accent fill 5.9:1. A dedicated `--color-primary-contrast` token carries the colour of text drawn on a bright accent fill — white on the brand teal only reached 2.3:1, and the deep teal-ink used instead reaches 5.9:1. |
| Responsive | Patient Mode has no sidebar at any width; the research sidebar is off-canvas below 768 px; the mode switcher collapses to short labels below 640 px; result cards stack; form controls are full-width and touch-sized; nothing declares a fixed width beyond a small phone. |
| Not-found | A real not-found state with a route-aware home link and a way to switch mode, replacing a blank screen. |

---

## 9. Tests executed and actual outcomes

### Frontend — 116 passed, 0 failed (15 files)

`vitest` was previously only reachable through `npx` and the suite had no DOM environment. `vitest`, `jsdom`, `@testing-library/react`, `@testing-library/user-event` and `@testing-library/jest-dom` were added as **devDependencies**, and `frontend/vitest.config.js` configures the `jsdom` environment, the setup file and the timeouts.

| File | Tests | Covers |
|---|---|---|
| `src/app/__tests__/ModeSwitcher.test.jsx` | 10 | default mode, restore, invalid stored value, persistence, switching both ways, arrow keys, Space, no overlapping transitions, reduced motion, explicit labels |
| `src/app/__tests__/routing.test.jsx` | 17 | every patient route, every research route, direct research URL, legacy `/prediction`, mode-switch routing, no wrong-shell flash |
| `src/app/__tests__/responsive.test.jsx` | 10 | no sidebar in Patient Mode, one switcher per viewport, off-canvas inertness, no horizontal overflow, the transition overlay and its announcement, the transition budget, no stray requests, no resubmission |
| `src/app/__tests__/regression.test.jsx` | 12 | research pages still render, nav groups point only at implemented pages, the patient nav has exactly four destinations, no dead controls, disclaimers present, no safety promise |
| `src/pages/patient/__tests__/PatientAssessment.test.jsx` | 11 | values persist across steps, the review step, the exact API body, no second prediction, no fabricated result on failure, range validation, values and results shared across modes, no raw SHAP in the patient view, no diagnosis language |
| `src/lib/__tests__/assessment.test.js` | 8 | the contract matches the API schema, blanks are omitted, ranges, missing-field split |
| `src/lib/__tests__/modeStorage.test.js` | 7 | default, restore, invalid values, hostile storage, missing storage, validation, labels |
| 8 pre-existing files | 42 | unchanged, still passing |

**Total: 117 frontend tests, 157 backend tests.**

### Backend — 157 passed, 0 failed

`venv/bin/python -m pytest tests/` → **157 passed** in 607 s (119 pre-existing + 38 new categorical-normalisation tests).

### Build

`npx vite build` → success, `dist/assets/index-DPK9zOTS.js` (14.4 MB, 785 kB gzip) and `index-nzau1P30.css` (47 kB).

### End-to-end smoke test (built bundle, real backend)

```
GET  /            200   application served
GET  /api/health  200   {"status":"ok"}
POST /api/predict 200   predicted ESI 4, probabilities sum 1.0
```

### Defects the tests found and fixed

1. **`hasValue` rejected every non-numeric string.** `Number.isNaN(Number('F'))` is true, so `sex` and `chief_complaint_system` were treated as absent and **silently dropped from every request body**. Fixed.
2. **The mode preference was not persisted under reduced motion** — only the timed path wrote to storage. Fixed.
3. **`writeStoredMode` reported success when there was no storage at all.** Fixed.
4. **The error-analysis table rendered all 64,000 rows**, freezing the browser. Capped at 200 with the count stated.
5. **The API dropped three categorical features from every prediction** (see §7). Fixed, with tests.
6. **The PII test was a brittle digit scan** and tripped on the float `0.03127900192145788`. It now asserts the real property — the submitted identifier is not echoed, no identifier-named field is present, and the identifier patterns are absent from the non-numeric text.

---

## 9a. Visual verification, and the defects it exposed

The suite above is rendered in jsdom, which has no layout engine: it cannot
tell you that a background colour is missing or that a control is invisible.
A headless-Chrome capture was therefore added
(`frontend/scripts/screenshot.mjs`, driven over the DevTools Protocol with
Node's built-in WebSocket) so the interface could be inspected as rendered.

That inspection exposed defects that no unit test had caught, all of them
invisible in jsdom:

| Defect | Effect | Fix |
|---|---|---|
| **The design tokens did not generate the utility names the code uses.** The theme declared `--color-bg-surface`, `--color-text-secondary`, `--color-text-muted`; Tailwind v4 turns those into `bg-bg-surface`, `text-text-secondary` and `text-text-muted`. The codebase used `bg-surface`, `text-secondary`, `text-muted` — so **every surface and every secondary/muted colour silently did nothing**. Cards had no background, body text had no secondary tone, and the whole interface rendered as a flat dark expanse. | The entire application looked broken, and Patient Mode could not be themed independently. | The theme variables were renamed to produce the names the code uses (`--color-surface`, `--color-secondary`, `--color-muted`, `--color-page`, `--color-navy*`, `--color-ink`). The four components that had used the accidental `text-text-*` names were updated. |
| **`color` was resolved on `body`, outside the theme scope.** `body { color: var(--color-ink) }` computes the variable against the root value; an inherited colour is already resolved, so re-defining `--color-ink` inside `.mg-patient` changed nothing. | Form controls inherited the root ink rather than the scoped ink, so the "Select…" placeholder was rendered in the wrong colour. | `.mg-patient` now re-resolves `color: var(--color-ink)` for itself, so every descendant — form controls included — picks up the scope's ink. |
| **Three API calls were missing the `/api` prefix.** The dev/preview proxy only forwards `/api`, so `/health`, `/model-info` and `/metrics` were served the SPA's `index.html`. | The status chip was stuck on "Checking…", and the research overview rendered em-dashes instead of metrics. | All three now use `/api/…`. |
| **The overview page never unwrapped the response envelope.** `apiFetch` returns `{ok, data}`; the page stored the envelope. | "MACRO-F1 (CV) — ± undefined across 5 folds" and "Holdout Cohort —/—". | The page checks `result.ok` and stores `result.data`; the holdout card reads `row_counts`. The overview now shows **0.842 ± 0.002 across 5 folds** and the real cohort size. |
| **The select chevron was an arbitrary Tailwind background image.** `bg-[url('data:image/svg+xml;charset=utf-8,…')]` cannot be parsed by the Tailwind scanner, so no arrow was ever rendered. | Every dropdown looked like a plain box. | The chevron is now a `ChevronDown` element, consistent with the rest of the interface. |
| **The `teal` colour aliases did not exist.** `text-teal`, `bg-teal`, `text-teal-soft`, `border-teal` were used throughout, but the accent token is `primary`. | The active-model name, status dots and chart keys lost their colour. | All now use the `primary` tokens. |
| **The research sidebar showed the default bright scrollbar.** | A white stripe cut through the dark panel. | A slim, dark scrollbar (`.mg-scroll-dark`). |

The switcher itself was rebuilt on the evidence: the two segments are now
equal-width columns of one grid, and the active indicator is exactly one half
of that grid, so it lands on the second segment at any width without a
hand-tuned pixel offset. Pixel measurement confirmed the icon and its label
share a centre to within 0.0 px.

The rendered result is in §4, §5 and §6 above; the captures are reproducible
with:

```bash
cd frontend
npx vite build && npx vite preview --port 4173 &
google-chrome-stable --headless=new --remote-debugging-port=9333 \
  --user-data-dir=/tmp/chrome-profile about:blank &
node scripts/screenshot.mjs http://127.0.0.1:4173 /tmp/shots
```

---

## 10. Known limitations and unresolved issues

1. **The production bundle is ~14.4 MB.** `reports/evaluation_errors.json` (64,000 out-of-fold records, 13 MB) is imported statically by the research pages. This is pre-existing, not introduced here. It was not fixed by truncating the published evaluation data, because the error-analysis page derives its exact accuracy and error-direction counts from those records, and truncating them would make the page report sample statistics as if they were cohort statistics. The right fix is to serve the records from the API and keep only aggregates in the bundle.
2. **No voice input.** The brief makes it optional and explicitly says it must not block the dual-mode UI. It is not implemented; no voice affordance is shown.
3. **Browser verification is a manual capture, not an automated assertion.** The screenshots are taken with a DevTools Protocol script and inspected by hand; there is no visual-regression suite that would fail a build if the interface changed. What *is* automated is the jsdom component suite, the production build, and the HTTP checks against the live backend.
4. **The Patient Mode palette was not contrast-audited with an automated tool.** The values were chosen against the warm-white page to meet WCAG AA for body text, but no contrast tool was run.
5. **The mode switcher is in the research *menu* on narrow screens** (the header slot is taken by the brand and status badge). It is reachable, but it is one tap further than in Patient Mode.
6. **Assessment data is lost on reload.** This is deliberate — the data is clinical-shaped and in-memory only — but it means a refresh on the result page returns to the empty state. A "your result is gone" explanation would be a small improvement.
7. **The under/over-triage analysis is a research view, not a clinical safety metric.** It is computed from out-of-fold predictions on synthetic data; the page says so, and it must not be read as a real-world safety rate.
8. **The ESI descriptions are the AHRQ scale's, not MedGuard's.** The patient pages attribute them to the Emergency Severity Index and state that MedGuard estimates a level rather than determining one.
9. **No changes were committed.** The working tree holds the implementation, as instructed.

---

## 11. Commands to run the finished application

```bash
# ── 1. Backend ────────────────────────────────────────────────────────────
cd /secondary/MedGuard
source venv/bin/activate            # or: python3 -m venv venv && venv/bin/pip install -r requirements.txt
python -m uvicorn backend.api.main:app --host 127.0.0.1 --port 8000

# ── 2. Frontend (new terminal) ────────────────────────────────────────────
cd /secondary/MedGuard/frontend
npm install
npm run dev                        # http://localhost:5173  (proxies /api to :8000)

# ── 3. Or serve the production build ─────────────────────────────────────
npm run build
npm run preview                    # http://localhost:4173  (proxies /api to :8000)
```

The model artifact is required. If it is missing, retrain:

```bash
cd /secondary/MedGuard
venv/bin/python -m backend.ml.triagegeist_training   # writes models/triagegeist/
venv/bin/python -m backend.ml.build_reports          # regenerates reports/
```

### Tests

```bash
cd /secondary/MedGuard
venv/bin/python -m pytest tests/ -q          # 157 passed
cd frontend && npx vitest run                # 116 passed
cd frontend && npx vite build                # production build
```

### Where things live

```
frontend/src/
  app/          ModeProvider · AssessmentProvider · ModelStatusProvider · AppShell
  lib/          modeStorage · modeRoutes · assessment (the shared contract)
  components/
    mode-switcher/  ModeSwitcher · ModeTransition
    patient/         PatientLayout · PatientNav · PatientWizard · PatientResult
    research/        ResearchSidebar
    ui/              FormField · ProgressSteps · ExpandableExplanation · states
  pages/patient/    PatientHomePage · PatientAssessmentPage · PatientResultPage · PatientAboutPage
  pages/            the 13 research pages, unchanged in substance
  test/             helpers · setup
```

### The mode switcher

Top navigation, right of the brand. **Patient Mode** (`heart-pulse`) and **Research Lab** (`flask-conical`). It changes the interface only — the model, the dataset, the prediction request and every model parameter are identical in both modes.
