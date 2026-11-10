import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/ui/select";
import { FUNDING_LABELS, FUNDING_OPTIONS } from "@/domains/equipment/types";

const NONE = "__none__";

/**
 * Ô chọn NGUỒN KINH PHÍ — năm nguồn chuẩn của danh mục. `allowed` thu hẹp lựa chọn theo nguồn hình
 * thành đang chọn (luật của máy chủ, `useOriginRules`); vắng thì hiện cả danh mục.
 *
 * Giá trị đang có mà KHÔNG còn nằm trong `allowed` vẫn hiện (kèm "không còn phù hợp") — Radix `Select`
 * không vẽ được giá trị thiếu mục tương ứng, và một ô đã có dữ liệu trông như ô trống là lỗi khó thấy nhất.
 */
export function FundingSelect({ value, onChange, allowed, placeholder = "Vui lòng chọn nguồn kinh phí", disabled, invalid, clearable }: {
  value: string | null | undefined;
  onChange: (value: string | null) => void;
  allowed?: string[];
  placeholder?: string;
  disabled?: boolean;
  invalid?: boolean;
  /** Có mục "Bỏ chọn" khi ô đang có giá trị. */
  clearable?: boolean;
}) {
  const options = FUNDING_OPTIONS.filter((v) => !allowed || allowed.includes(v));
  const stale = value && !options.includes(value) ? value : null;
  return (
    <Select
      value={value ?? ""}
      onValueChange={(v) => {
        // Radix bắn `""` khi màn sửa nạp giá trị lúc chưa khớp mục nào — nhận vào là xoá nguồn kinh phí
        // của bản ghi, và máy chủ trả 400 vì "" không phải một nguồn. Không mục nào mang value rỗng.
        if (v === "") return;
        onChange(v === NONE ? null : v);
      }}
      disabled={disabled}
    >
      <SelectTrigger className="w-full" aria-invalid={invalid || !!stale || undefined}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent className="max-h-72">
        {clearable && value ? <SelectItem value={NONE} className="text-muted-foreground">Bỏ chọn</SelectItem> : null}
        {stale ? (
          <SelectItem value={stale} className="text-destructive-text">
            {FUNDING_LABELS[stale] ?? stale} (không còn phù hợp)
          </SelectItem>
        ) : null}
        {options.map((v) => (
          <SelectItem key={v} value={v}>
            {FUNDING_LABELS[v]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
