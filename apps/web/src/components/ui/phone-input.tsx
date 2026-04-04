import * as React from "react";
import * as RPNInput from "react-phone-number-input";
import flags from "react-phone-number-input/flags";

import { Input } from "@/components/ui/input";
import { PopoverSelect, SelectOption } from "@/components/ui/popover-select";
import { cn } from "@/lib/utils";

type PhoneInputProps = Omit<
  React.ComponentProps<"input">,
  "onChange" | "value" | "ref"
> &
  Omit<RPNInput.Props<typeof RPNInput.default>, "onChange"> & {
    onChange?: (value: RPNInput.Value) => void;
  };

const PhoneInput: React.ForwardRefExoticComponent<PhoneInputProps> =
  React.forwardRef<React.ElementRef<typeof RPNInput.default>, PhoneInputProps>(
    ({ className, onChange, value, ...props }, ref) => {
      return (
        <RPNInput.default
          ref={ref}
          className={cn("flex items-stretch", className)}
          flagComponent={FlagComponent}
          countrySelectComponent={CountrySelect}
          inputComponent={InputComponent}
          smartCaret={false}
          value={value || undefined}
          /**
           * Handles the onChange event.
           *
           * react-phone-number-input might trigger the onChange event as undefined
           * when a valid phone number is not entered. To prevent this,
           * the value is coerced to an empty string.
           *
           * @param {E164Number | undefined} value - The entered value
           */
          onChange={(value) => onChange?.(value || ("" as RPNInput.Value))}
          {...props}
        />
      );
    },
  );
PhoneInput.displayName = "PhoneInput";

const InputComponent = React.forwardRef<
  HTMLInputElement,
  React.ComponentProps<"input">
>(({ className, ...props }, ref) => (
  <Input
    className={cn(
      "h-full min-h-9 self-stretch rounded-e-xl rounded-s-none",
      className,
    )}
    {...props}
    ref={ref}
  />
));
InputComponent.displayName = "InputComponent";

type CountryEntry = { label: string; value: RPNInput.Country | undefined };

type CountrySelectProps = {
  disabled?: boolean;
  value: RPNInput.Country;
  options: CountryEntry[];
  onChange: (country: RPNInput.Country) => void;
};

const CountrySelect = ({
  disabled,
  value: selectedCountry,
  options: countryList,
  onChange,
}: CountrySelectProps) => {
  const selectOptions: SelectOption[] = React.useMemo(
    () =>
      countryList
        .filter((entry): entry is { label: string; value: RPNInput.Country } =>
          Boolean(entry.value),
        )
        .map((entry) => ({
          value: entry.value,
          label: `${entry.label} (+${RPNInput.getCountryCallingCode(entry.value)})`,
          flag: (
            <FlagComponent country={entry.value} countryName={entry.label} />
          ),
        })),
    [countryList],
  );

  return (
    <div className="flex min-h-9 items-stretch self-stretch [&_[data-slot=popover-trigger]]:h-full [&_[data-slot=popover-trigger]]:min-h-9">
      <PopoverSelect
        options={selectOptions}
        value={selectedCountry}
        onChange={(value) => onChange(value as RPNInput.Country)}
        disabled={disabled}
        searchable
        showFlags
        searchPlaceholder="Search country..."
        className="w-auto"
        triggerClassName="rounded-e-none rounded-s-xl border-r-0 px-3"
      >
        <button
          type="button"
          disabled={disabled}
          className={cn(
            "flex h-full min-h-9 items-center justify-center gap-2 rounded-e-none rounded-s-xl border border-r-0 px-3",
            "border-input bg-background hover:bg-accent hover:text-accent-foreground",
            "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
            "disabled:pointer-events-none disabled:opacity-50",
          )}
        >
          <FlagComponent
            country={selectedCountry}
            countryName={selectedCountry}
          />
        </button>
      </PopoverSelect>
    </div>
  );
};

const FlagComponent = ({ country, countryName }: RPNInput.FlagProps) => {
  const Flag = flags[country];

  return (
    <span className="flex h-4 w-6 overflow-hidden rounded-sm bg-foreground/20 [&_svg:not([class*='size-'])]:size-full">
      {Flag && <Flag title={countryName} />}
    </span>
  );
};

export { PhoneInput };
