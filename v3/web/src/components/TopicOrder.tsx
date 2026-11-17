import { NumberInput, NumberInputControl, NumberInputGroup } from "@ui-sdk/react/number-input";
import { Radio, RadioGroup, RadioIndicator } from "@ui-sdk/react/radio";

const orders = [
  { value: "all", label: "All at once, like a photo marathon" },
  { value: "sequence", label: "One at a time, the next after the previous is done" },
] as const;

export function TopicOrderRadio({
  labelledBy,
  inSequence,
  onChange,
  disabled,
}: {
  labelledBy: string;
  inSequence: boolean;
  onChange: (inSequence: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <RadioGroup
      aria-labelledby={labelledBy}
      value={inSequence ? "sequence" : "all"}
      onValueChange={(value) => onChange(value === "sequence")}
      disabled={disabled}
      className="flex flex-col gap-3"
    >
      {orders.map((order) => (
        <label key={order.value} data-slot="label" className="flex items-center gap-2">
          <Radio value={order.value}>
            <RadioIndicator />
          </Radio>
          {order.label}
        </label>
      ))}
    </RadioGroup>
  );
}

export function MinutesInput({
  labelledBy,
  value,
  onChange,
  disabled,
}: {
  labelledBy: string;
  value: number | null;
  onChange: (minutes: number | null) => void;
  disabled?: boolean;
}) {
  return (
    <NumberInput value={value} onValueChange={onChange} min={1} max={1440} step={1} disabled={disabled}>
      <NumberInputGroup className="w-32">
        <NumberInputControl aria-labelledby={labelledBy} placeholder="No limit" />
      </NumberInputGroup>
    </NumberInput>
  );
}
