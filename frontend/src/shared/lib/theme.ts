/**
 * Theme state for the DTH shell.
 *
 * Five orthogonal settings live as state on `<html>`; `src/styles/theme.css`
 * derives every semantic colour and spacing token from them:
 *
 *   mode         -> `.dark` class          light | dark | system
 *   colorPreset  -> `data-color-preset`    navy | blue | …
 *   radius       -> `data-radius`          none | sm | md | lg | xl
 *   sidebarTone  -> `data-sidebar-tone`    dark | light
 *   density      -> `data-density`         compact | comfortable | spacious
 *
 * The same values are written to localStorage and replayed by the inline
 * bootstrap script in `index.html`, which runs before first paint so the shell
 * never flashes the wrong theme.
 *
 * Keep the storage keys and the preset key list in sync with that script.
 */

export type ThemeMode = "light" | "dark" | "system";
export type ResolvedMode = "light" | "dark";
export type ColorPreset =
  | "navy"
  | "blue"
  | "teal"
  | "slate"
  | "ocean"
  | "aurora"
  | "forest";
export type Radius = "none" | "sm" | "md" | "lg" | "xl";
export type SidebarTone = "dark" | "light";
export type Density = "compact" | "comfortable" | "spacious";

export const STORAGE_KEYS = {
  mode: "dth-ui-mode",
  colorPreset: "dth-ui-color",
  radius: "dth-ui-radius",
  sidebarTone: "dth-ui-sidebar-tone",
  density: "dth-ui-density",
} as const;

export const DEFAULTS = {
  // Sáng, không phải "system". Phần mềm này chạy ở phòng thiết bị và phòng
  // hành chính, nơi máy thường để nguyên thiết lập của Windows — và một máy
  // bật chế độ tối của hệ điều hành sẽ mở ứng dụng ra nền tối, khác hẳn cái
  // người bên cạnh đang nhìn. Bản in và ảnh chụp màn hình gửi lên Sở cũng
  // phải giống nhau giữa các trường. Ai muốn tối vẫn đổi được ở Tuỳ chỉnh,
  // và lựa chọn đó được nhớ lại.
  mode: "light" as ThemeMode,
  colorPreset: "ocean" as ColorPreset,
  radius: "md" as Radius,
  sidebarTone: "dark" as SidebarTone,
  density: "comfortable" as Density,
};

/**
 * Swatch metadata for the customizer.
 *
 * `light`/`dark` mirror the `--preset-l|c|h` triplets declared in
 * `styles/theme.css`, so a swatch always shows the colour the preset will
 * actually produce. Change one, change the other.
 */
export const COLOR_PRESETS: Array<{
  key: ColorPreset;
  label: string;
  light: string;
  dark: string;
  /** Đầu kia của dải gradient — vắng là bộ màu phẳng (sắc liền kề +40°). */
  light2?: string;
  dark2?: string;
  gradient?: boolean;
}> = [
  { key: "ocean", label: "Đại dương", gradient: true, light: "oklch(0.5 0.17 250)", dark: "oklch(0.72 0.17 250)", light2: "oklch(0.52 0.17 195)", dark2: "oklch(0.75 0.17 195)" },
  { key: "aurora", label: "Cực quang", gradient: true, light: "oklch(0.47 0.18 272)", dark: "oklch(0.72 0.17 272)", light2: "oklch(0.49 0.18 205)", dark2: "oklch(0.75 0.17 205)" },
  { key: "forest", label: "Rừng xanh", gradient: true, light: "oklch(0.47 0.15 160)", dark: "oklch(0.73 0.16 160)", light2: "oklch(0.49 0.15 205)", dark2: "oklch(0.76 0.16 205)" },

  { key: "navy", label: "Xanh navy", light: "oklch(0.306 0.091 257)", dark: "oklch(0.72 0.13 257)" },
  { key: "blue", label: "Xanh dương", light: "oklch(0.49 0.175 250)", dark: "oklch(0.7 0.18 250)" },
  { key: "teal", label: "Xanh mòng két", light: "oklch(0.48 0.13 195)", dark: "oklch(0.74 0.14 195)" },
  { key: "slate", label: "Đen than", light: "oklch(0.24 0.012 260)", dark: "oklch(0.93 0.006 260)" },
];

/**
 * Density presets for the customizer.
 *
 * Density is a single number: `--density-spacing`, wired to Tailwind's base
 * spacing unit in `App.css`. Every `p-*`, `gap-*`, `h-*` and `size-*` utility
 * compiles to `calc(var(--spacing) * n)`, so rescaling that one unit tightens
 * or loosens the whole shell — control heights, table rows, card padding,
 * header height, nav rows — without a single per-component override.
 *
 * `hint` is what the customizer shows underneath the label.
 */
export const DENSITY_OPTIONS: Array<{
  key: Density;
  label: string;
  hint: string;
}> = [
  { key: "compact", label: "Gọn", hint: "85%" },
  { key: "comfortable", label: "Vừa", hint: "100%" },
  { key: "spacious", label: "Rộng", hint: "115%" },
];

export const RADIUS_OPTIONS: Array<{ key: Radius; label: string }> = [
  { key: "none", label: "0" },
  { key: "sm", label: "sm" },
  { key: "md", label: "md" },
  { key: "lg", label: "lg" },
  { key: "xl", label: "xl" },
];

const COLOR_PRESET_KEYS = COLOR_PRESETS.map((preset) => preset.key);
const RADIUS_KEYS = RADIUS_OPTIONS.map((option) => option.key);

function readStored<T extends string>(key: string, allowed: readonly T[], fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const value = window.localStorage.getItem(key);
    return allowed.includes(value as T) ? (value as T) : fallback;
  } catch {
    // Private mode / disabled storage — fall back rather than break the app.
    return fallback;
  }
}

function writeStored(key: string, value: string) {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    /* ignore */
  }
}

export function getStoredMode(fallback: ThemeMode = DEFAULTS.mode): ThemeMode {
  return readStored(STORAGE_KEYS.mode, ["light", "dark", "system"] as const, fallback);
}

export function getStoredColorPreset(
  fallback: ColorPreset = DEFAULTS.colorPreset
): ColorPreset {
  return readStored(STORAGE_KEYS.colorPreset, COLOR_PRESET_KEYS, fallback);
}

export function getStoredRadius(fallback: Radius = DEFAULTS.radius): Radius {
  return readStored(STORAGE_KEYS.radius, RADIUS_KEYS, fallback);
}

export function getStoredSidebarTone(
  fallback: SidebarTone = DEFAULTS.sidebarTone
): SidebarTone {
  return readStored(STORAGE_KEYS.sidebarTone, ["dark", "light"] as const, fallback);
}

export function getStoredDensity(fallback: Density = DEFAULTS.density): Density {
  return readStored(
    STORAGE_KEYS.density,
    ["compact", "comfortable", "spacious"] as const,
    fallback
  );
}

export function prefersDark(): boolean {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

export function resolveMode(mode: ThemeMode): ResolvedMode {
  if (mode === "system") return prefersDark() ? "dark" : "light";
  return mode;
}

/**
 * Suppress transitions for one frame so flipping the mode repaints instantly
 * instead of cross-fading every element on the page.
 */
function withoutTransitions(apply: () => void) {
  const root = document.documentElement;
  root.classList.add("theme-transition-suppressed");
  apply();
  window.requestAnimationFrame(() => {
    window.requestAnimationFrame(() => {
      root.classList.remove("theme-transition-suppressed");
    });
  });
}

export function applyMode(mode: ThemeMode) {
  const resolved = resolveMode(mode);
  withoutTransitions(() => {
    const root = document.documentElement;
    root.classList.toggle("dark", resolved === "dark");
    root.style.colorScheme = resolved;
  });
  writeStored(STORAGE_KEYS.mode, mode);
}

export function applyColorPreset(preset: ColorPreset) {
  document.documentElement.setAttribute("data-color-preset", preset);
  writeStored(STORAGE_KEYS.colorPreset, preset);
}

export function applyRadius(radius: Radius) {
  document.documentElement.setAttribute("data-radius", radius);
  writeStored(STORAGE_KEYS.radius, radius);
}

export function applySidebarTone(tone: SidebarTone) {
  document.documentElement.setAttribute("data-sidebar-tone", tone);
  writeStored(STORAGE_KEYS.sidebarTone, tone);
}

export function applyDensity(density: Density) {
  document.documentElement.setAttribute("data-density", density);
  writeStored(STORAGE_KEYS.density, density);
}
