import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import App from '../../App';
import { SETTINGS_STORAGE_KEY } from '../../types/settings';

describe('Ears Only App UI', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('renders defaults with Advanced Settings collapsed, Basic Triads active, 80 BPM, length 4, repeats 2', () => {
    const { container } = render(<App />);

    expect(screen.getByText('Ears Only')).toBeInTheDocument();
    expect(container.textContent).not.toContain('—');
    expect(screen.getByText('Auto key')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /start pocket mode/i }),
    ).toBeInTheDocument();

    // Advanced settings collapsed by default
    const advButton = screen.getByRole('button', {
      name: /advanced settings/i,
    });
    expect(advButton).toHaveAttribute('aria-expanded', 'false');
    expect(
      screen.queryByText(/play chords behind answer voice/i),
    ).not.toBeInTheDocument();

    // Core defaults
    expect(screen.getByText('80 BPM')).toBeInTheDocument();
    expect(screen.getByText('1.5s per chord')).toBeInTheDocument();

    // Basic triads pressed
    expect(
      screen.getByRole('button', { name: /triad I \(one\)/i }),
    ).toHaveAttribute('aria-pressed', 'true');
    expect(
      screen.getByRole('button', { name: /triad ii \(two minor\)/i }),
    ).toHaveAttribute('aria-pressed', 'false');
    expect(
      screen.getByRole('button', { name: /seventh Imaj7/i }),
    ).toHaveAttribute('aria-pressed', 'false');
  });

  it('toggles chords, applies quick-select presets, and prevents deselecting the final chord', async () => {
    const user = userEvent.setup();
    render(<App />);

    // Select All Sevenths preset
    await user.click(screen.getByRole('button', { name: 'All Sevenths' }));
    expect(screen.getByText('7 active')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /seventh viiø7/i }),
    ).toHaveAttribute('aria-pressed', 'true');

    // Toggle one chord off and check count drops to 6
    await user.click(screen.getByRole('button', { name: /seventh ii7/i }));
    expect(screen.getByText('6 active')).toBeInTheDocument();

    // Keep removing until only 1 chord remains
    for (const label of [
      /seventh Imaj7/i,
      /seventh iii7/i,
      /seventh IVmaj7/i,
      /seventh V7/i,
      /seventh vi7/i,
    ]) {
      await user.click(screen.getByRole('button', { name: label }));
    }
    expect(screen.getByText('1 active')).toBeInTheDocument();

    // Attempting to deselect the final chord keeps it active & shows warning
    await user.click(screen.getByRole('button', { name: /seventh viiø7/i }));
    expect(screen.getByText('1 active')).toBeInTheDocument();
    expect(
      screen.getByText(/keep at least one chord active/i),
    ).toBeInTheDocument();
  });

  it('expands Advanced Settings, toggles viiø7 naming, and persists to localStorage', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(
      screen.getByRole('button', { name: /advanced settings/i }),
    );
    expect(
      screen.getByText(/play chords behind answer voice/i),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Seven half diminished/i),
    ).toBeInTheDocument();

    // Switch to Minor 7b5 naming
    await user.click(screen.getByRole('button', { name: 'Minor 7♭5' }));
    expect(
      screen.getByText(/Seven minor seven flat five/i),
    ).toBeInTheDocument();

    // Verify all 6 instruments and 3 space modes render with Felt Piano + Warm Room default
    expect(
      screen.getByRole('button', { name: /felt piano/i }),
    ).toHaveAttribute('aria-pressed', 'true');
    expect(
      screen.getByRole('button', { name: /warm rhodes/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /velvet pad/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /soft vibes/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /electric piano/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /warm room/i }),
    ).toHaveAttribute('aria-pressed', 'true');

    // Switch to Soft Pad & Lush Hall, enable Drone, pick scale tone 5, and verify mix sliders exist
    await user.click(screen.getByRole('button', { name: /soft pad/i }));
    await user.click(screen.getByRole('button', { name: /lush hall/i }));
    expect(screen.getByLabelText(/chords volume/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/voice volume/i)).toBeInTheDocument();
    expect(screen.queryByText(/fixed pitch/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/chromatic drone/i)).not.toBeInTheDocument();

    await user.click(screen.getByRole('switch', { name: /^enable drone$/i }));
    await user.click(screen.getByRole('button', { name: 'Scale tone 5' }));

    // Default Key mode is Auto-rotate
    expect(
      screen.getByRole('button', { name: /auto-rotate/i }),
    ).toHaveAttribute('aria-pressed', 'true');

    // Default Voice source is Built-in (Pocket); switching to Browser TTS reveals Voice dropdown
    expect(
      screen.getByRole('button', { name: /built-in \(pocket\)/i }),
    ).toHaveAttribute('aria-pressed', 'true');
    expect(
      screen.queryByLabelText(/^voice$/i),
    ).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /browser tts/i }));
    expect(screen.getByLabelText(/^voice$/i)).toBeInTheDocument();

    const saved = JSON.parse(
      window.localStorage.getItem(SETTINGS_STORAGE_KEY) || '{}',
    );
    expect(saved.halfDimNaming).toBe('minor-seven-flat-five');
    expect(saved.timbre).toBe('soft-pad');
    expect(saved.ambience).toBe('lush-hall');
    expect(saved.droneEnabled).toBe(true);
    expect(saved.droneScaleDegree).toBe(5);
    expect(saved.keyMode).toBe('auto-rotate');
    expect(saved.chordVolume).toBe(0.75);
    expect(saved.voiceVolume).toBe(0.65);
    expect(saved.droneVolume).toBe(0.5);
    expect(saved.voiceSource).toBe('speech-synthesis');
  });
});
