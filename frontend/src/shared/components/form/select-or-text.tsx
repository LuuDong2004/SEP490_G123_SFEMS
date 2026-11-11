import { useRef, useState } from "react";

import { Input } from "@/shared/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/ui/select";
import { cn } from "@/shared/lib/utils";

const OTHER = "__khac__";
const NONE = "__none__";

/** Mục "Khác" có sẵn trong danh sách (vd. "Khác (ghi rõ ở ghi chú)") — thay bằng mục Khác gõ tay, khỏi thành hai mục. */
const isOtherOption = (label: string) => /^khác\b/i.test(label.trim());

/**
 * Ô chọn danh sách ngắn có mục "Khác": chọn thì CHÍNH ô này thành ô gõ chữ (không thêm ô mới), mũi tên bên phải mở lại
 * danh sách. Giá trị là mã của mục đã chọn, hoặc chữ gõ tay. Giá trị cũ không có trong danh sách mở ra ở chế độ gõ.
 */
export function SelectOrText({ value, options, onChange, onBlur, placeholder, maxLength = 255, clearable, invalid, className }: {
  value: string | null | undefined;
  options: { value: string; label: string }[];
  onChange: (value: string | null) => void;
  onBlur?: () => void;
  placeholder?: string;
  maxLength?: number;
  /** Có dòng "Bỏ chọn" khi đang có giá trị. */
  clearable?: boolean;
  invalid?: boolean;
  className?: string;
}) {
  const shown = options.filter((o) => !isOtherOption(o.label));
  const known = shown.some((o) => o.value === value);
  const [typing, setTyping] = useState(false);
  const other = typing || (!!value && !known);
  const inputRef = useRef<HTMLInputElement>(null);
  // Vừa chọn "Khác": ô gõ mới hiện ở lần vẽ sau, nên đánh dấu ở đây rồi trao con trỏ khi danh sách đóng.
  const focusInput = useRef(false);

  const pick = (v: string) => {
    if (!v) return;
    if (v === OTHER) {
      focusInput.current = true;
      setTyping(true);
      if (known) onChange(null);
    } else {
      setTyping(false);
      onChange(v === NONE ? null : v);
    }
  };
  const items = (align: "start" | "end") => (
    <SelectContent align={align} onCloseAutoFocus={(e) => {
      if (focusInput.current) {
        focusInput.current = false;
        e.preventDefault();
        setTimeout(() => inputRef.current?.focus(), 0);
      }
    }}>
      {clearable && value ? <SelectItem value={NONE} className="text-muted-foreground">Bỏ chọn</SelectItem> : null}
      {shown.map((o) => (
        <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
      ))}
      <SelectItem value={OTHER}>Khác</SelectItem>
    </SelectContent>
  );

  if (other) {
    return (
      <div className={cn("relative", className)}>
        <Input ref={inputRef} value={known ? "" : value ?? ""} maxLength={maxLength} aria-invalid={invalid || undefined}
          onChange={(e) => onChange(e.target.value)} onBlur={onBlur}
          placeholder="Gõ nội dung khác" className="pe-9" />
        <Select value={OTHER} onValueChange={pick}>
          <SelectTrigger aria-label="Chọn trong danh sách"
            className="absolute inset-y-0 end-0 h-full w-9 justify-center border-0 bg-transparent px-0 shadow-none hover:bg-transparent dark:bg-transparent" />
          {items("end")}
        </Select>
      </div>
    );
  }
  return (
    <Select value={value || undefined} onValueChange={pick}>
      <SelectTrigger className={cn("w-full bg-field", className)} aria-invalid={invalid || undefined}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      {items("start")}
    </Select>
  );
}
