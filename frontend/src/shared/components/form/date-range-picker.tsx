import { endOfMonth, endOfQuarter, endOfYear, format, isValid, parse, startOfMonth, startOfQuarter, startOfYear, subMonths, subYears } from "date-fns";
import { vi } from "date-fns/locale";
import { CalendarDays, ChevronDown } from "lucide-react";
import { useState } from "react";
import type { DateRange } from "react-day-picker";

import { cn } from "@/shared/lib/utils";
import { Button } from "@/shared/ui/button";
import { Calendar } from "@/shared/ui/calendar";
import { Input } from "@/shared/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/shared/ui/popover";

/** Khoảng ngày lịch thuần "yyyy-MM-dd" — gửi API nguyên chuỗi, không qua `Date`, nên không lệch múi giờ. */
export type IsoRange = { from: string; to: string };

const ISO = "yyyy-MM-dd";
const toDate = (iso: string) => {
  const d = parse(iso, ISO, new Date());
  return isValid(d) ? d : undefined;
};
const toIso = (d: Date) => format(d, ISO);
const DMY = "dd/MM/yyyy";
/** Đọc ngày gõ tay "dd/mm/yyyy" (chấp nhận "1/7/2026", "01-07-2026"); sai thì `undefined`. */
const parseDmy = (text: string) => {
  const t = text.trim().replace(/[-.]/g, "/");
  const d = parse(t, "d/M/yyyy", new Date());
  return isValid(d) && d.getFullYear() >= 2000 && d.getFullYear() <= 2100 ? d : undefined;
};
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
  // Năm học bắt đầu 01/09: từ tháng 9 trở đi là năm học của năm nay, trước đó là năm học bắt đầu năm ngoái.
  const schoolStart = today.getMonth() >= 8 ? today.getFullYear() : today.getFullYear() - 1;
  return [
    { label: "Năm học này", range: { from: `${schoolStart}-09-01`, to: toIso(today) } },
    { label: "Năm học trước", range: { from: `${schoolStart - 1}-09-01`, to: `${schoolStart}-08-31` } },
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
  // Tháng đang hiện bên trái — mở ra ở tháng của NGÀY ĐẦU; gõ ngày tay thì nhảy theo.
  const [month, setMonth] = useState<Date | undefined>();
  const [fromText, setFromText] = useState("");
  const [toText, setToText] = useState("");
  const options = presets();
  const matched = options.find((p) => p.range.from === value.from && p.range.to === value.to);

  const openChange = (next: boolean) => {
    setOpen(next);
    if (next) {
      const from = toDate(value.from);
      const to = toDate(value.to);
      setDraft({ from, to });
      setMonth(from);
      setFromText(from ? format(from, DMY) : "");
      setToText(to ? format(to, DMY) : "");
    }
  };
  const apply = (range: IsoRange) => {
    onChange(range);
    setOpen(false);
  };
  const year = new Date().getFullYear();
  // Chọn trên lịch: hai ô gõ tay đi theo.
  const pick = (range: DateRange | undefined) => {
    setDraft(range);
    setFromText(range?.from ? format(range.from, DMY) : "");
    setToText(range?.to ? format(range.to, DMY) : "");
  };
  // Gõ tay: hợp lệ thì cập nhật khoảng và nhảy lịch tới tháng đó; ngày đầu sau ngày cuối thì đổi chỗ.
  const typed = (which: "from" | "to", text: string) => {
    const d = parseDmy(text);
    if (!d) return;
    let from = which === "from" ? d : draft?.from;
    let to = which === "to" ? d : draft?.to;
    if (from && to && from > to) [from, to] = [to, from];
    pick({ from, to });
    setMonth(which === "to" ? subMonths(d, 1) : d);
  };

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
            {/* Dải chọn: ngày đầu / cuối xanh đậm, ngày giữa xanh rất nhạt nối liền; không hiện ngày của tháng bên
                cạnh (trước đây chúng cũng bị tô, nhìn không ra khoảng bắt đầu, kết thúc ở đâu). */}
            <Calendar
              mode="range"
              locale={vi}
              weekStartsOn={1}
              numberOfMonths={2}
              showOutsideDays={false}
              selected={draft}
              onSelect={pick}
              month={month}
              onMonthChange={setMonth}
              fromYear={2000}
              toYear={year + 1}
              classNames={{
                months: "flex flex-col sm:flex-row gap-6",
                head_cell: "text-muted-foreground w-9 font-normal text-xs",
                row: "flex w-full mt-1",
                cell: "relative size-9 p-0 text-center text-sm",
                day: "size-9 rounded-full p-0 text-sm font-normal hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring/50 outline-none",
                day_range_start: "day-range-start !bg-primary !text-primary-foreground rounded-e-none",
                day_range_end: "day-range-end !bg-primary !text-primary-foreground rounded-s-none [&.day-range-start]:rounded-full",
                day_selected: "bg-primary/10 text-primary",
                day_range_middle: "rounded-none bg-primary/10 text-primary hover:bg-primary/20",
                day_today: "font-semibold underline underline-offset-4",
                day_outside: "invisible",
              }}
            />
            <div className="flex flex-wrap items-center justify-between gap-3 border-t px-3 py-2.5">
              {/* Gõ ngày tay — nhanh hơn bấm lùi từng tháng khi cần một khoảng xa. */}
              <div className="flex items-center gap-1.5 text-sm">
                <Input aria-label="Từ ngày" placeholder="Từ ngày" className="h-8 w-28 text-center tabular-nums"
                  value={fromText} onChange={(e) => setFromText(e.target.value)}
                  onBlur={(e) => typed("from", e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") typed("from", e.currentTarget.value); }} />
                <span className="text-muted-foreground">–</span>
                <Input aria-label="Đến ngày" placeholder="Đến ngày" className="h-8 w-28 text-center tabular-nums"
                  value={toText} onChange={(e) => setToText(e.target.value)}
                  onBlur={(e) => typed("to", e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") typed("to", e.currentTarget.value); }} />
              </div>
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
