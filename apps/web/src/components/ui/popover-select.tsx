"use client";

import * as React from "react";
import { ChevronDownIcon, CheckIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";

interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
  flag?: React.ReactNode;
}

interface PopoverSelectProps {
  options: SelectOption[];
  value?: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  triggerClassName?: string;
  contentClassName?: string;
  searchPlaceholder?: string;
  searchable?: boolean;
  emptyMessage?: string;
  showFlags?: boolean;
  children?: React.ReactNode;
}

function PopoverSelect({
  options,
  value,
  onChange,
  placeholder = "Select...",
  disabled = false,
  className,
  triggerClassName,
  contentClassName,
  searchPlaceholder = "Search...",
  searchable = true,
  emptyMessage = "No items found.",
  showFlags = false,
  children,
}: PopoverSelectProps) {
  const [open, setOpen] = React.useState(false);
  const [searchQuery, setSearchQuery] = React.useState("");

  const selectedOption = options.find((option) => option.value === value);

  const filteredOptions = React.useMemo(() => {
    if (!searchable || !searchQuery) return options;
    return options.filter((option) =>
      option.label.toLowerCase().includes(searchQuery.toLowerCase()),
    );
  }, [options, searchQuery, searchable]);

  const handleSelect = React.useCallback(
    (optionValue: string) => {
      onChange(optionValue);
      setOpen(false);
      setSearchQuery("");
    },
    [onChange],
  );

  const handleOpenChange = React.useCallback((newOpen: boolean) => {
    setOpen(newOpen);
    if (!newOpen) {
      setSearchQuery("");
    }
  }, []);

  const trigger = children || (
    <button
      type="button"
      disabled={disabled}
      className={cn(
        "flex h-9 w-full items-center justify-between gap-2 rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm",
        "hover:bg-accent hover:text-accent-foreground",
        "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
        "disabled:cursor-not-allowed disabled:opacity-50",
        !value && "text-muted-foreground",
        triggerClassName,
      )}
    >
      {selectedOption?.flag && showFlags && (
        <span className="flex shrink-0 items-center">
          {selectedOption.flag}
        </span>
      )}
      <span className="flex-1 truncate text-left">
        {selectedOption?.label || placeholder}
      </span>
      <ChevronDownIcon className="size-4 shrink-0 opacity-50" />
    </button>
  );

  return (
    <Popover open={open} onOpenChange={handleOpenChange} modal>
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent
        className={cn("w-[var(--radix-popover-trigger-width)] p-0", className)}
        align="start"
        sideOffset={4}
      >
        <div className={cn("flex flex-col", contentClassName)}>
          {searchable && (
            <div className="border-b p-2">
              <Input
                placeholder={searchPlaceholder}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-9"
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="off"
                spellCheck="false"
              />
            </div>
          )}
          <ScrollArea className="h-[50vh] max-h-[300px]">
            {filteredOptions.length === 0 ? (
              <div className="p-4 text-center text-sm text-muted-foreground">
                {emptyMessage}
              </div>
            ) : (
              <div className="p-1">
                {filteredOptions.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    disabled={option.disabled}
                    onClick={() => handleSelect(option.value)}
                    className={cn(
                      "relative flex w-full cursor-pointer select-none items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none transition-colors",
                      "hover:bg-accent hover:text-accent-foreground",
                      "focus:bg-accent focus:text-accent-foreground",
                      option.disabled && "pointer-events-none opacity-50",
                      value === option.value &&
                        "bg-accent text-accent-foreground",
                    )}
                  >
                    {option.flag && showFlags && (
                      <span className="flex shrink-0 items-center">
                        {option.flag}
                      </span>
                    )}
                    <span className="flex-1 truncate text-left">
                      {option.label}
                    </span>
                    {value === option.value && (
                      <CheckIcon className="size-4 shrink-0" />
                    )}
                  </button>
                ))}
              </div>
            )}
          </ScrollArea>
        </div>
      </PopoverContent>
    </Popover>
  );
}

export { PopoverSelect };
export type { PopoverSelectProps, SelectOption };
