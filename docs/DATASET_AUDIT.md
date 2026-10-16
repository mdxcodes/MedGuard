# MedGuard — Phase 0: Dataset and Development Environment Audit

**Project:** MedGuard (Triage One) — AI-assisted emergency triage research prototype
**Audit date:** 2026-10-15
**Auditor:** Lead AI/ML engineer
**Status:** Complete. No training, model building, or database creation performed.

---

## 1. Dataset Identity and Version

| Item | Finding |
|---|---|
| Archive found | `/secondary/MedGuard/mimic-iv-ed-demo-2.2.zip` |
| Extracted location | `/secondary/MedGuard/mimic-iv-ed-demo-2.2/` |
| Dataset name | MIMIC-IV Emergency Department (MIMIC-IV-ED) |
| Version | **2.2** (confirmed from archive name and internal directory `mimic-iv-ed-demo-2.2`) |
| Variant | **Demo subset** — not the full dataset |
| Archive format | ZIP (containing gzip-compressed CSV files) |
| License | ODC Open Database License (ODbL) — verified in `LICENSE.txt` |
| Integrity files | `SHA256SUMS.txt` present with per-file SHA-256 checksums |
| Source authority | PhysioNet / MIT-LCP (documented in the demo package) |

**Demo vs. full dataset (verified).** The extracted tables contain only **222 ED stays and 64 unique patients**. The full MIMIC-IV-ED release contains ~425,000 ED stays from >200,000 patients, and the full ED module ships 6 tables (`diagnosis`, `edstays`, `medrecon`, `pyxis`, `triage`, `vitalsign`) plus a `README` / data dictionary. The demo package ships those same 6 data tables but **omits the data dictionary and the `README`** files. All findings below are specific to this demo subset and must be re-verified against the full dataset before any performance claims are made.

**Verified vs. assumed.**
- Verified: paths, table names, row counts, column names, value distributions, checksum file contents.
- Assumed (not verified from this package): column semantics and unit conventions, which normally come from the MIMIC-IV-ED data dictionary (absent here). Where semantics are inferred, this is stated explicitly.

---

## 2. File Inventory and Sizes

Working directory: `/secondary/MedGuard`

| File | Format | Compressed | Rows (excl. header) | Notes |
|---|---|---|---|---|
| `mimic-iv-ed-demo-2.2.zip` | ZIP | — | — | 95.5 KiB on disk |
| `mimic-iv-ed-demo-2.2/LICENSE.txt` | Text | — | — | ODbL license |
| `mimic-iv-ed-demo-2.2/SHA256SUMS.txt` | Text | — | — | 7 listed checksums |
| `.../ed/triage.csv.gz` | Gzip CSV | Yes | 222 | Primary ML table |
| `.../ed/edstays.csv.gz` | Gzip CSV | Yes | 222 | One row per ED stay |
| `.../ed/vitalsign.csv.gz` | Gzip CSV | Yes | 1038 | Repeated vital signs per stay |
| `.../ed/diagnosis.csv.gz` | Gzip CSV | Yes | 545 | ICD-coded ED diagnoses |
| `.../ed/pyxis.csv.gz` | Gzip CSV | Yes | 1082 | ED medication dispensations |
| `.../ed/medrecon.csv.gz` | Gzip CSV | Yes | 2764 | Medication reconciliation |

Compressed sizes on disk: triage 5.4 KiB, edstays 6.2 KiB, vitalsign 15 KiB, diagnosis 8.8 KiB, pyxis 13 KiB, medrecon 39 KiB. Total extracted data ≈ 100 KiB.

No Parquet, Feather, JSON, or database files are present.

**Inspection method.** All files were read as gzip-compressed CSV via `pandas.read_csv(path)` (pandas decompresses `.gz` transparently). Files were streamed with `zcat | wc -l` for row counts to avoid unnecessary decompression into memory. No patient-level free text was printed: chief complaints were inspected only as column names, counts, and a small number of short category-style tokens needed to confirm the field is a free-text/categorical label rather than a numeric field. Actual patient record contents (including diagnosis titles and medication names) were not reproduced in this report.

---

## 3. Table Schemas and Relationships

### 3.1 `triage` — the modelling table

Columns (11): `subject_id`, `stay_id`, `temperature`, `heartrate`, `resprate`, `o2sat`, `sbp`, `dbp`, `pain`, `acuity`, `chiefcomplaint`

- 222 rows, **222 unique `stay_id`**, 64 unique `subject_id`.
- `subject_id` → patient identifier; `stay_id` → ED visit identifier. One triage row per stay.
- `acuity` — clinician-assigned ESI level (1–5), read as float because of missing values. **This is the target.**
- Numeric vitals: `temperature`, `heartrate`, `resprate`, `o2sat`, `sbp`, `dbp`.
- `pain` — stored as **string**, containing digits plus non-numeric tokens (see §4.4).
- `chiefcomplaint` — free-text complaint string, 0 missing values.

### 3.2 `edstays` — ED stay/demographics table

Columns (9): `subject_id`, `hadm_id`, `stay_id`, `intime`, `outtime`, `gender`, `race`, `arrival_transport`, `disposition`

- 222 rows, 222 unique `stay_id`, 64 unique `subject_id`.
- `hadm_id` missing in 50 rows (22.5%) — these are stays without a linked hospital admission.
- Gender: F 122 / M 100.
- Race: 12 distinct values including `UNKNOWN` (6), `OTHER` (2), `UNABLE TO OBTAIN` (1), `PATIENT DECLINED TO ANSWER` (1).
- Arrival transport: AMBULANCE 133, WALK IN 75, UNKNOWN 13, OTHER 1.
- Disposition: ADMITTED 150, HOME 60, TRANSFER 5, OTHER 2, LEFT AGAINST MEDICAL ADVICE 2, LEFT WITHOUT BEING SEEN 2, ELOPED 1.

**No age column exists in this module.** The demo package contains no `patients` table, so age cannot be obtained without the MIMIC-IV core `patients` module (which supplies `anchor_year`, `anchor_age`, and `dod`). This is an open data gap for the feature set — see §6 and §8.

### 3.3 `vitalsign` — repeated vital signs

Columns (11): `subject_id`, `stay_id`, `charttime`, `temperature`, `heartrate`, `resprate`, `o2sat`, `sbp`, `dbp`, `rhythm`, `pain`

- 1038 rows, **206 unique `stay_id`** (vs. 222 in edstays/triage), 54 unique `subject_id`.
- Multiple measurements per stay recorded at `charttime`.
- `rhythm` is 96.8% missing (1005/1038); non-null values are free-text cardiac rhythm strings.
- 16 ED stays in `triage` have **no** corresponding `vitalsign` row.

### 3.4 `diagnosis`, `pyxis`, `medrecon` — post-triage tables (excluded from features)

| Table | Columns | Rows | Unique stays | Leakage status |
|---|---|---|---|---|
| `diagnosis` | `subject_id`, `stay_id`, `seq_num`, `icd_code`, `icd_version`, `icd_title` | 545 | 221 | **Excluded** — ED diagnoses are assigned after triage |
| `pyxis` | `subject_id`, `stay_id`, `charttime`, `med_rn`, `name`, `gsn_rn`, `gsn` | 1082 | 176 | **Excluded** — post-triage medication dispensations |
| `medrecon` | `subject_id`, `stay_id`, `charttime`, `name`, `gsn`, `ndc`, `etc_rn`, `etccode`, `etcdescription` | 2764 | 181 | **Excluded** — medication reconciliation occurs after triage |

`diagnosis.icd_version` is mixed: 296 ICD-10 and 249 ICD-9 codes.

### 3.5 Join relationships

```
subject_id (patient) ──1:N──> stay_id (ED visit)
     edstays (1 row per stay) ──1:1── triage (1 row per stay)
                                    └─1:N─> vitalsign
     diagnosis / pyxis / medrecon all key on stay_id
```

**Verified join integrity:**
- Every `triage.stay_id` exists in `edstays.stay_id` (222/222) and vice versa. No orphan stays in either direction. `triage` joins `edstays` 1:1 on `stay_id` with no duplication.
- No duplicate `stay_id` rows in `triage` or `edstays`; **0** duplicated `(subject_id, stay_id)` pairs.
- `vitalsign` joins to `triage` 1:N on `stay_id`; 206 of 222 stays are represented.

---

## 4. Data-Quality Findings

### 4.1 Missing values in `triage` (222 rows)

| Column | Missing | Missing % |
|---|---|---|
| `subject_id` | 0 | 0.00% |
| `stay_id` | 0 | 0.00% |
| `chiefcomplaint` | 0 | 0.00% |
| `acuity` | 15 | 6.76% |
| `pain` | 21 | 9.46% |
| `resprate` | 23 | 10.36% |
| `sbp` | 23 | 10.36% |
| `dbp` | 23 | 10.36% |
| `heartrate` | 24 | 10.81% |
| `o2sat` | 24 | 10.81% |
| `temperature` | 26 | 11.71% |

Pattern: vital-sign fields are missing together (roughly 10–12%), consistent with blocks of stays where no triage vitals were recorded, not random single-cell dropout. Among the 207 rows that do have an acuity label, missing vital counts fall to: temperature 11, heartrate 9, o2sat 9, resprate 8, sbp 8, dbp 8, pain 6. 194 of 207 labelled rows have all six vital signs present.

The 15 unlabelled rows are not randomly distributed by complaint type — they include high-acuity presentations (e.g. cardiac arrest, respiratory arrest, intubated trauma) alongside lower-acuity ones. These rows must be **dropped from supervised training**, never imputed with a guessed label.

### 4.2 Numeric feature ranges (`triage`, non-null only)

| Field | Count | Min | Median | Mean | Max | Expected range | Assessment |
|---|---|---|---|---|---|---|---|
| `temperature` | 196 | 36.5 | 98.1 | 97.79 | 100.3 | ~35–42 °C or 95–106 °F | **Mixed units** — see §4.3 |
| `heartrate` | 198 | 43 | 89.5 | 91.17 | 157 | 30–200 bpm | Plausible |
| `resprate` | 199 | 14 | 18 | 18.14 | 32 | 5–60 /min | Plausible; quantiles degenerate at 18 |
| `o2sat` | 198 | 78 | 98 | 97.69 | 100 | 50–100 % | Plausible |
| `sbp` | 199 | 70 | 136 | 136.95 | 218 | 50–250 mmHg | Plausible |
| `dbp` | 199 | 42 | 72 | 77.04 | **879** | 30–150 mmHg | **One implausible value (879 mmHg)** |
| `pain` | 201 (as strings) | 0 | 0 | — | — | 0–10 | **Values outside 0–10 present; non-numeric tokens present** |

`dbp` = 879 is a clear data-entry or unit error (mean is inflated to 77.04 with std 59.3 because of this single value; median-based summary is far more representative). It must be clipped or set to missing, not blindly passed to the model.

### 4.3 Temperature unit inconsistency (dataset-specific — important)

The `temperature` column mixes units within the same file:

- `triage`: 195 of 196 non-null values lie in 95.6–100.3 (Fahrenheit); **one value is 36.5** (Celsius — the Fahrenheit equivalent is ≈ 97.7 °F).
- `vitalsign`: of 579 non-null values, 543 lie at 95.6–104.9 (Fahrenheit) and **36 values lie at 31.4–36.8 (Celsius)**.

This is consistent with the documented MIMIC-IV-ED convention that temperature may be recorded in either unit. A blanket numeric conversion (e.g. "multiply everything by 9/5 + 32") would corrupt the 543/195 correct Fahrenheit values, and a blanket "treat all as Celsius" would be equally wrong.

**Recommended handling — validate, do not convert blindly:**
1. Split values by a plausibility rule before conversion: values < 45 are implausible as Fahrenheit body temperature and are therefore treated as Celsius; values ≥ 45 are treated as Fahrenheit. (Human core temperatures below ~34 °C / 93 °F are incompatible with routine ED triage, and a value such as 36.5 or 98.6 is unambiguous in only one interpretation.)
2. Convert the Celsius branch to a single canonical unit (either all-°C or all-°F) and record which rows were converted.
3. Re-check after conversion: canonical column should fall inside a clinical envelope (≈ 34–42 °C / 93–108 °F). Any value landing outside the envelope is set to missing and counted.
4. Log the count of converted rows and out-of-envelope rows per run as a validation assertion, so a future full-dataset run surfaces any new unit behaviour instead of silently absorbing it.
5. Cross-check against `vitalsign.temperature` for the same `stay_id` where both exist, as an independent sanity signal.

### 4.4 `pain` field quality

`pain` is stored as text, not numeric. Non-null values in `triage`:

- Digits: `0` (82), `8` (22), `10` (20), `5` (19), `7` (15), `9` (8), `4` (5), `3` (4), `2` (3), `6` (3), `1` (1) — a 0–10 scale.
- **Out-of-range numeric:** `13` appears 7 times, impossible on a 0–10 scale.
- **Non-numeric sentinels:** `UA` (3), `unable` (4), `uta` (1), `Critical` (2), `o` (1), `ett` (1) — abbreviations for "unable to assess" / "unable to answer" style entries, plus at least one clearly erroneous entry (`o`, `Critical`, `ett` do not denote a pain score).

Handling: coerce to numeric with `errors='coerce'`, map sentinel tokens (`UA`, `unable`, `uta` and their variants) to missing, mark values > 10 as invalid → missing, and add an explicit `pain_missing` / `pain_unassessable` indicator so the model can learn that unassessable pain is itself informative (common in ESI 1–2 presentations).

`vitalsign.pain` shows the same pattern (38 distinct tokens, incl. non-numeric), with 302/1038 missing; `vitalsign.rhythm` is 96.8% missing.

### 4.5 Duplicates and join problems

- **No duplicate visits**: 0 duplicate `stay_id`, 0 duplicate `(subject_id, stay_id)` in `triage`; same for `edstays`.
- **No join fragmentation risk for the 1:1 `triage`↔`edstays` merge** — row count is preserved at 222 on both directions.
- `vitalsign` is 1:N and will fan out rows if naively joined; it must be aggregated (e.g. first/earliest measurement per `stay_id`, or min/max/last per vital) before any modelling join.
- `hadm_id` is absent for 50 stays, so any future join to MIMIC-IV core tables on `hadm_id` would silently drop ~22.5% of the cohort; join on `stay_id` or `subject_id` instead.

### 4.6 Date plausibility

`intime`/`outtime`/`charttime` values are in the 2125–2201 range, i.e. **shifted into the future** to protect patient privacy (MIMIC's documented date-shifting convention). Dates are internally consistent and usable for durations and ordering, but they must never be interpreted as real calendar dates and must not be displayed as such in the application.

---

## 5. Target-Label Distribution

Target = `triage.acuity` (original five-level ESI), preserved as ordinal 1–5.

Across all 222 triage rows:

| ESI acuity | Rows | % of all rows | % of labelled rows |
|---|---|---|---|
| 1 (highest urgency) | 18 | 8.11% | 8.70% |
| 2 | 97 | 43.69% | 46.86% |
| 3 | 90 | 40.54% | 43.48% |
| 4 | 2 | 0.90% | 0.97% |
| 5 (lowest urgency) | 0 | 0.00% | 0.00% |
| Missing | 15 | 6.76% | — |
| **Total** | **222** | 100% | **207 labelled** |

Key observations:
- **ESI 5 is entirely absent** and ESI 4 has only 2 examples. A five-class classifier trained on this data cannot learn Level 5 at all, and Level 4 is effectively a single-patient signal.
- The distribution is strongly imbalanced toward ESI 2–3 (90.3% of labelled rows). Any per-class metric will be driven by those two classes.
- Only the 207 labelled rows are usable for supervised learning.

**Consequence for the target.** The label set must be preserved as the original five levels 1–5 — no remapping to Low/Moderate/High/Critical. However, evaluation must be designed around what the data can support:
- Report per-class recall/precision and a confusion matrix, not just overall accuracy.
- Explicitly state that Level 5 has zero support in this demo subset, so the model cannot be credited or penalised on it.
- For classes with near-zero support (4, 5), either (a) report them as "insufficient support — not evaluated" or (b) restrict the training/evaluation cohort to Levels 1–3 and state that restriction clearly, while keeping the label encoding 1–5 so a full-dataset retrain needs no schema change.
- Any performance claim must wait for the full dataset; on the demo subset, ESI 4 with 2 examples cannot yield a stable estimate.

---

## 6. Recommended Initial Feature Set

Selection rule: only variables recorded **at or before the triage assessment** — no post-triage, downstream, or outcome information.

### 6.1 Numeric features (from `triage`, available at initial triage)

| Feature | Source table | Unit handling | Notes |
|---|---|---|---|
| `temperature` | `triage` | Normalize mixed °C/°F per §4.3 | 11.7% missing; add missingness indicator |
| `heartrate` | `triage` | bpm, as recorded | 10.8% missing |
| `resprate` | `triage` | breaths/min | 10.4% missing |
| `o2sat` | `triage` | % | 10.8% missing; ≤ 92% is clinically meaningful for ESI |
| `sbp` | `triage` | mmHg | 10.4% missing |
| `dbp` | `triage` | mmHg | 10.4% missing; remove the 879 mmHg outlier |
| `pain` | `triage` | 0–10 after coercion | 9.5% missing + sentinel handling (§4.4) |

Derived clinically standard features, computed only from the above:
- Shock index = `heartrate / sbp` (a standard ESI-relevant derived vital).
- `sbp - dbp` (pulse pressure).
- Abnormal-vital count (e.g. how many of `o2sat` < 92, `sbp` < 90 or > 180, `heartrate` > 100, `resprate` > 20, `temperature` > 38.3 are flagged).

Derived features must be computed **inside** the training pipeline (fitted on train folds only) to avoid leakage from imputation statistics.

### 6.2 Categorical / contextual features (from `edstays`, known at arrival)

| Feature | Cardinality | Notes |
|---|---|---|
| `arrival_transport` | 4 (incl. UNKNOWN) | Known at arrival; ambulance arrival correlates with acuity |
| `gender` | 2 | Known at arrival |
| `race` | 12 (incl. UNKNOWN, OTHER, DECLINED, UNABLE) | Known at arrival; high cardinality with rare levels — group rare values or one-hot with a frequency threshold |
| Time-of-day / day-of-week from `intime` | derived | Potentially informative; note dates are shifted |

**Excluded from `edstays`:** `outtime` (post-triage), `disposition` (an outcome — direct leakage), `hadm_id` (post-triage linkage).

### 6.3 `chiefcomplaint`

`chiefcomplaint` is free text available at triage and is genuinely predictive. Recommended handling: a controlled text representation — TF-IDF over a curated vocabulary, or hashing to a modest number of buckets, with normalization (uppercase, strip punctuation). Keep feature count small relative to 207 labelled rows; with this sample size, a bag-of-words vocabulary of a few hundred terms risks overfitting. Also treat placeholder-like values (`UNKNOWN-CC` and similar) as a missing category rather than a real complaint.

### 6.4 Excluded as leakage (post-triage)

- `edstays.disposition`, `edstays.outtime`
- `vitalsign` — repeated measurements taken throughout the stay; earliest measurements may be near-coincident with triage, but later ones encode the evolving clinical course. If used at all, restrict to the **first measurement per `stay_id` before the triage timestamp**, and document that choice. Default recommendation: exclude until a strict time-based filter is validated.
- `diagnosis` (ED ICD codes assigned during/after the visit)
- `pyxis` (medications dispensed during the stay)
- `medrecon` (medication reconciliation, post-triage)
- MIMIC-IV core tables (`patients`, `admissions`, `labevents`, `chartevents`, `procedures`) — outcomes, labs drawn later, and downstream information. `patients.anchor_age` is a legitimate exception for age if the core module is obtained (see §6.5).

### 6.5 Age — currently unavailable

**There is no age field in this package.** Age is a strong, standard triage feature (age extremes shift ESI). Options:
1. Obtain the MIMIC-IV core `patients` table and join on `subject_id` to derive age at the ED visit (`anchor_year` / `anchor_age` with the documented shifting convention). This requires credentialed access and re-verification.
2. Proceed without age and record it as a known feature gap.

Do not fabricate or impute age. Until the core module is obtained, the feature set is vitals + arrival context + chief complaint.

---

## 7. Leakage Prevention and Data-Splitting Strategy

### 7.1 Leakage rules

1. **Drop all post-triage fields** listed in §6.4 from the feature frame. Target is `acuity` only.
2. **Fit all preprocessing on the training split only** — imputers, scalers, TF-IDF vocabularies, outlier clipping thresholds, and categorical groupings. Use a single `sklearn.pipeline.Pipeline` with `ColumnTransformer` so that no statistic from validation/test folds influences fitting. Cross-validation must use `Pipeline` objects, not pre-transformed arrays.
3. **Derive features from triage-time variables only.** Shock index and abnormal-vital counts use triage vitals only; nothing from `vitalsign` charttimes after triage.
4. **Never use `disposition`, `outtime`, or `hadm_id` as features** — disposition in particular is an outcome of the triage decision and would trivially encode acuity.
5. **Patient independence:** the same `subject_id` must not appear in both train and test (see §7.2).
6. `stay_id` and `subject_id` are identifiers — excluded from the feature matrix. Keep them only as join/grouping keys, never as model inputs.
7. Leakage regression check before every training run: assert that the intersection of train and test `subject_id` sets is empty, and assert that no excluded column name appears in the model input feature list.

### 7.2 Patient-grouped train/test split

**Verified:** 64 unique patients account for 222 stays. 35 patients have more than one visit; the maximum is **23 visits from a single patient** (`subject_id` 10014354), followed by 16, 15, 12, 11. Among the 207 labelled rows, 34 subjects have >1 labelled visit (max 23). Multi-visit subjects contribute 186 of 207 labelled rows; single-visit subjects contribute 21.

This concentration means a naive random row-level split would place the same patient's repeated visits in both training and test sets, inflating scores through patient memorisation (a patient's recurring complaints and stable physiology recur across their own visits). A **group-aware split on `subject_id` is mandatory.**

**Recommended procedure:**
1. Use `StratifiedGroupKFold` (scikit-learn) for cross-validation, with `groups = subject_id` and stratification on `acuity`. This keeps patients intact while approximately preserving class proportions.
2. Hold out a grouped test set with `GroupShuffleSplit(groups=subject_id, test_size≈0.2)`, stratified as far as class counts allow, and never refit on it.
3. Because 56 patients hold all 207 labelled rows, a grouped split yields very few patients per fold — e.g. a 5-fold group split puts ~11 patients in each fold. Report this small-group limitation explicitly rather than reporting a single optimistic metric.

**Limitations to report:**
- **Level 5 has zero rows and Level 4 has 2 rows.** Stratification on `acuity` with these counts will either fail to place a Level 4 in every fold or produce folds with a single Level-4 row. Practical approach: stratify on a collapsed grouping only for split construction (e.g. Levels 1–3 vs Level 4 vs missing) while keeping the model's target as the original 1–5 labels, and disclose this.
- 64 patients (56 labelled) is a very small unit of grouping; group-level variance dominates any metric. Metrics should be reported as means ± standard deviation across folds, and interpreted as indicative only.
- Patient-level imbalance (one patient contributing 23 of 207 rows, ~11%) means a single patient's removal from training materially changes class counts.

### 7.3 Suggested split plan for the demo subset

- Cohort: 207 labelled rows (acuity non-null), grouped by `subject_id`.
- Outer holdout: `GroupShuffleSplit` on `subject_id`, ~20% of patients.
- Inner model selection: `StratifiedGroupKFold(n_splits=5, groups=subject_id, y=acuity)`.
- Report per-class precision/recall/F1, macro-F1, quadratic-weighted kappa (appropriate for ordinal ESI labels), and the confusion matrix.
- Baseline required for context: prior-rate classifier and a simple `DummyClassifier(stratified)`. No comparison to a "clinical threshold" is claimed.

---

## 8. Missing-Data and Unit-Handling Recommendations

### 8.1 Missing data

| Field | Missing (labelled rows) | Recommended handling |
|---|---|---|
| `acuity` | 15/222 overall | Drop from supervised cohort; never impute a label |
| `temperature` | 11/207 | Median impute (train-fitted) + missingness indicator |
| `heartrate` | 9/207 | Median impute + missingness indicator |
| `o2sat` | 9/207 | Median impute + missingness indicator |
| `resprate` | 8/207 | Median impute + missingness indicator |
| `sbp` | 8/207 | Median impute + missingness indicator |
| `dbp` | 8/207 | Outlier-clean then median impute + missingness indicator |
| `pain` | 6/207 + 12 sentinel/out-of-range values | Coerce → missing; add `pain_missing` indicator |
| `race`, `arrival_transport` | UNKNOWN/OTHER levels | Retain UNKNOWN as its own category; do not drop |
| `chiefcomplaint` | 0 | Placeholder-like values → missing category |

Rationale for median + indicator (rather than mean or model-based imputation): Vitals are missing in correlated blocks and the dataset is small; median imputation is robust to the documented `dbp` outlier, and the explicit indicator preserves the information that a measurement was absent — often itself a signal of acuity (an obtunded or arrested patient has no recorded pain score).

Missingness is **not** MCAR — the 15 unlabelled rows skew toward severe presentations, and vitals are missing together. State this when interpreting imputed results; avoid multiple imputation with plausible but invented values for a B.Tech-scale prototype.

### 8.2 Unit handling summary

| Field | Issue | Action |
|---|---|---|
| `temperature` | Mixed °C/°F in one column (1/196 in `triage`; 36/579 in `vitalsign`) | Split by plausibility threshold (§4.3), convert Celsius branch, validate envelope, log converted counts. Do **not** apply a blanket conversion |
| `dbp` | 879 mmHg value | Clip to clinical envelope or set missing; record the change |
| `pain` | Values > 10; sentinel tokens | Coerce, invalidate out-of-range, map sentinels to missing |
| `vitalsign.temperature` | Same mixed-unit issue | Same rule if `vitalsign` is ever used |

### 8.3 Date handling

Dates are privacy-shifted (years 2125–2201). Use them only for durations/ordering; never surface them as real dates, and never compute "age from birth" without the core `patients` table.

---

## 9. Environment and Dependency Findings

### 9.1 Operating system and Python

- **OS:** CachyOS Linux (Arch-based rolling release), x86_64.
- **Python:** 3.14.7 (system) and 3.14.7 (virtual environment).

### 9.2 Virtual environment

A virtual environment was created at `/secondary/MedGuard/venv` during this audit (no pre-existing venv was present). Installed and verified:

| Package | Version |
|---|---|
| pandas | 3.0.6 |
| numpy | 2.5.4 |
| scikit-learn | 1.9.1 |
| joblib | 1.6.0 |
| shap | 0.53.0 |

Note: system `pip` is externally managed (PEP 668 on this distribution), so all project dependencies must be installed inside `/secondary/MedGuard/venv`. Python 3.14 is a recent version; if any dependency issue arises, a Python 3.11/3.12 venv is the fallback (pandas 3.x and numpy 2.5 installed cleanly here).

### 9.3 Git repository status

- **No Git repository exists** — `git status` in `/secondary/MedGuard` returns "not a git repository". No branch, no commits, no uncommitted changes, no remotes.
- No `.gitignore` exists. **This must be created before any commit.**

### 9.4 Existing project structure

- **Frontend:** none. No `package.json`, no `node_modules`, no `src/`.
- **Backend:** none. No `app/`, no `main.py`, no `requirements.txt`, no `FastAPI` project files.
- **Database:** none. No schema files, no Supabase configuration.
- **Model artifacts:** none. No joblib/pickle model files.
- **Secrets:** none found. No `.env`, no keys, no credentials tracked or present.
- **Docs:** none prior to this audit; `docs/` was created for this report.

Current contents of `/secondary/MedGuard`:
```
mimic-iv-ed-demo-2.2.zip
mimic-iv-ed-demo-2.2/        (LICENSE.txt, SHA256SUMS.txt, ed/*.csv.gz)
docs/                        (created by this audit)
venv/                        (created by this audit)
```

### 9.5 Data tracked by Git

No Git repository exists, so nothing is tracked yet. **Critical before any commit:** the dataset directory (`mimic-iv-ed-demo-2.2/`) and archive (`mimic-iv-ed-demo-2.2.zip`) are ~100 KiB of licensed MIMIC data and must never be committed to a public GitHub repository. They must be excluded via `.gitignore`, along with `venv/`, `__pycache__/`, `.env`, and any generated model artifacts.

---

## 10. Risks, Limitations, and Recommended Next Steps

### 10.1 Risks and limitations

| # | Risk | Severity | Mitigation |
|---|---|---|---|
| 1 | **Demo subset, not full data.** 222 stays / 64 patients vs. ~425k stays / >200k patients in full MIMIC-IV-ED | High | All results are indicative only; re-run the entire pipeline on the full dataset before any claim |
| 2 | **Class imbalance / absent Level 5.** ESI 5 = 0 rows, ESI 4 = 2 rows | High | Report per-class metrics; restrict evaluation scope to Level 1–3 with disclosure, or mark 4/5 "insufficient support"; keep 1–5 label encoding |
| 3 | **Heavy patient repetition.** 23 visits from one patient; 186/207 labelled rows from multi-visit patients | High | Patient-grouped split is mandatory; report group-level limitations |
| 4 | **Mixed temperature units in one column** | High | Plausibility-split + validated conversion (§4.3), never blanket conversion; log converted counts |
| 5 | **`pain` is a text field** with out-of-range values (13) and sentinel tokens | Medium | Coerce to numeric, invalidate out-of-range, map sentinels to missing, add indicator |
| 6 | **Implausible `dbp` = 879 mmHg** | Medium | Outlier-clean or set missing; record the change |
| 7 | **Missing-at-block vitals (~10–12%)** correlated with acuity | Medium | Median impute (train-fitted) + missingness indicators; document non-MCAR missingness |
| 8 | **No age field** — a standard triage predictor | Medium | Obtain MIMIC-IV core `patients` module for `anchor_age`, or proceed without age and record the gap |
| 9 | **No data dictionary in the demo package** | Medium | Obtain the official MIMIC-IV-ED data dictionary; until then, treat column semantics as inferred |
| 10 | **`vitalsign` fan-out and post-triage contamination** | Medium | Exclude by default; if used, restrict to first pre-triage measurement and document |
| 11 | **Privacy-shifted dates (2125–2201)** | Low | Durable for duration/ordering; never display as real dates |
| 12 | **15 unlabelled rows skew severe** (arrest, respiratory arrest, intubated trauma) | Medium | Drop from supervised cohort; do not impute labels; report that omission |
| 13 | **No git repo / no `.gitignore`** | High | Initialise repo with `.gitignore` covering data, `venv/`, secrets, and artifacts before first commit |
| 14 | **No baseline or evaluation harness exists** | Medium | Establish dummy baselines and a metrics module before model work |
| 15 | **Patient-level free text** in `chiefcomplaint` and record contents | Low | Not reproduced in this report; no raw data to be committed or uploaded; no real records used as demo patients |

### 10.2 Recommended next steps (Phase 1 preparation)

1. **Initialise the repository** with a `.gitignore` covering: `mimic-iv-ed-demo-2.2/`, `*.zip`, `venv/`, `__pycache__/`, `*.pyc`, `.env`, `*.joblib`, `*.pkl`, `data/`, `models/`. Verify `git status` shows no data files staged before the first commit.
2. **Create `requirements.txt`** with pinned versions from §9.2, plus `fastapi`, `uvicorn`, `python-dotenv`, `pydantic`, `pytest`, `matplotlib` for the eventual stack.
3. **Obtain the official MIMIC-IV-ED data dictionary** and verify column semantics against it (especially `acuity`, `pain` sentinel tokens, and the temperature unit convention).
4. **Obtain the MIMIC-IV core `patients` table** to supply age at visit; otherwise formally record age as a known gap.
5. **Build a data-loading and validation module** (`data/load.py`, `data/validate.py`) that: reads the gzip CSVs, verifies SHA-256 checksums from `SHA256SUMS.txt`, applies the temperature unit rule, coerces `pain`, cleans the `dbp` outlier, drops unlabelled rows, and emits a machine-readable data-quality report. Include the unit-conversion and out-of-envelope assertions.
6. **Build the leakage-checked feature pipeline** using a `ColumnTransformer` + `Pipeline`, with an explicit allow-list derived from §6 and an assertion that no excluded column name is present.
7. **Implement the grouped split** (`StratifiedGroupKFold` + `GroupShuffleSplit` on `subject_id`) with a train/test patient-overlap assertion, and record the split seed.
8. **Establish baselines** (dummy prior-rate and stratified classifiers) and a metrics module reporting per-class precision/recall/F1, macro-F1, quadratic-weighted kappa, and a confusion matrix, with fold means ± std.
9. **Plan the full-dataset migration path** so the same code runs on the complete MIMIC-IV-ED release with no schema change (label encoding stays 1–5).

### 10.3 Compliance and safety

- MIMIC data is licensed under ODbL and governed by the PhysioNet Credentialed Health Data License; it must not be uploaded to public services or committed to GitHub.
- No actual research records may be used as public demo patients; UI demonstrations must use clearly synthetic data.
- No performance claims have been made and no metrics have been generated — no model has been trained.
- The system is not, and must not be described as, clinically validated.

---

## 11. Audit Completion Summary

| Item | Result |
|---|---|
| **Dataset location** | `/secondary/MedGuard/mimic-iv-ed-demo-2.2/` (extracted from `/secondary/MedGuard/mimic-iv-ed-demo-2.2.zip`) |
| **Files found** | 6 gzipped CSVs under `ed/`: `triage`, `edstays`, `vitalsign`, `diagnosis`, `pyxis`, `medrecon`; plus `LICENSE.txt` and `SHA256SUMS.txt` |
| **Dataset version** | MIMIC-IV-ED **v2.2**, **demo subset** (222 stays, 64 patients) |
| **Triage labels available** | ESI acuity 1–5 label field present; **observed: Level 1 (18), Level 2 (97), Level 3 (90), Level 4 (2), Level 5 (0)**; 15 rows unlabelled; 207 labelled rows usable |
| **Major data-quality concerns** | ESI 5 absent / ESI 4 nearly absent; strong class imbalance; heavy patient repetition (up to 23 visits/patient); mixed °C/°F temperature units; `pain` stored as text with out-of-range values and sentinels; one implausible `dbp` (879 mmHg); ~10–12% block-missing vitals; no age field; no data dictionary in the package |
| **Environment** | CachyOS Linux, Python 3.14.7, venv at `/secondary/MedGuard/venv` with pandas 3.0.6, numpy 2.5.4, scikit-learn 1.9.1, joblib 1.6.0, shap 0.53.0; no Git repo, no frontend, no backend, no DB, no secrets, no tracked data |
| **Ready for Phase 1?** | **Yes — with the documented limitations.** The data location is clear, the target and feature set are defined, leakage rules and the grouped-split strategy are specified, and the key data-quality issues are identified with handling plans. Proceed only on the understanding that this demo subset cannot support clinical performance claims, and that the full MIMIC-IV-ED dataset is required for any meaningful evaluation. |

**This audit is complete. Awaiting approval before implementing the data pipeline.**
