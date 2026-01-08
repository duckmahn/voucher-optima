"use client";

import * as React from "react";
import { Input } from "@/components/ui/input";
import { formatVND } from "@/lib/utils";

interface MoneyInputProps
  extends Omit<
    React.InputHTMLAttributes<HTMLInputElement>,
    "onChange" | "value"
  > {
  value: number;
  onChange: (value: number) => void;
}

export function MoneyInput({
  value,
  onChange,
  className,
  ...props
}: MoneyInputProps) {
  const [displayValue, setDisplayValue] = React.useState("");
  const [isFocused, setIsFocused] = React.useState(false);

  React.useEffect(() => {
    if (isFocused) return;
    if (value === 0 && displayValue === "") return; // Don't show 0 initially if empty desired
    setDisplayValue(formatVND(value));
  }, [value, isFocused]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const inputValue = e.target.value;

    // Allow digits only for raw input
    const numericValue = inputValue.replace(/[^0-9]/g, "");
    setDisplayValue(numericValue);

    const number = parseInt(numericValue, 10);
    onChange(isNaN(number) ? 0 : number);
  };

  const handleFocus = () => {
    setIsFocused(true);
    setDisplayValue(value === 0 ? "" : value.toString());
  };

  const handleBlur = () => {
    setIsFocused(false);
    setDisplayValue(formatVND(value));
  };

  return (
    <Input
      {...props}
      type="text"
      inputMode="numeric"
      value={displayValue}
      onChange={handleChange}
      onFocus={handleFocus}
      onBlur={handleBlur}
      className={className}
    />
  );
}
