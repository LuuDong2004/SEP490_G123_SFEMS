import { format, isValid, parse } from "date-fns";
import { vi } from "date-fns/locale";
import { CalendarDays } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/shared/ui/button";
import { Calendar } from "@/shared/ui/calendar";
import { Input } from "@/shared/ui/input";
import { Popover, PopoverAnchor, PopoverContent, PopoverTrigger } from "@/shared/ui/popover";
import { cn } from "@/shared/lib/utils";

/** Giá trị gửi API: ngày lịch thuần "yyyy-MM-dd", hoặc null. */
type IsoDate = string | null | undefined;

const toDate = (iso: IsoDate) => {
  if (!iso) return undefined;
  const d = parse(iso, "yyyy-MM-dd", new Date());
  return isValid(d) ? d : undefined;
};
const toText = (iso: IsoDate) => {
  const d = toDate(iso);
  return d ? format(d, "dd/MM/yyyy") : "";
};

/**
 * Ô ngày theo giao diện dự án, thay cho `<input type="date">` của trình duyệt
 * (mỗi trình duyệt một kiểu, và lịch của nó không theo theme).
 *
 * <p>Gõ tay "dd/mm/yyyy" (tự thêm dấu /) hoặc bấm biểu tượng lịch. Lịch tiếng
 * Việt, tuần bắt đầu thứ Hai, chọn nhanh tháng/năm, có "Hôm nay" và "Xoá".
 * Giá trị luôn là chuỗi "yyyy-MM-dd" — không qua `Date` khi gửi đi, nên không
 * lệch ngày vì múi giờ.
 */
export function DateInput({
  value,
  onChange,
  onBlur,
  name,
  placeholder = "dd/mm/yyyy",
  disabled,
  className,
}: {
  value: IsoDate;
  onChange: (value: string | null) => void;
  onBlur?: () => void;
  name?: string;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState(toText(value));
  useEffect(() => setText(toText(value)), [value]);

  const commit = (raw: string) => {
    if (!raw.trim()) {
      onChange(null);
      return;
    }
    const d = parse(raw, "dd/MM/yyyy", new Date());
    if (isValid(d) && raw.length === 10) {
      onChange(format(d, "yyyy-MM-dd"));
    } else {
      setText(toText(value)); // gõ sai thì trả về giá trị cũ
    }
  };

  const pick = (d: Date | undefined) => {
    onChange(d ? format(d, "yyyy-MM-dd") : null);
    setOpen(false);
  };

  const selected = toDate(value);
  const year = new Date().getFullYear();

  return (
    <Popover open={open} onOpenChange={setOpen} modal>
      {/* Neo lịch vào CẢ ô nhập (không phải nút lịch ở mép phải), để lịch
          mở thẳng dưới ô, canh trái với ô. */}
      <PopoverAnchor asChild>
      <div className={cn("relative", className)}>
        <Input
          name={name}
          value={text}
          disabled={disabled}
          placeholder={placeholder}
          inputMode="numeric"
          maxLength={10}
          className="pr-9 tabular-nums"
          onChange={(e) => {
            // Tự chèn "/" sau ngày và tháng khi gõ số.
            const digits = e.target.value.replace(/\D/g, "").slice(0, 8);
            const parts = [digits.slice(0, 2), digits.slice(2, 4), digits.slice(4, 8)].filter(Boolean);
            setText(parts.join("/"));
          }}
          onBlur={() => {
            commit(text);
            onBlur?.();
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              commit(text);
            }
          }}
        />
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            disabled={disabled}
            aria-label="Mở lịch"
            className="text-muted-foreground absolute top-1/2 right-1 -translate-y-1/2"
          >
            <CalendarDays />
          </Button>
        </PopoverTrigger>
      </div>
      </PopoverAnchor>
      <PopoverContent className="w-auto p-0" align="start" sideOffset={6}>
        <Calendar
          mode="single"
          locale={vi}
          weekStartsOn={1}
          selected={selected}
          defaultMonth={selected}
          onSelect={pick}
          captionLayout="dropdown"
          fromYear={1980}
          toYear={year + 10}
          classNames={{
            caption: "flex justify-center pt-1",
            caption_dropdowns: "flex gap-2",
            caption_label: "hidden",
            nav: "hidden",
            dropdown:
              "bg-field focus-visible:bg-card border-input rounded-md border px-1.5 py-1 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
            vhidden: "sr-only",
          }}
          initialFocus
        />
        <div className="flex justify-between border-t border-border px-3 py-2">
          <Button type="button" variant="ghost" size="sm" onClick={() => pick(undefined)}>
            Xoá
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={() => pick(new Date())}>
            Hôm nay
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
