import { useState } from "react";
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxLabel,
  ComboboxList,
  ComboboxTrigger,
} from "@ui-sdk/react/combobox";
import { timeZones } from "@/lib/timeZone.ts";

export function TimeZoneCombobox({
  value,
  onChange,
  disabled,
}: {
  value: string;
  onChange: (zone: string) => void;
  disabled?: boolean;
}) {
  // Built once from the first value, which stays listed even if this browser doesn't know it.
  const [items] = useState(() => timeZones(value).map((zone) => ({ value: zone, label: zone.replaceAll("_", " ") })));

  return (
    <Combobox
      items={items}
      value={value}
      onValueChange={(zone) => zone && onChange(zone)}
      disabled={disabled}
      autoHighlight
    >
      <div className="flex flex-col gap-1.5">
        <ComboboxLabel>Time zone</ComboboxLabel>
        <div>
          <ComboboxInput />
          <ComboboxTrigger aria-label="Show time zones" />
        </div>
      </div>
      <ComboboxContent>
        <ComboboxEmpty>No time zone matches.</ComboboxEmpty>
        <ComboboxList />
      </ComboboxContent>
    </Combobox>
  );
}
