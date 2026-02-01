import * as React from "react";
import { CheckIcon, ChevronsUpDown, Search, X } from "lucide-react";
import * as RPNInput from "react-phone-number-input";
import flags from "react-phone-number-input/flags";

import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Drawer, DrawerContent, DrawerTrigger } from "@/components/ui/drawer";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";

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
          className={cn("flex", className)}
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
    className={cn("rounded-e-lg rounded-s-none", className)}
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

type CountrySelectContentProps = {
  searchValue: string;
  setSearchValue: (value: string) => void;
  scrollAreaRef: React.RefObject<HTMLDivElement | null>;
  countryList: CountryEntry[];
  selectedCountry: RPNInput.Country;
  onChange: (country: RPNInput.Country) => void;
  onSelectComplete: () => void;
  isMobile?: boolean;
};

const CountrySelectContent = ({
  searchValue,
  setSearchValue,
  scrollAreaRef,
  countryList,
  selectedCountry,
  onChange,
  onSelectComplete,
  isMobile = false,
}: CountrySelectContentProps) => {
  const handleSearchChange = (value: string) => {
    setSearchValue(value);
    setTimeout(() => {
      if (scrollAreaRef.current) {
        const viewportElement = scrollAreaRef.current.querySelector(
          "[data-radix-scroll-area-viewport]",
        );
        if (viewportElement) {
          viewportElement.scrollTop = 0;
        }
      }
    }, 0);
  };

  // Filter countries for mobile mode (Command component handles this automatically for desktop)
  const filteredCountryList = isMobile
    ? countryList.filter((entry) =>
        entry.label?.toLowerCase().includes(searchValue.toLowerCase()),
      )
    : countryList;

  return (
    <Command className="w-full">
      {isMobile ? (
        <div className="relative mb-2">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground pointer-events-none" />
          <input
            type="text"
            value={searchValue}
            onChange={(e) => handleSearchChange(e.target.value)}
            placeholder="Search"
            className="w-full h-11 pl-10 pr-4 text-base rounded-xl border-0 bg-muted focus:outline-none focus:ring-0"
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck="false"
          />
        </div>
      ) : (
        <CommandInput
          value={searchValue}
          onValueChange={handleSearchChange}
          placeholder="Search country..."
          className="h-12 text-base sm:text-sm"
        />
      )}
      <CommandList className="max-h-none overflow-hidden">
        <ScrollArea ref={scrollAreaRef} className="h-[50vh] sm:h-72">
          <CommandEmpty className="py-6 text-center text-sm">
            No country found.
          </CommandEmpty>
          <CommandGroup className="px-1">
            {filteredCountryList.map(({ value, label }) =>
              value ? (
                <CountrySelectOption
                  key={value}
                  country={value}
                  countryName={label}
                  selectedCountry={selectedCountry}
                  onChange={onChange}
                  onSelectComplete={onSelectComplete}
                />
              ) : null,
            )}
          </CommandGroup>
        </ScrollArea>
      </CommandList>
    </Command>
  );
};

const CountrySelect = ({
  disabled,
  value: selectedCountry,
  options: countryList,
  onChange,
}: CountrySelectProps) => {
  const scrollAreaRef = React.useRef<HTMLDivElement>(null);
  const [searchValue, setSearchValue] = React.useState("");
  const [isOpen, setIsOpen] = React.useState(false);
  const isMobile = useIsMobile();

  const triggerButton = (
    <Button
      type="button"
      variant="outline"
      className="flex items-center gap-1.5 rounded-e-none rounded-s-lg border-r-0 px-3 focus:z-10"
      disabled={disabled}
    >
      <FlagComponent country={selectedCountry} countryName={selectedCountry} />
      <ChevronsUpDown
        className={cn(
          "-mr-2 size-4 opacity-50",
          disabled ? "hidden" : "opacity-100",
        )}
      />
    </Button>
  );

  const handleOpenChange = (open: boolean) => {
    setIsOpen(open);
    if (open) setSearchValue("");
  };

  const handleSelectComplete = () => setIsOpen(false);

  if (isMobile) {
    return (
      <Drawer open={isOpen} onOpenChange={handleOpenChange}>
        <DrawerTrigger asChild>{triggerButton}</DrawerTrigger>
        <DrawerContent className="max-h-[85vh] px-0">
          <div className="flex flex-col">
            <div className="relative px-4 py-3 flex items-center justify-center">
              <h2 className="text-base font-semibold">Select Country</h2>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="absolute right-4 p-1.5 rounded-full hover:bg-muted transition-colors"
                aria-label="Close"
              >
                <X className="h-5 w-5 text-muted-foreground" />
              </button>
            </div>
            <div className="px-4 py-2">
              <CountrySelectContent
                searchValue={searchValue}
                setSearchValue={setSearchValue}
                scrollAreaRef={scrollAreaRef}
                countryList={countryList}
                selectedCountry={selectedCountry}
                onChange={onChange}
                onSelectComplete={handleSelectComplete}
                isMobile
              />
            </div>
          </div>
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Popover open={isOpen} modal onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>{triggerButton}</PopoverTrigger>
      <PopoverContent className="w-[300px] p-0">
        <CountrySelectContent
          searchValue={searchValue}
          setSearchValue={setSearchValue}
          scrollAreaRef={scrollAreaRef}
          countryList={countryList}
          selectedCountry={selectedCountry}
          onChange={onChange}
          onSelectComplete={handleSelectComplete}
        />
      </PopoverContent>
    </Popover>
  );
};

interface CountrySelectOptionProps extends RPNInput.FlagProps {
  selectedCountry: RPNInput.Country;
  onChange: (country: RPNInput.Country) => void;
  onSelectComplete: () => void;
}

const CountrySelectOption = ({
  country,
  countryName,
  selectedCountry,
  onChange,
  onSelectComplete,
}: CountrySelectOptionProps) => {
  const handleSelect = () => {
    onChange(country);
    onSelectComplete();
  };

  return (
    <CommandItem className="gap-2" onSelect={handleSelect}>
      <FlagComponent country={country} countryName={countryName} />
      <span className="flex-1 text-sm">{countryName}</span>
      <span className="text-sm text-foreground/50">{`+${RPNInput.getCountryCallingCode(country)}`}</span>
      <CheckIcon
        className={`ml-auto size-4 ${country === selectedCountry ? "opacity-100" : "opacity-0"}`}
      />
    </CommandItem>
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
