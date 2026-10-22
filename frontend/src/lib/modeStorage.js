/**
 * Mode preference persistence.
 *
 * The mode is a pure UI preference — it changes which presentation shell is
 * rendered, never the model, the dataset, the prediction logic or any
 * parameter. It is therefore safe to persist, and it is stored as a
 * non-sensitive string under a dedicated key.
 *
 * Nothing clinical is ever written here: assessment values and prediction
 * results live in memory only (see `app/AssessmentProvider.jsx`).
 */

export const MODE_PATIENT = 'patient';
export const MODE_RESEARCH = 'research';

export const MODES = [MODE_PATIENT, MODE_RESEARCH];

export const MODE_STORAGE_KEY = 'medguard.ui.mode';

/** The mode a brand-new visitor gets. */
export const DEFAULT_MODE = MODE_PATIENT;

export function isValidMode(value) {
  return MODES.includes(value);
}

/**
 * Read the persisted mode.
 *
 * Returns DEFAULT_MODE when nothing is stored, when the stored value is not a
 * recognised mode, or when storage is unavailable (private browsing, a
 * disabled storage partition, a non-browser environment).
 */
export function readStoredMode(storage) {
  try {
    const raw = storage?.getItem?.(MODE_STORAGE_KEY);
    if (!raw) return DEFAULT_MODE;
    const parsed = raw === MODE_PATIENT || raw === MODE_RESEARCH ? raw : null;
    return parsed || DEFAULT_MODE;
  } catch {
    return DEFAULT_MODE;
  }
}

/** Persist the mode. Storage failures are swallowed: the UI still works. */
export function writeStoredMode(mode, storage) {
  if (!isValidMode(mode)) return false;
  if (!storage || typeof storage.setItem !== 'function') return false;
  try {
    storage.setItem(MODE_STORAGE_KEY, mode);
    return true;
  } catch {
    return false;
  }
}

/** Human-readable label for a mode. */
export function modeLabel(mode) {
  return mode === MODE_RESEARCH ? 'Research Lab' : 'Patient Mode';
}
