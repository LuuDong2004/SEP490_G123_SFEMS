import { useEffect, useState } from "react";

import { fmtQty as fmt, packOf, round3, type LotPack } from "@/shared/lib/lot-pack";
import { cn } from "@/shared/lib/utils";
import { Input } from "@/shared/ui/input";

/**
 * Ô nhập số lượng của một LÔ vật tư / hoá chất. Lô có quy cách (10 lọ × 10 ml) thì chọn được nhập theo bao bì
 * ("3 lọ") hoặc theo đơn vị của lô ("30 ml"); dưới ô ghi số quy đổi. Giá trị của ô LUÔN theo đơn vị của lô (chuỗi số,
 * như ô số thường) — luật kiểm và dữ liệu gửi máy chủ không đổi theo cách nhập.
 */
export function LotQuantityInput({ value, onChange, onBlur, unit, item, max, invalid, ariaLabel, className, hideHint }: {
  value: string | number | null | undefined;
  onChange: (base: string) => void;
  onBlur?: () => void;
  /** Đơn vị của lô (ml, g…). */
  unit: string;
  /** Lô đang nhập — đọc quy cách từ nó (`packUnitName` / `packUnit`, `packSize`). */
  item?: LotPack | null;
  max?: number;
  invalid?: boolean;
  ariaLabel?: string;
  className?: string;
  /** Không vẽ dòng quy đổi dưới ô — chỗ dùng tự nói số quy đổi trong dòng chữ của nó. */
  hideHint?: boolean;
}) {
  const pack = packOf(item);
  // Mặc định nhập theo bao bì khi lô có quy cách: hoá chất mua và cấp theo lọ, chai.
  const [byPack, setByPack] = useState(!!pack);
  const base = value === "" || value == null ? null : Number(value);
  const [text, setText] = useState(() => (pack && base != null ? String(round3(base / pack.size)) : ""));
  // Giá trị đổi từ ngoài (nạp phiếu, xoá dòng) khi đang nhập theo bao bì: dựng lại chữ trong ô.
  useEffect(() => {
    if (!pack || !byPack) return;
    const shown = text === "" ? null : round3(Number(text) * pack.size);
    if (base !== shown) setText(base == null ? "" : String(round3(base / pack.size)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const entered = byPack && pack ? text : value ?? "";
  const change = (t: string) => {
    if (byPack && pack) {
      setText(t);
      onChange(t === "" || !Number.isFinite(Number(t)) ? "" : String(round3(Number(t) * pack.size)));
    } else {
      onChange(t);
    }
  };
  const hint = pack && base != null && Number.isFinite(base) && base > 0
    ? byPack ? `= ${fmt(base)} ${unit}` : `= ${fmt(round3(base / pack.size))} ${pack.name}`
    : null;

  return (
    <div className={cn("grid gap-0.5", className)}>
      <div className="flex items-center gap-1.5">
        <Input type="number" min="0.001" step="any" max={byPack && pack && max != null ? max / pack.size : max}
          value={entered} onChange={(e) => change(e.target.value)} onBlur={onBlur}
          aria-label={ariaLabel} aria-invalid={invalid || undefined} className="w-24" />
        {pack ? (
          // Chọn đơn vị nhập: bao bì hoặc đơn vị của lô. Đổi cách nhập không đổi giá trị đã nhập.
          <div className="bg-muted inline-flex shrink-0 rounded-md p-0.5" role="radiogroup" aria-label="Đơn vị nhập">
            {[{ on: true, label: pack.name }, { on: false, label: unit }].map((o) => (
              <button key={o.label} type="button" role="radio" aria-checked={byPack === o.on}
                onClick={() => {
                  setByPack(o.on);
                  if (o.on) setText(base == null ? "" : String(round3(base / pack.size)));
                }}
                className={cn("rounded px-2 py-0.5 text-xs whitespace-nowrap",
                  byPack === o.on ? "bg-card text-foreground font-medium shadow-e1" : "text-muted-foreground hover:text-foreground")}>
                {o.label}
              </button>
            ))}
          </div>
        ) : (
          <span className="text-muted-foreground text-xs whitespace-nowrap">{unit}</span>
        )}
      </div>
      {hint && !hideHint ? <span className="text-muted-foreground text-xs tabular-nums">{hint}{pack ? ` · 1 ${pack.name} = ${fmt(pack.size)} ${unit}` : ""}</span> : null}
    </div>
  );
}
