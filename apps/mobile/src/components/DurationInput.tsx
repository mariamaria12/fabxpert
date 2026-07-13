import { DURATION_MINUTE_PRESETS } from '../utils/timeUtils';
import type { DurationMinutePreset } from '../utils/timeUtils';

const HOUR_PRESETS = [2, 4, 6, 8] as const;

interface DurationInputProps {
  hoursInput: string;
  selectedMinutes: DurationMinutePreset;
  activeHourPreset: number | null;
  hourStep: number;
  onHoursInputChange: (value: string) => void;
  onAdjustHours: (delta: number) => void;
  onHourPreset: (hours: number) => void;
  onMinutePreset: (minutes: DurationMinutePreset) => void;
}

export function DurationInput({
  hoursInput,
  selectedMinutes,
  activeHourPreset,
  hourStep,
  onHoursInputChange,
  onAdjustHours,
  onHourPreset,
  onMinutePreset,
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
          <span className="hours-input-label">Durată</span>
          <input
            type="text"
            inputMode="text"
            className="hours-input"
            placeholder="0h"
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
            className={`hours-preset-button${activeHourPreset === preset ? ' hours-preset-button-active' : ''}`}
            onClick={() => onHourPreset(preset)}
          >
            {preset}h
          </button>
        ))}
      </div>

      <div className="minutes-presets" role="group" aria-label="Minute">
        {DURATION_MINUTE_PRESETS.map((preset) => (
          <button
            key={preset}
            type="button"
            className={`hours-preset-button minutes-preset-button${selectedMinutes === preset ? ' hours-preset-button-active' : ''}`}
            onClick={() => onMinutePreset(preset)}
          >
            {preset}m
          </button>
        ))}
      </div>
    </div>
  );
}
