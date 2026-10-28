import { endOfMonth, endOfQuarter, endOfYear, format, isValid, parse, startOfMonth, startOfQuarter, startOfYear, subMonths, subYears } from "date-fns";
import { vi } from "date-fns/locale";
import { CalendarDays, ChevronDown } from "lucide-react";
import { useState } from "react";
import type { DateRange } from "react-day-picker";

import { cn } from "@/shared/lib/utils";
import { Button } from "@/shared/ui/button";
import { Calendar } from "@/shared/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/shared/ui/popover";

/** Khoảng ngày lịch thuần "yyyy-MM-dd" — gửi API nguyên chuỗi, không qua `Date`, nên không lệch múi giờ. */
export type IsoRange = { from: string; to: string };

const ISO = "yyyy-MM-dd";
const toDate = (iso: string) => {
  const d = parse(iso, ISO, new Date());
  return isValid(d) ? d : undefined;
};
const toIso = (d: Date) => format(d, ISO);
const show = (iso: string) => {
  const d = toDate(iso);
  return d ? format(d, "dd/MM/yyyy") : "…";
};

/**
 * Các khoảng hay dùng. Kỳ ĐANG chạy kết thúc ở hôm nay chứ không ở cuối kỳ: báo cáo "năm nay" mà tính tới
 * 31/12 thì một nửa trục là tương lai trống.
 */
function presets(today = new Date()): { label: string; range: IsoRange }[] {
  const lastMonth = subMonths(today, 1);
  const lastYear = subYears(today, 1);
  return [
    { label: "Tháng này", range: { from: toIso(startOfMonth(today)), to: toIso(today) } },
    { label: "Tháng trước", range: { from: toIso(startOfMonth(lastMonth)), to: toIso(endOfMonth(lastMonth)) } },
    { label: "Quý này", range: { from: toIso(startOfQuarter(today)), to: toIso(today) } },
    { label: "Quý trước", range: { from: toIso(startOfQuarter(subMonths(today, 3))), to: toIso(endOfQuarter(subMonths(today, 3))) } },
    { label: "Năm nay", range: { from: toIso(startOfYear(today)), to: toIso(today) } },
    { label: "Năm trước", range: { from: toIso(startOfYear(lastYear)), to: toIso(endOfYear(lastYear)) } },
  ];
}

/**
 * Ô chọn KHOẢNG ngày: một nút ghi "01/01/2026 – 16/10/2026" (kèm tên lối tắt nếu khoảng trùng một lối tắt),
 * bấm vào mở lịch hai tháng để chọn ngày đầu rồi ngày cuối, các lối tắt ở cột trái.
 *
 * <p>Bấm lối tắt là xong và đóng; chọn trên lịch thì phải bấm "Áp dụng" — chọn ngày đầu xong chưa phải là
 * một khoảng, và gửi đi một khoảng nửa vời là bắt máy chủ tính một báo cáo không ai muốn.
 */
export function DateRangePicker({
  value,
  onChange,
  className,
}: {
  value: IsoRange;
  onChange: (range: IsoRange) => void;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<DateRange | undefined>();
  const options = presets();
  const matched = options.find((p) => p.range.from === value.from && p.range.to === value.to);

  const openChange = (next: boolean) => {
    setOpen(next);
    if (next) setDraft({ from: toDate(value.from), to: toDate(value.to) });
  };
  const apply = (range: IsoRange) => {
    onChange(range);
    setOpen(false);
  };
  const year = new Date().getFullYear();

  return (
    <Popover open={open} onOpenChange={openChange}>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" className={cn("justify-between gap-2 font-normal", className)}>
          <span className="flex items-center gap-2">
            <CalendarDays className="text-muted-foreground" />
            {matched ? <span className="font-medium">{matched.label}</span> : null}
            {matched ? <span className="text-muted-foreground">·</span> : null}
            <span className="tabular-nums">{show(value.from)} – {show(value.to)}</span>
          </span>
          <ChevronDown className="opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="end" sideOffset={6}>
        <div className="flex flex-col sm:flex-row">
          <ul className="flex flex-wrap gap-1 border-b p-2 sm:w-36 sm:flex-col sm:flex-nowrap sm:border-e sm:border-b-0">
            {options.map((p) => (
              <li key={p.label}>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className={cn("w-full justify-start font-normal", matched?.label === p.label && "bg-accent font-medium")}
                  onClick={() => apply(p.range)}
                >
                  {p.label}
                </Button>
              </li>
            ))}
          </ul>
          <div>
            <Calendar
              mode="range"
              locale={vi}
              weekStartsOn={1}
              numberOfMonths={2}
              selected={draft}
              onSelect={setDraft}
              defaultMonth={draft?.to ? subMonths(draft.to, 1) : undefined}
              fromYear={2000}
              toYear={year + 1}
              initialFocus
            />
            <div className="flex items-center justify-between gap-3 border-t px-3 py-2">
              <span className="text-muted-foreground text-sm tabular-nums">
                {draft?.from ? format(draft.from, "dd/MM/yyyy") : "Chọn ngày đầu"}
                {" – "}
                {draft?.to ? format(draft.to, "dd/MM/yyyy") : "ngày cuối"}
              </span>
              <div className="flex gap-2">
                <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)}>
                  Huỷ
                </Button>
                <Button
                  type="button"
                  size="sm"
                  disabled={!draft?.from || !draft?.to}
                  onClick={() => draft?.from && draft.to && apply({ from: toIso(draft.from), to: toIso(draft.to) })}
                >
                  Áp dụng
                </Button>
              </div>
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
