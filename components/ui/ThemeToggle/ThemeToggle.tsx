"use client";

import { useEffect, useState } from "react";
import { applyTheme, readTheme, writeTheme, type ThemePreference } from "@/lib/theme";
import { MonitorIcon, MoonIcon, SunIcon } from "../icons";
import { SegmentedControl } from "../SegmentedControl/SegmentedControl";

const options = [
  { value: "light" as const, label: <SunIcon />, ariaLabel: "Light theme" },
  { value: "system" as const, label: <MonitorIcon />, ariaLabel: "Use system theme" },
  { value: "dark" as const, label: <MoonIcon />, ariaLabel: "Dark theme" },
];

function storage(): Storage | undefined {
  try {
    return window.localStorage;
  } catch {
    return undefined;
  }
}

/** Light / system / dark switch. Persists the choice and sets data-theme on <html>. */
export function ThemeToggle({ className }: { className?: string }) {
  const [theme, setTheme] = useState<ThemePreference>("system");

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- read browser storage after mount
    setTheme(readTheme(storage()));
  }, []);

  const change = (next: ThemePreference) => {
    setTheme(next);
    writeTheme(storage(), next);
    applyTheme(document.documentElement, next);
  };

  return (
    <SegmentedControl
      aria-label="Colour theme"
      size="sm"
      options={options}
      value={theme}
      onChange={change}
      className={className}
    />
  );
}
