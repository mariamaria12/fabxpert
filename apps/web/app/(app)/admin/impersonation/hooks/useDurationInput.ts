import { useState } from 'react';
import {
  durationPartsFromTotalHours,
  formatDurationInputDisplay,
  getPresetMinutesFromInput,
  getWholeHoursFromInput,
  parseDurationInputParts,
  resolveDurationHours,
  type DurationMinutePreset,
} from '../utils/timeUtils';

const HOUR_STEP = 1;
const STEPPER_MIN_HOURS = 0;
const STEPPER_MAX_HOURS = 16;

export function useDurationInput(initialTotalHours: number) {
  const initialParts = durationPartsFromTotalHours(initialTotalHours);
  const [hoursInput, setHoursInput] = useState(
    formatDurationInputDisplay(initialParts.hours, initialParts.minutes),
  );
  const [selectedMinutes, setSelectedMinutes] = useState<DurationMinutePreset>(
    initialParts.minutes,
  );

  const parsedDurationHours = resolveDurationHours(hoursInput, selectedMinutes);
  const canSave = parsedDurationHours !== null;

  function syncInput(wholeHours: number, minutes: DurationMinutePreset) {
    setHoursInput(formatDurationInputDisplay(wholeHours, minutes));
  }

  function clampStepperHours(value: number): number {
    return Math.min(STEPPER_MAX_HOURS, Math.max(STEPPER_MIN_HOURS, Math.round(value)));
  }

  function setHoursPreset(value: number) {
    setSelectedMinutes(0);
    syncInput(value, 0);
  }

  function adjustHours(delta: number) {
    const current = getWholeHoursFromInput(hoursInput);
    syncInput(clampStepperHours(current + delta), selectedMinutes);
  }

  function handleHoursInputChange(value: string) {
    setHoursInput(value);
    setSelectedMinutes(getPresetMinutesFromInput(value));
  }

  function setMinutePreset(minutes: DurationMinutePreset) {
    const nextMinutes =
      minutes === 0 ? 0 : selectedMinutes === minutes ? 0 : minutes;
    const wholeHours = getWholeHoursFromInput(hoursInput);

    setSelectedMinutes(nextMinutes);
    syncInput(wholeHours, nextMinutes);
  }

  const parsedParts = parseDurationInputParts(hoursInput);
  const activeHourPreset =
    parsedParts && parsedParts.minutes === 0 ? parsedParts.hours : null;

  return {
    hoursInput,
    setHoursInput: handleHoursInputChange,
    selectedMinutes,
    parsedDurationHours,
    canSave,
    hourStep: HOUR_STEP,
    adjustHours,
    setHoursPreset,
    setMinutePreset,
    activeHourPreset,
  };
}
