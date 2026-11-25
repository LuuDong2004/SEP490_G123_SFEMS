import { Check, Palette } from "lucide-react";

import { Input } from "@/shared/ui/input";
import { cn } from "@/shared/lib/utils";

/** Bảng màu gợi ý — các màu đậm vừa, đọc rõ chữ trắng trên nhãn in. */
const PRESETS = [
  "#1D4ED8", "#0369A1", "#0F766E", "#15803D", "#4D7C0F",
  "#A16207", "#C2410C", "#B91C1C", "#BE185D", "#7E22CE",
  "#4338CA", "#334155",
];

const HEX = /^#[0-9A-Fa-f]{6}$/;

/**
 * Chọn màu chủ đạo theo ba cách: bấm một ô trong bảng màu gợi ý, mở bộ chọn
 * màu của trình duyệt, hoặc gõ tay mã hex. Cả ba cùng ghi vào một giá trị.
 */
export function ColorPicker({
  value,
  onChange,
}: {
  value: string | null | undefined;
  onChange: (value: string) => void;
}) {
  const current = value ?? "";
  const valid = HEX.test(current);
  return (
    <div className="space-y-2.5">
      <div className="flex flex-wrap gap-1.5">
        {PRESETS.map((c) => {
          const active = current.toUpperCase() === c;
          return (
            <button
              key={c}
              type="button"
              title={c}
              aria-label={`Chọn màu ${c}`}
              onClick={() => onChange(c)}
              className={cn(
                "flex size-7 items-center justify-center rounded-md ring-offset-2 ring-offset-background transition",
                active ? "ring-2 ring-foreground" : "hover:scale-110",
              )}
              style={{ backgroundColor: c }}
            >
              {active ? <Check className="size-4 text-white" /> : null}
            </button>
          );
        })}
      </div>
      <div className="flex items-center gap-2">
        {/* Bộ chọn màu của trình duyệt: bấm ô màu để mở dải màu đầy đủ. */}
        <label
          className={cn(
            "border-input shadow-e1 relative flex size-9 shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-md border",
            !valid && "bg-muted text-muted-foreground",
          )}
          title="Chọn từ dải màu"
          style={valid ? { backgroundColor: current } : undefined}
        >
          {valid ? null : <Palette className="size-4" />}
          <input
            type="color"
            value={valid ? current : "#1D4ED8"}
            onChange={(e) => onChange(e.target.value.toUpperCase())}
            className="absolute inset-0 size-full cursor-pointer opacity-0"
          />
        </label>
        <Input
          value={current}
          onChange={(e) => {
            const v = e.target.value.trim();
            onChange(v === "" || v.startsWith("#") ? v.toUpperCase() : `#${v.toUpperCase()}`);
          }}
          placeholder="#1D4ED8"
          maxLength={7}
          className="w-32 font-mono"
        />
      </div>
    </div>
  );
}
