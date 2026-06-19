import * as React from 'react'
import { ChevronDownIcon } from 'lucide-react'
import * as RPNInput from 'react-phone-number-input'
import flags from 'react-phone-number-input/flags'

import { Input } from '@/components/ui/input'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
import { cn } from '@/lib/utils'

type PhoneInputProps = Omit<React.ComponentProps<'input'>, 'onChange' | 'value' | 'ref'> &
  Omit<RPNInput.Props<typeof RPNInput.default>, 'onChange'> & {
    onChange?: (value: RPNInput.Value) => void
  }

const PhoneInput: React.ForwardRefExoticComponent<PhoneInputProps> = React.forwardRef<
  React.ElementRef<typeof RPNInput.default>,
  PhoneInputProps
>(({ className, onChange, value, ...props }, ref) => {
  return (
    <RPNInput.default
      ref={ref}
      className={cn('flex items-stretch', className)}
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
      onChange={(value) => onChange?.(value || ('' as RPNInput.Value))}
      {...props}
    />
  )
})
PhoneInput.displayName = 'PhoneInput'

const InputComponent = React.forwardRef<HTMLInputElement, React.ComponentProps<'input'>>(
  ({ className, ...props }, ref) => (
    <Input
      className={cn('h-full min-h-9 self-stretch rounded-e-xl rounded-s-none', className)}
      {...props}
      ref={ref}
    />
  ),
)
InputComponent.displayName = 'InputComponent'

type CountryEntry = { label: string; value: RPNInput.Country | undefined; divider?: boolean }

type CountrySelectProps = {
  disabled?: boolean
  value: RPNInput.Country
  options: CountryEntry[]
  onChange: (country: RPNInput.Country) => void
  onFocus?: React.FocusEventHandler<HTMLSelectElement>
  onBlur?: React.FocusEventHandler<HTMLSelectElement>
}

const CountrySelect = ({
  disabled,
  value: selectedCountry,
  options: countryList,
  onChange,
  onFocus,
  onBlur,
}: CountrySelectProps) => {
  const countryOptions = React.useMemo(
    () =>
      countryList.filter(
        (entry): entry is { label: string; value: RPNInput.Country } => Boolean(entry.value),
      ),
    [countryList],
  )

  return (
    <div className="relative flex min-h-9 shrink-0 self-stretch">
      <div
        aria-hidden="true"
        className={cn(
          'pointer-events-none flex h-full min-h-9 items-center gap-1.5 rounded-e-none rounded-s-xl border border-r-0 px-3',
          'border-input bg-background text-foreground',
        )}
      >
        <FlagComponent country={selectedCountry} countryName={selectedCountry} />
        <ChevronDownIcon className="size-4 shrink-0 opacity-50" />
      </div>
      <div className="absolute inset-0 opacity-0">
        <NativeSelect
          value={selectedCountry}
          onChange={(event) => onChange(event.target.value as RPNInput.Country)}
          onFocus={onFocus}
          onBlur={onBlur}
          disabled={disabled}
          aria-label="Country code"
          className="size-full min-h-9 cursor-pointer rounded-e-none rounded-s-xl border-r-0"
        >
          {countryOptions.map((entry) => (
            <NativeSelectOption key={entry.value} value={entry.value}>
              {entry.label} (+{RPNInput.getCountryCallingCode(entry.value)})
            </NativeSelectOption>
          ))}
        </NativeSelect>
      </div>
    </div>
  )
}

const FlagComponent = ({ country, countryName }: RPNInput.FlagProps) => {
  const Flag = flags[country]

  return (
    <span className="flex h-4 w-6 overflow-hidden rounded-sm bg-foreground/20 [&_svg:not([class*='size-'])]:size-full">
      {Flag && <Flag title={countryName} />}
    </span>
  )
}

export { PhoneInput }
