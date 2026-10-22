import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ModeProvider, TRANSITION_MS } from '../ModeProvider';
import ModeSwitcher from '../../components/mode-switcher/ModeSwitcher';
import { MODE_PATIENT, MODE_RESEARCH, MODE_STORAGE_KEY } from '../../lib/modeStorage';
import { memoryStorage } from '../../test/helpers';

function renderSwitcher({ storage, onNavigate } = {}) {
  return render(
    <ModeProvider storage={storage}>
      <ModeSwitcher onNavigate={onNavigate} />
    </ModeProvider>,
  );
}

describe('ModeProvider — mode state and persistence', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('defaults to Patient Mode for a new visitor', () => {
    renderSwitcher({ storage: memoryStorage() });
    const patient = screen.getByRole('radio', { name: 'Patient Mode' });
    const research = screen.getByRole('radio', { name: 'Research Lab' });
    expect(patient).toHaveAttribute('aria-checked', 'true');
    expect(research).toHaveAttribute('aria-checked', 'false');
  });

  it('restores a persisted mode without flashing the wrong shell', () => {
    const storage = memoryStorage({ [MODE_STORAGE_KEY]: MODE_RESEARCH });
    renderSwitcher({ storage });
    expect(screen.getByRole('radio', { name: 'Research Lab' })).toHaveAttribute('aria-checked', 'true');
  });

  it('falls back to Patient Mode when the persisted value is invalid', () => {
    const storage = memoryStorage({ [MODE_STORAGE_KEY]: 'not-a-mode' });
    renderSwitcher({ storage });
    expect(screen.getByRole('radio', { name: 'Patient Mode' })).toHaveAttribute('aria-checked', 'true');
  });

  it('persists the selected mode', async () => {
    const user = userEvent.setup();
    const storage = memoryStorage();
    renderSwitcher({ storage });

    await user.click(screen.getByRole('radio', { name: 'Research Lab' }));

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, TRANSITION_MS + 60));
    });

    expect(storage.getItem(MODE_STORAGE_KEY)).toBe(MODE_RESEARCH);
  });
});

describe('ModeSwitcher — interaction', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('switches to Research Lab and back to Patient Mode', async () => {
    const user = userEvent.setup();
    renderSwitcher({ storage: memoryStorage() });

    await user.click(screen.getByRole('radio', { name: 'Research Lab' }));
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, TRANSITION_MS + 60));
    });
    expect(screen.getByRole('radio', { name: 'Research Lab' })).toHaveAttribute('aria-checked', 'true');

    await user.click(screen.getByRole('radio', { name: 'Patient Mode' }));
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, TRANSITION_MS + 60));
    });
    expect(screen.getByRole('radio', { name: 'Patient Mode' })).toHaveAttribute('aria-checked', 'true');
  });

  it('is keyboard operable: arrow keys move between the options', async () => {
    const user = userEvent.setup();
    renderSwitcher({ storage: memoryStorage() });

    const patient = screen.getByRole('radio', { name: 'Patient Mode' });
    patient.focus();
    await user.keyboard('{ArrowRight}');

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, TRANSITION_MS + 60));
    });

    expect(screen.getByRole('radio', { name: 'Research Lab' })).toHaveAttribute('aria-checked', 'true');
  });

  it('is operable with the keyboard alone (Space activates the focused option)', async () => {
    const user = userEvent.setup();
    renderSwitcher({ storage: memoryStorage() });

    screen.getByRole('radio', { name: 'Research Lab' }).focus();
    await user.keyboard(' ');

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, TRANSITION_MS + 60));
    });

    expect(screen.getByRole('radio', { name: 'Research Lab' })).toHaveAttribute('aria-checked', 'true');
  });

  it('does not trigger overlapping transitions when clicked repeatedly', async () => {
    const user = userEvent.setup();
    const onNavigate = vi.fn();
    renderSwitcher({ storage: memoryStorage(), onNavigate });

    const research = screen.getByRole('radio', { name: 'Research Lab' });
    await user.click(research);
    await user.click(research);
    await user.click(research);

    // The transition is in flight: the control is disabled, so the repeated
    // clicks cannot queue another switch.
    expect(screen.getByRole('radio', { name: 'Research Lab' })).toBeDisabled();

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, TRANSITION_MS + 60));
    });

    // A single navigation was requested, not three.
    expect(onNavigate).toHaveBeenCalledTimes(1);
    expect(onNavigate).toHaveBeenCalledWith(MODE_RESEARCH);
  });

  it('applies the mode immediately when reduced motion is requested', async () => {
    const user = userEvent.setup();
    window.matchMedia = vi.fn().mockImplementation((query) => ({
      matches: query.includes('prefers-reduced-motion'),
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));

    const storage = memoryStorage();
    renderSwitcher({ storage });

    await user.click(screen.getByRole('radio', { name: 'Research Lab' }));

    // No waiting: the switch is applied synchronously.
    expect(screen.getByRole('radio', { name: 'Research Lab' })).toHaveAttribute('aria-checked', 'true');
    expect(storage.getItem(MODE_STORAGE_KEY)).toBe(MODE_RESEARCH);
  });

  it('exposes the two modes with explicit, distinct labels', () => {
    renderSwitcher({ storage: memoryStorage() });
    expect(screen.getByRole('radiogroup', { name: 'Interface mode' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Patient Mode' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Research Lab' })).toBeInTheDocument();
  });
});
