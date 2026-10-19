# Triagegeist Compatibility Audit

Location: /secondary/MedGuard/triagegeist

## 1. Files & Counts
- train.csv (80000 rows), test.csv (20000), chief_complaints.csv (100000), patient_history.csv (100000), sample_submission.csv (20000)

## 2. Target Distribution (train)
- ESI 1: 3222 (4.0%)
- ESI 2: 13439 (16.8%)
- ESI 3: 28921 (36.2%)
- ESI 4: 23020 (28.8%)
- ESI 5: 11398 (14.2%)

Full range present; synthetic dataset.

## 3. Mapping vs MedGuard
Compatible vitals; separate domain. Recommend separate benchmark (Option B). No data committed.
