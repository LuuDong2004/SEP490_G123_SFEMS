"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { useTranslate } from "@refinedev/core";

import { useTheme } from "@/shared/components/theme/theme-provider";
import { Button } from "@/shared/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/shared/ui/tooltip";
import { cn } from "@/shared/lib/utils";
import type { ThemeMode } from "@/shared/lib/theme";

const NEXT_MODE: Record<ThemeMode, ThemeMode> = {
  light: "dark",
  dark: "system",
  system: "light",
};

const LABEL: Record<ThemeMode, { key: string; fallback: string }> = {
  light: { key: "theme.light", fallback: "Light" },
  dark: { key: "theme.dark", fallback: "Dark" },
  system: { key: "theme.system", fallback: "System" },
};

type ThemeToggleProps = {
  className?: string;
};

/**
 * Single-button mode cycle: light → dark → system → light.
 * The three icons are stacked and cross-faded so the button never reflows.
 */
export function ThemeToggle({ className }: ThemeToggleProps) {
  const { mode, setMode } = useTheme();
  const t = useTranslate();
  const modeLabel = t(LABEL[mode].key, LABEL[mode].fallback);
  const nextLabel = t(LABEL[NEXT_MODE[mode]].key, LABEL[NEXT_MODE[mode]].fallback);

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setMode(NEXT_MODE[mode])}
          aria-label={t("theme.switchTo", { mode: modeLabel, next: nextLabel }, `Theme: ${modeLabel}. Switch to ${nextLabel}.`)}
          className={cn(
            "relative size-9 rounded-lg text-muted-foreground",
            "hover:bg-accent hover:text-foreground",
            className
          )}
        >
          <ModeIcon icon={Sun} isActive={mode === "light"} />
          <ModeIcon icon={Moon} isActive={mode === "dark"} />
          <ModeIcon icon={Monitor} isActive={mode === "system"} />
        </Button>
      </TooltipTrigger>
      <TooltipContent side="bottom">{t("theme.label", { mode: modeLabel }, `Theme: ${modeLabel}`)}</TooltipContent>
    </Tooltip>
  );
}

function ModeIcon({
  icon: Icon,
  isActive,
}: {
  icon: typeof Sun;
  isActive: boolean;
}) {
  return (
    <Icon
      aria-hidden
      className={cn(
        "absolute size-[1.1rem] transition-all duration-200",
        isActive ? "rotate-0 scale-100 opacity-100" : "-rotate-90 scale-0 opacity-0"
      )}
    />
  );
}

ThemeToggle.displayName = "ThemeToggle";
