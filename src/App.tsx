import { AdvancedSettings } from './components/AdvancedSettings';
import { ChordSelector } from './components/ChordSelector';
import { CoreControls } from './components/CoreControls';
import { PocketStage } from './components/PocketStage';
import { TransportBar } from './components/TransportBar';
import { useEarTrainer } from './hooks/useEarTrainer';

export function App() {
  const {
    settings,
    updateSettings,
    snapshot,
    voices,
    start,
    stop,
    replayQuestion,
    skipToAnswer,
  } = useEarTrainer();

  return (
    <main className="mx-auto min-h-dvh w-full max-w-[460px] px-4 pb-12 pt-4">
      <PocketStage snapshot={snapshot} settings={settings} />

      <TransportBar
        isRunning={snapshot.isRunning}
        phase={snapshot.phase}
        hasProgression={snapshot.progression.length > 0}
        onStart={start}
        onStop={stop}
        onReplay={replayQuestion}
        onSkip={skipToAnswer}
      />

      <ChordSelector
        allowedChords={settings.allowedChords}
        onChange={(allowedChords) => updateSettings({ allowedChords })}
      />

      <CoreControls settings={settings} onUpdate={updateSettings} />

      <AdvancedSettings
        settings={settings}
        activeKey={snapshot.activeKey}
        isRunning={snapshot.isRunning}
        voices={voices}
        onUpdate={updateSettings}
      />
    </main>
  );
}

export default App;
