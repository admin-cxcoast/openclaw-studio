"use client";

import { useState, useEffect, useCallback } from "react";
import { Eye, EyeOff } from "lucide-react";

interface SensitiveFieldProps {
  maskedValue: string;
  onReveal: () => Promise<string>;
}

export function SensitiveField({ maskedValue, onReveal }: SensitiveFieldProps) {
  const [revealed, setRevealed] = useState(false);
  const [value, setValue] = useState(maskedValue);

  useEffect(() => {
    if (!revealed) {
      setValue(maskedValue);
      return;
    }
    const timer = setTimeout(() => {
      setRevealed(false);
      setValue(maskedValue);
    }, 10_000);
    return () => clearTimeout(timer);
  }, [revealed, maskedValue]);

  const handleToggle = useCallback(async () => {
    if (revealed) {
      setRevealed(false);
      setValue(maskedValue);
    } else {
      const real = await onReveal();
      setValue(real);
      setRevealed(true);
    }
  }, [revealed, maskedValue, onReveal]);

  return (
    <span className="inline-flex items-center gap-1.5">
      <code className="font-mono text-xs">{value}</code>
      <button
        onClick={handleToggle}
        className="text-muted-foreground transition-colors hover:text-foreground"
        title={revealed ? "Hide" : "Reveal (auto-hides after 10s)"}
      >
        {revealed ? <EyeOff size={13} /> : <Eye size={13} />}
      </button>
    </span>
  );
}
