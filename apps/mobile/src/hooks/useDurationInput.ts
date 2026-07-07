import { useState } from 'react';
import { formatHoursDisplay, parseHoursInput } from '../utils/timeUtils';

const HOUR_STEP = 1;
const STEPPER_MIN_HOURS = 1;
const STEPPER_MAX_HOURS = 16;

export function useDurationInput(initialHours: number) {
  const [hoursInput, setHoursInput] = useState(formatHoursDisplay(initialHours));

  const parsedHours = parseHoursInput(hoursInput);
  const canSave = parsedHours !== null;

  function clampStepperHours(value: number): number {
    return Math.min(
      STEPPER_MAX_HOURS,
      Math.max(STEPPER_MIN_HOURS, Math.round(value)),
    );
  }

  function setHoursFromStepper(value: number) {
    setHoursInput(formatHoursDisplay(clampStepperHours(value)));
  }

  function setHoursPreset(value: number) {
    setHoursInput(formatHoursDisplay(value));
  }

  function adjustHours(delta: number) {
    const current = parsedHours ?? initialHours;
    setHoursFromStepper(current + delta);
  }

  return {
    hoursInput,
    setHoursInput,
    parsedHours,
    canSave,
    hourStep: HOUR_STEP,
    adjustHours,
    setHoursPreset,
  };
}
