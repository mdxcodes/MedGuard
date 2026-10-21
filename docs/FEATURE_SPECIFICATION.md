# MedGuard — Feature Specification

**Dataset:** Triagegeist (synthetic)
**Target:** five-level Emergency Severity Index (ESI) triage acuity
**Scope:** features available **at or before the initial triage assessment** only
**Source of truth:** `backend/ml/triagegeist_schema.py` (one `FieldSchema` per
column, each with a role, dtype and clinical envelope)

---

## 1. Target

| Item | Value |
|---|---|
| Column | `triage_acuity` |
| Meaning | Clinician-assigned ESI acuity level |
| Allowed values | **1, 2, 3, 4, 5** (preserved exactly as recorded) |
| Level 1 | Highest urgency |
| Level 5 | Lowest urgency |
| Rows with no label | Excluded from supervised learning (never imputed) |
| Remapping | **Forbidden.** The labels are never collapsed to Low/Moderate/High/Critical |

### Observed label distribution (80,000 labelled training rows)

| ESI level | Rows | Share |
|---|---|---|
| 1 | 3,222 | 4.03% |
| 2 | 13,439 | 16.80% |
| 3 | 28,921 | 36.15% |
| 4 | 23,020 | 28.78% |
| 5 | 11,398 | 14.25% |
| **Total** | **80,000** | 100.00% |

All five levels are present. ESI 1 is the rarest level, so its per-class
metrics are the least stable — but no level is structurally unlearnable.

---

## 2. Input feature allow-list

Every column below is available at initial triage. The allow-list is the
schema's `role="feature"` set and is asserted at runtime by
`assert_no_leakage_columns`.

### 2.1 Numeric (23)

| Feature | Unit | Handling |
|---|---|---|
| `age` | years | Median imputation, standard scaling |
| `arrival_hour` | hour of day (0–23) | Median imputation, standard scaling |
| `arrival_day` | ISO weekday (1–7) | Mapped from the weekday name in the raw release |
| `arrival_month` | month (1–12) | Median imputation, standard scaling |
| `heart_rate` | beats/min | Envelope [20, 220]; out-of-envelope → missing |
| `respiratory_rate` | breaths/min | Envelope [4, 60] |
| `temperature_c` | degrees Celsius | Mixed-unit normalisation; envelope [30, 42] °C |
| `spo2` | % | Envelope [50, 100] |
| `systolic_bp` | mmHg | Envelope [50, 250] |
| `diastolic_bp` | mmHg | Envelope [30, 150]; also checked against systolic |
| `pain_score` | 0–10 numeric rating scale | Sentinel parsing; envelope [0, 10] |
| `shock_index` | `heart_rate / systolic_bp` | Derived (§3) |
| `pulse_pressure` | `systolic_bp - diastolic_bp` | Derived (§3) |
| `mean_arterial_pressure` | `(systolic_bp + 2·diastolic_bp) / 3` | Derived (§3) |
| `gcs_total` | 3–15 | Median imputation, standard scaling |
| `weight_kg` | kg | Median imputation, standard scaling |
| `height_cm` | cm | Median imputation, standard scaling |
| `bmi` | kg/m² | Derived (§3) |
| `news2_score` | 0–20 | Median imputation, standard scaling |
| `num_prior_ed_visits_12m` | count | Median imputation, standard scaling |
| `num_prior_admissions_12m` | count | Median imputation, standard scaling |
| `num_active_medications` | count | Median imputation, standard scaling |
| `num_comorbidities` | count | Median imputation, standard scaling |

All numeric columns are median-imputed (median fitted on training rows only)
and then z-standardised.

### 2.2 Categorical (8)

| Feature | Example values |
|---|---|
| `sex` | `M`, `F`, `Other` |
| `language` | `English`, `Finnish`, `Russian`, … |
| `insurance_type` | `public`, `private`, `military`, `none` |
| `arrival_mode` | `walk-in`, `ambulance`, … |
| `transport_origin` | `home`, `public_space`, `nursing_home`, … |
| `arrival_season` | `spring`, `summer`, `autumn`, `winter` |
| `shift` | `morning`, `afternoon`, `night` |
| `chief_complaint_system` | `Cardiovascular`, `Respiratory`, `Neurological`, `Abdominal`, `Trauma` |

Encoded with one-hot encoding. Unknown categories at inference time are
ignored rather than raising.

### 2.3 Comorbidity history (25 boolean flags)

`patient_history.csv` supplies 25 `hx_*` flags (hypertension, diabetes type 1
and 2, asthma, COPD, heart failure, atrial fibrillation, CKD, liver disease,
malignancy, obesity, depression, anxiety, dementia, epilepsy, hypo- and
hyperthyroidism, HIV, coagulopathy, immunosuppressed, pregnant, substance use
disorder, coronary artery disease, prior stroke, peripheral vascular disease).

They are joined one-to-one on `patient_id` and are available in the dataset.
**They are not consumed by the deployed model**, because the assessment API
cannot supply them for a new presentation: a missing history would have to be
fabricated as "no comorbidity", which is exactly the kind of silent
fabrication this pipeline exists to avoid. They are documented here so the
omission is explicit rather than accidental, and the join is exercised by the
data-preparation pipeline.

### 2.4 Excluded from the model

| Column | Role | Reason |
|---|---|---|
| `patient_id` | identifier | Grouping key only; dropped before the estimator |
| `site_id` | identifier | Site is not an input to the assessment |
| `triage_nurse_id` | identifier | Never a legitimate model input |
| `disposition` | leakage | Recorded **after** triage |
| `ed_los_hours` | leakage | Recorded **after** triage |

Leakage columns are rejected by an assertion at runtime
(`assert_no_leakage_columns`), not merely omitted.

---

## 3. Derived features (row-wise, no fitted statistics)

| Feature | Definition | Leakage check |
|---|---|---|
| `shock_index` | `heart_rate / systolic_bp` (guarded: `systolic_bp > 0`) | Derived from vitals recorded at triage |
| `pulse_pressure` | `systolic_bp - diastolic_bp` | Same |
| `mean_arterial_pressure` | `(systolic_bp + 2·diastolic_bp) / 3` | Same |
| `bmi` | `weight_kg / (height_cm / 100)²` | Anthropometrics recorded at triage |

Division by zero or a non-positive systolic pressure yields `NaN`, never a
fabricated `0`.

---

## 4. Cleaning rules

| Rule | Behaviour |
|---|---|
| Temperature units | Values above 45 °C are treated as Fahrenheit and converted; plausible Celsius values are kept. Implausible results are set to missing and counted. |
| Pain sentinels | Textual sentinels (`UA`, `unable`, `unknown`, …) and the numeric `-1` used by Triagegeist for "not assessed" become missing. Values outside 0–10 become missing. All become missing with a retained missingness indicator. |
| Vital envelopes | Out-of-envelope vitals become missing and are counted per column. |
| Chief complaint | Lowercased, whitespace collapsed, and placeholder sentinels (`unknown`, `unknown-cc`, `n/a`, `none`, empty, …) mapped to the literal `unknown`. |
| Target | Rows without a label are dropped and counted — never imputed. |
| Missingness | Every imputable numeric column gets a binary `<column>_missing` indicator, so "not measured" is visible to the model. |

Every rule reports **how many** values it changed and **why**, and the counts
appear in the data-quality report. No rule silently mutates rows.

---

## 5. Privacy

- No chief-complaint free text and no patient identifier is ever written to a
  report. The chief complaint is used only as a **system-level category**
  (`chief_complaint_system`), not as free text.
- The quality and evaluation reports contain aggregate counts only; a leak
  scan over the generated artifacts is part of the verification suite.
