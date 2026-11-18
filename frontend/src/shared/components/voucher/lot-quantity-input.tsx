import { cn } from "@/shared/lib/utils";
import { Input } from "@/shared/ui/input";

/**
 * Ô nhập số lượng của một LÔ vật tư / hoá chất, theo đơn vị của lô (g, ml…). Không quy đổi bao bì: lọ, chai chỉ là
 * đồ đựng, mọi phiếu đều ghi theo đơn vị tính của danh mục. Giá trị là chuỗi số như ô số thường.
 */
export function LotQuantityInput({ value, onChange, onBlur, unit, max, invalid, ariaLabel, className }: {
  value: string | number | null | undefined;
  onChange: (base: string) => void;
  onBlur?: () => void;
  /** Đơn vị của lô (ml, g…). */
  unit: string;
  max?: number;
  invalid?: boolean;
  ariaLabel?: string;
  className?: string;
}) {
  return (
    <div className={cn("flex items-center gap-1.5", className)}>
      <Input type="number" min="0.001" step="any" max={max}
        value={value ?? ""} onChange={(e) => onChange(e.target.value)} onBlur={onBlur}
        aria-label={ariaLabel} aria-invalid={invalid || undefined} className="w-24" />
      <span className="text-muted-foreground text-xs whitespace-nowrap">{unit}</span>
    </div>
  );
}
