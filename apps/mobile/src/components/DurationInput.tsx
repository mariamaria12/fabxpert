const HOUR_PRESETS = [2, 4, 6, 8] as const;

interface DurationInputProps {
  hoursInput: string;
  parsedHours: number | null;
  hourStep: number;
  onHoursInputChange: (value: string) => void;
  onAdjustHours: (delta: number) => void;
  onPreset: (hours: number) => void;
}

export function DurationInput({
  hoursInput,
  parsedHours,
  hourStep,
  onHoursInputChange,
  onAdjustHours,
  onPreset,
}: DurationInputProps) {
  return (
    <div className="hours-entry">
      <div className="hours-entry-control">
        <button
          type="button"
          className="hours-step-button"
          aria-label={`Scade ${hourStep} oră`}
          onClick={() => onAdjustHours(-hourStep)}
        >
          −
        </button>

        <label className="hours-input-wrap">
          <span className="hours-input-label">Ore</span>
          <input
            type="text"
            inputMode="decimal"
            className="hours-input"
            placeholder="0"
            value={hoursInput}
            onChange={(event) => onHoursInputChange(event.target.value)}
          />
        </label>

        <button
          type="button"
          className="hours-step-button"
          aria-label={`Adaugă ${hourStep} oră`}
          onClick={() => onAdjustHours(hourStep)}
        >
          +
        </button>
      </div>

      <div className="hours-presets" role="group" aria-label="Preset ore">
        {HOUR_PRESETS.map((preset) => (
          <button
            key={preset}
            type="button"
            className={`hours-preset-button${parsedHours === preset ? ' hours-preset-button-active' : ''}`}
            onClick={() => onPreset(preset)}
          >
            {preset}h
          </button>
        ))}
      </div>
    </div>
  );
}
