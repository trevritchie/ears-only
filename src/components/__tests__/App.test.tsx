import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import App from '../../App';
import { SETTINGS_STORAGE_KEY } from '../../types/settings';

describe('Ears Only App UI', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('renders primary controls (Key, Sound, Space, Mix, Drone switch) outside collapsed Advanced Settings', () => {
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

    // Core defaults visible on primary screen
    expect(screen.getByText('80 BPM')).toBeInTheDocument();
    expect(screen.getByText('1.5s per chord')).toBeInTheDocument();

    // Key mode visible in primary controls: Auto-rotate on the left (default), Fixed key on right
    const keyModeGroup = screen.getByRole('group', { name: /key mode/i });
    const keyModeButtons = within(keyModeGroup).getAllByRole('button');
    expect(keyModeButtons.map((b) => b.textContent)).toEqual([
      'Auto-rotate',
      'Fixed key',
    ]);
    expect(keyModeButtons[0]).toHaveAttribute('aria-pressed', 'true');
    expect(keyModeButtons[1]).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByLabelText(/rotate key every/i)).toBeInTheDocument();

    // Sound, Space, Chords volume, Voice volume, and Drone switch visible outside Advanced
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
    expect(screen.getByLabelText(/chords volume/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/voice volume/i)).toBeInTheDocument();

    // Progressive Drone: switch visible, sub-controls hidden while OFF
    expect(
      screen.getByRole('switch', { name: /^enable drone$/i }),
    ).toHaveAttribute('aria-checked', 'false');
    expect(screen.queryByLabelText(/drone volume/i)).not.toBeInTheDocument();
    expect(screen.queryByRole('group', { name: /drone scale tone/i })).not.toBeInTheDocument();

    // Basic triads pressed & triad quality toggle defaults to OFF inside Allowed chords
    expect(
      screen.getByRole('button', { name: /triad I \(one major\)/i }),
    ).toHaveAttribute('aria-pressed', 'true');
    expect(
      screen.getByRole('button', { name: /triad ii \(two minor\)/i }),
    ).toHaveAttribute('aria-pressed', 'false');
    expect(
      screen.getByRole('button', { name: /seventh Imaj7/i }),
    ).toHaveAttribute('aria-pressed', 'false');
    expect(
      screen.getByRole('switch', { name: /speak triad qualities/i }),
    ).toHaveAttribute('aria-checked', 'false');
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

  it('updates primary Sound, Key, Drone, and Advanced Settings and persists to localStorage', async () => {
    const user = userEvent.setup();
    render(<App />);

    // Toggle Speak triad qualities right inside Allowed chords
    await user.click(
      screen.getByRole('switch', { name: /speak triad qualities/i }),
    );
    expect(
      screen.getByRole('switch', { name: /speak triad qualities/i }),
    ).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByText(/one major, two minor/i)).toBeInTheDocument();

    // Switch Key mode to Fixed key right on primary screen and pick G Major
    await user.click(screen.getByRole('button', { name: /fixed key/i }));
    await user.click(screen.getByRole('button', { name: 'G Major' }));
    expect(screen.getByText('G Major')).toBeInTheDocument();

    // Switch back to Auto-rotate
    await user.click(screen.getByRole('button', { name: /auto-rotate/i }));

    // Primary Sound & Mix interactions (no need to expand Advanced!)
    await user.click(screen.getByRole('button', { name: /soft pad/i }));
    await user.click(screen.getByRole('button', { name: /lush hall/i }));
    await user.click(screen.getByRole('switch', { name: /^enable drone$/i }));

    // Drone sub-controls now expanded right in place
    expect(screen.getByLabelText(/drone volume/i)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Scale tone 5' }));
    await user.click(screen.getByRole('button', { name: 'High (+2)' }));

    // Expand streamlined Advanced Settings
    await user.click(
      screen.getByRole('button', { name: /advanced settings/i }),
    );
    expect(
      screen.getByText(/play chords behind answer voice/i),
    ).toBeInTheDocument();
    expect(screen.getByText(/Seven half diminished/i)).toBeInTheDocument();

    // Switch to Minor 7b5 naming & Browser TTS
    await user.click(screen.getByRole('button', { name: 'Minor 7♭5' }));
    expect(
      screen.getByText(/Seven minor seven flat five/i),
    ).toBeInTheDocument();

    expect(
      screen.getByRole('button', { name: /built-in \(pocket\)/i }),
    ).toHaveAttribute('aria-pressed', 'true');
    expect(screen.queryByLabelText(/^voice$/i)).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /browser tts/i }));
    expect(screen.getByLabelText(/^voice$/i)).toBeInTheDocument();

    const saved = JSON.parse(
      window.localStorage.getItem(SETTINGS_STORAGE_KEY) || '{}',
    );
    expect(saved.announceTriadQuality).toBe(true);
    expect(saved.halfDimNaming).toBe('minor-seven-flat-five');
    expect(saved.timbre).toBe('soft-pad');
    expect(saved.ambience).toBe('lush-hall');
    expect(saved.droneEnabled).toBe(true);
    expect(saved.droneScaleDegree).toBe(5);
    expect(saved.droneOctave).toBe(2);
    expect(saved.keyMode).toBe('auto-rotate');
    expect(saved.fixedKey).toBe(7);
    expect(saved.chordVolume).toBe(0.75);
    expect(saved.voiceVolume).toBe(0.65);
    expect(saved.droneVolume).toBe(0.5);
    expect(saved.voiceSource).toBe('speech-synthesis');
  });
});
