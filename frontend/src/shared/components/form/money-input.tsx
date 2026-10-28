import { forwardRef, useLayoutEffect, useRef, type ComponentProps } from "react";

import { Input } from "@/shared/ui/input";
import { cn } from "@/shared/lib/utils";

/** Đồng không có phần lẻ: hiện theo hàng nghìn kiểu Việt Nam, 1500000 → "1.500.000". */
const GROUPS = new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 0 });

/** Giá trị form → chữ hiện trong ô. Nhận cả số lẫn chuỗi số (form nào cũng có lúc giữ tiền dạng chuỗi). */
function formatMoney(value: unknown): string {
  if (value === null || value === undefined || value === "") {
    return "";
  }
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? GROUPS.format(Math.trunc(n)) : "";
}

type Props = Omit<ComponentProps<typeof Input>, "value" | "onChange" | "type"> & {
  value: unknown;
  /** Số đồng, hoặc `null` khi ô trống. */
  onChange: (value: number | null) => void;
};

/**
 * Ô nhập số tiền: chèn dấu chấm hàng nghìn ngay khi gõ, nhưng giá trị của form vẫn là SỐ — máy chủ không
 * bao giờ thấy dấu chấm. Chỉ nhận chữ số (dán "1.500.000 đ" cũng được), bỏ số 0 thừa ở đầu.
 *
 * <p>Chèn dấu chấm làm chuỗi dài ra, nên con trỏ được đặt lại theo SỐ CHỮ SỐ đứng trước nó, không theo vị trí
 * ký tự — nếu không, gõ vào giữa "1.500.000" là con trỏ nhảy về cuối sau mỗi phím.
 */
export const MoneyInput = forwardRef<HTMLInputElement, Props>(function MoneyInput(
  { value, onChange, placeholder = "Nhập số tiền", ...rest },
  forwarded,
) {
  const inner = useRef<HTMLInputElement | null>(null);
  const caretDigits = useRef<number | null>(null);
  const text = formatMoney(value);

  useLayoutEffect(() => {
    const el = inner.current;
    const digits = caretDigits.current;
    if (!el || digits === null || document.activeElement !== el) {
      return;
    }
    caretDigits.current = null;
    let pos = 0;
    for (let seen = 0; pos < text.length && seen < digits; pos++) {
      if (/\d/.test(text[pos])) {
        seen++;
      }
    }
    el.setSelectionRange(pos, pos);
  }, [text]);

  return (
    <Input
      {...rest}
      ref={(el) => {
        inner.current = el;
        if (typeof forwarded === "function") {
          forwarded(el);
        } else if (forwarded) {
          forwarded.current = el;
        }
      }}
      type="text"
      inputMode="numeric"
      autoComplete="off"
      placeholder={placeholder}
      className={cn("tabular-nums", rest.className)}
      value={text}
      onChange={(e) => {
        const raw = e.target.value;
        const caret = e.target.selectionStart ?? raw.length;
        const digits = raw.replace(/\D/g, "").replace(/^0+(?=\d)/, "");
        caretDigits.current = Math.min(raw.slice(0, caret).replace(/\D/g, "").length, digits.length);
        onChange(digits === "" ? null : Number(digits));
      }}
    />
  );
});
