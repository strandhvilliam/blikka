import { useState } from "react";
import { DatePicker, DatePickerContent, DatePickerInput, DatePickerTrigger } from "@ui-sdk/react/date-picker";
import { FieldLegend, FieldSet } from "@ui-sdk/react/field";
import { TimeInput } from "@ui-sdk/react/time-input";

// A wall clock time like "2026-12-01T09:00" as a date picker and a time input. Choosing a date asks
// for a time too; clearing the date clears both.
export function WallClockInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const [date, setDate] = useState(value.slice(0, 10) || null);
  const [time, setTime] = useState(value.slice(11) || null);
  const emit = (date: string | null, time: string | null) => onChange(date && time ? `${date}T${time}` : "");

  return (
    <FieldSet>
      <FieldLegend>{label}</FieldLegend>
      <div className="flex flex-wrap gap-2">
        <DatePicker
          locale="en-GB"
          value={date}
          onValueChange={(next) => {
            // A single-date picker never reports a range.
            const day = Array.isArray(next) ? null : next;
            setDate(day);
            emit(day, time);
          }}
        >
          <div className="flex gap-1">
            <DatePickerInput aria-label={`${label}, date`} />
            <DatePickerTrigger aria-label={`Choose the ${label.toLowerCase()} date`} />
          </div>
          <DatePickerContent />
        </DatePicker>
        <TimeInput
          locale="en-GB"
          hourCycle={24}
          aria-label={`${label}, time`}
          required={date !== null}
          value={time}
          onValueChange={(next) => {
            setTime(next);
            emit(date, next);
          }}
        />
      </div>
    </FieldSet>
  );
}
