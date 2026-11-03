import { Clock } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Popover, PopoverAnchor, PopoverContent, PopoverTrigger } from "@/shared/ui/popover";
import { cn } from "@/shared/lib/utils";

const pad = (n: number) => String(n).padStart(2, "0");
const HOURS = Array.from({ length: 24 }, (_, i) => i);
const MINUTES = Array.from({ length: 12 }, (_, i) => i * 5);

/** "HH:mm" từ giá trị lưu ("HH:mm" hoặc "HH:mm:ss"); sai dạng thì rỗng. */
function normalize(value: string | null | undefined): string {
  const m = /^(\d{1,2}):(\d{2})/.exec(value ?? "");
  if (!m) return "";
  const h = Number(m[1]);
  const min = Number(m[2]);
  return h < 24 && min < 60 ? `${pad(h)}:${pad(min)}` : "";
}

/**
 * Ô GIỜ theo giao diện dự án, thay cho `<input type="time">` của trình duyệt (Chrome vẽ danh sách 12 giờ "SA / CH",
 * không theo theme). Cùng khuôn với `DateInput`: gõ tay "0830" thành "08:30", hoặc bấm đồng hồ mở hộp hai cột Giờ
 * (00–23) · Phút (bước 5), có "Bây giờ" và "Xoá". Giá trị là chuỗi "HH:mm" (trống = không có giờ).
 */
export function TimeInput({ value, onChange, onBlur, name, placeholder = "--:--", disabled, className, id }: {
  value: string | null | undefined;
  onChange: (value: string) => void;
  onBlur?: () => void;
  name?: string;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  id?: string;
}) {
  const current = normalize(value);
  const [open, setOpen] = useState(false);
  const [text, setText] = useState(current);
  useEffect(() => setText(current), [current]);
  const [hour, minute] = current ? current.split(":").map(Number) : [null, null];
  // Phút lệch bước 5 (gõ tay 08:07) vẫn hiện trong cột để thấy đang chọn gì.
  const minutes = minute != null && minute % 5 !== 0 ? [...MINUTES, minute].sort((a, b) => a - b) : MINUTES;

  const commit = (raw: string) => {
    if (!raw.trim()) {
      onChange("");
      return;
    }
    const digits = raw.replace(/\D/g, "");
    const t = normalize(digits.length <= 2 ? `${digits}:00` : `${digits.slice(0, digits.length - 2)}:${digits.slice(-2)}`);
    if (t) onChange(t);
    else setText(current); // gõ sai thì trả về giá trị cũ
  };
  const set = (h: number | null, m: number | null) => onChange(`${pad(h ?? 7)}:${pad(m ?? 0)}`);

  return (
    <Popover open={open} onOpenChange={setOpen} modal>
      <PopoverAnchor asChild>
        <div className={cn("relative", className)}>
          <Input id={id} name={name} value={text} disabled={disabled} placeholder={placeholder} inputMode="numeric" maxLength={5}
            className="pr-9 tabular-nums"
            onChange={(e) => {
              const digits = e.target.value.replace(/\D/g, "").slice(0, 4);
              setText(digits.length > 2 ? `${digits.slice(0, 2)}:${digits.slice(2)}` : digits);
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
            }} />
          <PopoverTrigger asChild>
            <Button type="button" variant="ghost" size="icon-sm" disabled={disabled} aria-label="Chọn giờ"
              className="text-muted-foreground absolute top-1/2 right-1 -translate-y-1/2">
              <Clock />
            </Button>
          </PopoverTrigger>
        </div>
      </PopoverAnchor>
      <PopoverContent align="start" className="w-auto p-0" onOpenAutoFocus={(e) => e.preventDefault()}>
        <div className="flex divide-x">
          <Column label="Giờ" items={HOURS} selected={hour} onPick={(h) => set(h, minute)} />
          <Column label="Phút" items={minutes} selected={minute} onPick={(m) => { set(hour, m); setOpen(false); }} />
        </div>
        <div className="flex items-center justify-between gap-2 border-t px-2 py-1.5">
          <Button type="button" variant="ghost" size="sm" className="text-primary h-7 px-2"
            onClick={() => {
              const now = new Date();
              onChange(`${pad(now.getHours())}:${pad(now.getMinutes())}`);
              setOpen(false);
            }}>
            Bây giờ
          </Button>
          <Button type="button" variant="ghost" size="sm" className="h-7 px-2" disabled={!current}
            onClick={() => { onChange(""); setOpen(false); }}>
            Xoá
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

/** Một cột cuộn của hộp chọn giờ; mở ra là cuộn tới giá trị đang chọn. */
function Column({ label, items, selected, onPick }: {
  label: string;
  items: number[];
  selected: number | null;
  onPick: (v: number) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current?.querySelector<HTMLElement>("[data-selected=true]");
    el?.scrollIntoView({ block: "center" });
  }, []);
  return (
    <div className="w-16">
      <div className="text-muted-foreground border-b px-2 py-1.5 text-center text-xs font-medium">{label}</div>
      <div ref={ref} className="max-h-56 overflow-y-auto p-1 [scrollbar-width:thin]">
        {items.map((v) => (
          <button key={v} type="button" data-selected={v === selected} onClick={() => onPick(v)}
            className={cn("w-full rounded-md py-1.5 text-center text-sm tabular-nums transition-colors",
              v === selected ? "bg-primary text-primary-foreground font-semibold" : "hover:bg-primary/10 hover:text-primary")}>
            {pad(v)}
          </button>
        ))}
      </div>
    </div>
  );
}
