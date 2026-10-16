# MedGuard — Feature Specification

**Phase:** 1 (data preparation)
**Target:** original five-level Emergency Severity Index (ESI) triage acuity
**Scope:** features available **at or before the initial triage assessment** only

---

## 1. Target

| Item | Value |
|---|---|
| Column | `triage.acuity` |
| Meaning | Clinician-assigned ESI acuity level |
| Allowed values | **1, 2, 3, 4, 5** (preserved exactly as recorded) |
| Level 1 | Highest urgency |
| Level 5 | Lowest urgency |
| Rows with no label | Excluded from supervised learning (never imputed) |
| Remapping | **Forbidden.** The labels are never collapsed to Low/Moderate/High/Critical |

### Observed label distribution (207 labelled rows)

| ESI level | Rows | Share |
|---|---|---|
| 1 | 18 | 8.70% |
| 2 | 97 | 46.86% |
| 3 | 90 | 43.48% |
| 4 | 2 | 0.97% |
| 5 | **0** | **0.00% (absent)** |
| **Total** | **207** | 100.00% |

Level 5 is absent from the demo subset, and Level 4 has only two rows. The
five-level encoding is retained so that a full-dataset retrain needs no schema
change, but evaluation must not credit or penalise the model on Level 5.

---

## 2. Input feature allow-list

Every column below is available at initial triage. The allow-list is enforced
in `backend/ml/config.py` and asserted at runtime.

### 2.1 Numeric vital signs (`triage`)

| Feature | Unit after cleaning | Missing % (207 rows) | Range | Handling |
|---|---|---|---|---|
| `temperature` | **degrees Celsius** (canonical) | 5.31% | 35.33–37.94 | Mixed-unit normalisation (§4) then median imputation |
| `heartrate` | beats/min | 4.35% | 43–157 | Median imputation |
| `resprate` | breaths/min | 3.86% | 14–32 | Median imputation |
| `o2sat` | % | 4.35% | 78–100 | Median imputation |
| `sbp` | mmHg | 3.86% | 116.5–154.5 (IQR) | Median imputation |
| `dbp` | mmHg | 4.35% | 62–82.5 (IQR) | Outlier removal, then median imputation |
| `pain` | 0–10 numeric rating scale | 12.08% | 0–10 | String parsing (§4), then median imputation |

All are z-standardised by `StandardScaler` after median imputation.

### 2.2 Derived features (row-wise, no fitted statistics)

| Feature | Definition | Leakage check |
|---|---|---|
| `shock_index` | `heartrate / sbp` | Only triage vitals. `NaN` when `sbp` is missing or <= 0 |
| `pulse_pressure` | `sbp - dbp` | Only triage vitals |
| `abnormal_vital_count` | Count of vitals outside fixed clinical thresholds (§3) | Thresholds are clinical constants chosen before inspecting the data |

`abnormal_vital_count` flags: `o2sat < 92`, `sbp < 90`, `sbp > 180`,
`heartrate > 100`, `resprate > 20`, `temperature > 38.3 C`.

### 2.3 Categorical features (`edstays`, known at arrival)

| Feature | Cardinality | Handling |
|---|---|---|
| `arrival_transport` | 4 (`AMBULANCE`, `WALK IN`, `UNKNOWN`, `OTHER`) | Constant imputation for nulls, then one-hot with `min_frequency=5` (rare categories grouped) |

### 2.4 Text feature (`triage`)

| Feature | Handling |
|---|---|
| `chiefcomplaint` | Deterministic normalisation upstream (uppercase, whitespace collapse, placeholders -> `unknown`), then `TfidfVectorizer` with `min_df=5`, `max_features=300`, sublinear TF, tokens of >= 2 characters |

The vocabulary is **fitted on training rows only**. It contained 25 terms on
the real training split; the token cap prevents the 168 distinct complaints in
207 rows from over-fitting the text component.

### 2.5 Missingness indicator features

One 0/1 indicator per feature, so that "the nurse could not assess this" is
itself usable signal:

`temperature_missing`, `heartrate_missing`, `resprate_missing`,
`o2sat_missing`, `sbp_missing`, `dbp_missing`, `pain_missing`

These are passed through untouched (already binary integers).

---

## 3. Explicitly excluded fields and why

### 3.1 Post-triage / outcome leakage

| Field / table | Reason for exclusion |
|---|---|
| `edstays.disposition` | Discharge outcome of the triage decision — direct target leakage |
| `edstays.outtime` | Occurs after triage |
| `edstays.hadm_id` | Post-triage hospital-admission linkage |
| `vitalsign` (whole table) | 1,038 repeated measurements taken *throughout* the ED stay; later rows encode the evolving clinical course. Use only if restricted to the first pre-triage measurement, and only after that filter is validated |
| `diagnosis.*` | ED ICD codes assigned during/after the visit |
| `pyxis.*` | Medications dispensed during the stay |
| `medrecon.*` | Medication reconciliation, after triage |

### 3.2 Sensitive demographics (excluded from the baseline)

| Field | Reason |
|---|---|
| `race` | Available at arrival, but its 12 categories include `UNKNOWN`, `OTHER`, `UNABLE TO OBTAIN` and `PATIENT DECLINED TO ANSWER`; no documented research justification for the baseline. Re-add only with an explicit, written justification and bias analysis |
| `gender` | As above |

### 3.3 Identifiers

| Field | Treatment |
|---|---|
| `subject_id` | Retained **only** for patient-grouped splitting and auditing; dropped by the pipeline before any estimator sees it |
| `stay_id` | Retained only for deduplication checks and split diagnostics; never a feature |

---

## 4. Data-quality rules applied before the pipeline

### 4.1 Temperature (mixed Celsius/Fahrenheit)

The audited cohort records temperature in **both units within one column**:
1 Celsius value and 195 Fahrenheit values among 196 non-null entries in the
labelled cohort.

Rule, implemented in `backend/ml/validation.py::normalize_temperature`:

1. Parse as numeric; unparseable entries become missing and are counted.
2. A value at or below 45 is interpreted as **Celsius** (93.2 F == 34 C is
   the lowest plausible living adult temperature, so such a value cannot be
   valid Fahrenheit).
3. A value above 45 is interpreted as **Fahrenheit** and converted with
   `(F - 32) * 5 / 9`.
4. Any value outside the canonical envelope `[34.0, 42.0]` C after
   conversion is set to missing and counted — never clipped.
5. Conversion and rejection counts are written to the data-quality report.

Measured effect on the real cohort: 195 Fahrenheit values converted, 1 Celsius
value detected, 0 rejected, final range 35.33–37.94 C.

A blanket conversion of the whole column would have corrupted the 195 correct
Fahrenheit values; the per-row plausibility rule avoids that.

### 4.2 Diastolic blood pressure

Values outside `[30, 150]` mmHg are set to missing and counted. The audited
**879 mmHg** entry was rejected by this rule rather than clipped. A secondary
check counts `dbp > sbp` as physiologically contradictory without altering
either value.

### 4.3 Pain score

`pain` is stored as **text** and mixes three entry kinds:

| Kind | Examples | Action |
|---|---|---|
| Numeric score | `0`–`10` | Kept |
| Unassessable sentinel | `UA`, `UTA`, `unable` | Missing + counted as `pain_unassessable` |
| Out of range | `13` | Missing + counted as `pain_out_of_range` |
| Unrecognised token | `Critical`, `o`, `ett` | Missing + counted as `pain_unparseable` |

Measured effect on the real cohort: 8 unassessable, 4 unparseable, 7 out of
range -> 19 removed, 182 usable scores. A `pain_missing` indicator preserves
the distinction between "no pain" and "pain could not be assessed".

### 4.4 Chief complaint

Normalised by uppercase, whitespace collapse, and mapping placeholders
(`UNKNOWN-CC`, `UNKNOWN`, `N/A`, `none`, empty, `-`) to the literal `unknown`.
Tokenisation and vocabulary selection happen in the fitted TF-IDF step, so no
text statistic is computed from the full cohort.

No chief-complaint text is logged or written to any report.

### 4.5 Missing targets

15 of 222 rows carry no clinician-assigned acuity label. They are excluded
from supervised learning. They are **not** imputed, inferred from the chief
complaint, or predicted by a proxy model.

---

## 5. Unavailable features

### Age — not available

The demo package contains no `patients` table and no age column anywhere in
`edstays` or `triage`. Age is a standard and clinically meaningful triage
predictor (age extremes shift ESI), but it is **not fabricated, inferred or
imputed** here.

To add it later:
1. Obtain the MIMIC-IV core `patients` table (credentialed access).
2. Derive age at the ED visit from `anchor_year` / `anchor_age`, accounting
   for the documented privacy date-shifting.
3. Validate the join on `subject_id` (all 64 demo patients must match).
4. Add it to the allow-list in `backend/ml/config.py` with its own tests.

Other unavailable-at-triage candidates (labs, imaging, provider assessment)
are deliberately not attempted.

---

## 6. Final model-input feature count

Fitted on the real training split: **35 model-input features**.

| Branch | Features |
|---|---|
| Numeric vitals | 6 |
| Derived | 3 |
| `arrival_transport` | 4 (3 levels + `infrequent_sklearn` bucket) |
| Chief complaint (TF-IDF) | 22 terms |
| Missingness indicators | 7 |
| **Total** | **35** |

The count changes with the training split and is recomputed on every run.

---

## 7. Guards enforced at runtime

1. `assert_no_leakage_columns` — raises if any column in
   `FORBIDDEN_FEATURE_COLUMNS` is present (tolerating only `subject_id`,
   `stay_id` and the target, which the pipeline drops).
2. `leakage_free_feature_names` — raises if any identifier column name
   reaches the model-input matrix.
3. `remainder='drop'` in the `ColumnTransformer` — any column not explicitly
   allow-listed is discarded.
4. All imputers, encoders and the TF-IDF vocabulary are fitted inside the
   pipeline, so cross-validation folds fit them on their own training rows.
5. Tests assert each of the above, plus that a test-only-text token never
   enters the TF-IDF vocabulary.
