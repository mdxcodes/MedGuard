import { describe, it, expect } from 'vitest';
import {
  DEFAULT_MODE,
  MODE_PATIENT,
  MODE_RESEARCH,
  MODE_STORAGE_KEY,
  isValidMode,
  modeLabel,
  readStoredMode,
  writeStoredMode,
} from '../modeStorage';
import { memoryStorage } from '../../test/helpers';

describe('Mode storage', () => {
  it('defaults to Patient Mode when nothing is stored', () => {
    expect(readStoredMode(memoryStorage())).toBe(DEFAULT_MODE);
    expect(DEFAULT_MODE).toBe(MODE_PATIENT);
  });

  it('reads a stored mode', () => {
    const storage = memoryStorage({ [MODE_STORAGE_KEY]: MODE_RESEARCH });
    expect(readStoredMode(storage)).toBe(MODE_RESEARCH);
  });

  it('falls back to Patient Mode for an invalid stored value', () => {
    for (const bad of ['', 'patient ', 'RESEARCH', 'null', 'dark-mode']) {
      const storage = memoryStorage({ [MODE_STORAGE_KEY]: bad });
      expect(readStoredMode(storage)).toBe(MODE_PATIENT);
    }
  });

  it('survives a storage that throws', () => {
    const hostile = {
      getItem() { throw new Error('blocked'); },
      setItem() { throw new Error('blocked'); },
    };
    expect(readStoredMode(hostile)).toBe(MODE_PATIENT);
    expect(writeStoredMode(MODE_RESEARCH, hostile)).toBe(false);
  });

  it('handles a missing storage implementation', () => {
    expect(readStoredMode(null)).toBe(MODE_PATIENT);
    expect(writeStoredMode(MODE_RESEARCH, null)).toBe(false);
  });

  it('writes only valid modes', () => {
    const storage = memoryStorage();
    expect(writeStoredMode('nonsense', storage)).toBe(false);
    expect(storage.getItem(MODE_STORAGE_KEY)).toBe(null);
    expect(writeStoredMode(MODE_RESEARCH, storage)).toBe(true);
    expect(storage.getItem(MODE_STORAGE_KEY)).toBe(MODE_RESEARCH);
  });

  it('validates modes', () => {
    expect(isValidMode(MODE_PATIENT)).toBe(true);
    expect(isValidMode(MODE_RESEARCH)).toBe(true);
    expect(isValidMode('other')).toBe(false);
  });

  it('labels the modes explicitly', () => {
    expect(modeLabel(MODE_PATIENT)).toBe('Patient Mode');
    expect(modeLabel(MODE_RESEARCH)).toBe('Research Lab');
  });
});
