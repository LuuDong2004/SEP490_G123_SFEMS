import { endOfMonth, endOfQuarter, format, isValid, parse, startOfMonth, startOfQuarter } from "date-fns";
import { vi } from "date-fns/locale";
import { CalendarDays, ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import { useState } from "react";
import type { DateRange } from "react-day-picker";

import { Segmented } from "@/shared/components/segmented";
import { cn } from "@/shared/lib/utils";
import { Button } from "@/shared/ui/button";
import { Calendar } from "@/shared/ui/calendar";
import { Input } from "@/shared/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/shared/ui/popover";

/** Khoảng ngày lịch thuần "yyyy-MM-dd" — gửi API nguyên chuỗi, không qua `Date`, nên không lệch múi giờ. */
export type IsoRange = { from: string; to: string };

const ISO = "yyyy-MM-dd";
const DMY = "dd/MM/yyyy";
const MIN_YEAR = 2000;
const toDate = (iso: string) => {
  const d = parse(iso, ISO, new Date());
  return isValid(d) ? d : undefined;
};
const toIso = (d: Date) => format(d, ISO);
/** Đọc ngày gõ tay "dd/mm/yyyy" (chấp nhận "1/7/2026", "01-07-2026"); sai thì `undefined`. */
const parseDmy = (text: string) => {
  const t = text.trim().replace(/[-.]/g, "/");
  const d = parse(t, "d/M/yyyy", new Date());
  return isValid(d) && d.getFullYear() >= MIN_YEAR && d.getFullYear() <= 2100 ? d : undefined;
};
const show = (iso: string) => {
  const d = toDate(iso);
  return d ? format(d, DMY) : "…";
};

type Period = { label: string; short: string; from: string; to: string };

/**
 * Tạo một kỳ. Kỳ ĐANG chạy kết thúc ở hôm nay chứ không ở cuối kỳ: báo cáo "năm nay" mà tính tới 31/12 thì một nửa
 * trục là tương lai trống.
 */
const period = (label: string, short: string, from: string, end: string, today: string): Period => ({
  label, short, from, to: end > today ? today : end,
});

/** Mọi kỳ của một năm dương lịch — năm học ghi riêng vì nó vắt qua hai năm. */
function yearPeriods(year: number, today: string) {
  const months = Array.from({ length: 12 }, (_, i) => {
    const first = new Date(year, i, 1);
    return period(`Tháng ${i + 1}/${year}`, `T${i + 1}`, toIso(startOfMonth(first)), toIso(endOfMonth(first)), today);
  });
  const quarters = [0, 3, 6, 9].map((m, i) => {
    const first = new Date(year, m, 1);
    return period(`Quý ${i + 1}/${year}`, `Quý ${i + 1}`, toIso(startOfQuarter(first)), toIso(endOfQuarter(first)), today);
  });
  const whole = period(`Năm ${year}`, "Cả năm", `${year}-01-01`, `${year}-12-31`, today);
  // Năm học bắt đầu 01/09: một năm dương lịch chạm hai năm học.
  const school = [year - 1, year].map((y) =>
    period(`Năm học ${y}–${y + 1}`, `${y}–${y + 1}`, `${y}-09-01`, `${y + 1}-08-31`, today));
  return { months, quarters, whole, school };
}

/** Năm học đang làm việc (header): kỳ báo cáo là các khoảng BÊN TRONG năm đó. */
export type YearBounds = { from: string; to: string; label: string };

/** Các kỳ của một năm học: cả năm học và từng tháng (T9 → T8). */
function schoolYearPeriods(b: YearBounds, today: string) {
  const whole = period(b.label, "Cả năm học", b.from, b.to, today);
  const months: Period[] = [];
  const end = toDate(b.to);
  for (let d = startOfMonth(toDate(b.from) ?? new Date()); end && d <= end; d = new Date(d.getFullYear(), d.getMonth() + 1, 1)) {
    const label = `Tháng ${d.getMonth() + 1}/${d.getFullYear()}`;
    const from = toIso(d) < b.from ? b.from : toIso(d);
    const last = toIso(endOfMonth(d));
    months.push(period(label, `T${d.getMonth() + 1}`, from, last > b.to ? b.to : last, today));
  }
  return { whole, months };
}

/** Tên kỳ nếu khoảng đang chọn đúng là một kỳ — để nút ghi "Quý 3/2026" thay vì chỉ có hai ngày. */
function nameOf(value: IsoRange, today: string, bounds?: YearBounds) {
  if (bounds) {
    const { whole, months } = schoolYearPeriods(bounds, today);
    return [whole, ...months].find((p) => p.from === value.from && p.to === value.to)?.label;
  }
  const y = Number(value.from.slice(0, 4));
  if (!y) return undefined;
  const { months, quarters, whole, school } = yearPeriods(y, today);
  return [whole, ...quarters, ...months, ...school].find((p) => p.from === value.from && p.to === value.to)?.label;
}

/**
 * Ô chọn kỳ của báo cáo: nút ghi tên kỳ (không phải kỳ thì hai ngày); bấm mở hộp nhỏ có hai cách chọn.
 * - "Theo kỳ" (cách hay dùng): chọn năm, rồi bấm Cả năm / Năm học / Quý / Tháng là xong và đóng. Kỳ chưa tới thì mờ.
 * - "Tự chọn ngày": lịch một tháng hoặc gõ hai ngày, rồi "Áp dụng" — chọn ngày đầu xong chưa phải là một khoảng, gửi đi
 *   khoảng nửa vời là bắt máy chủ tính một báo cáo không ai muốn. Bấm ngày đầu rồi ngày cuối; bấm tiếp là chọn lại từ đầu.
 */
export function DateRangePicker({
  value,
  onChange,
  className,
  bounds,
}: {
  value: IsoRange;
  onChange: (range: IsoRange) => void;
  className?: string;
  /** Có thì chỉ chọn được trong năm học này (năm chọn trên header): kỳ là cả năm học / từng tháng, lịch khoá ngoài năm. */
  bounds?: YearBounds;
}) {
  const now = new Date();
  const today = toIso(now);
  const thisYear = now.getFullYear();
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"period" | "custom">("period");
  const [year, setYear] = useState(thisYear);
  const [draft, setDraft] = useState<DateRange | undefined>();
  const [month, setMonth] = useState<Date | undefined>();
  const [fromText, setFromText] = useState("");
  const [toText, setToText] = useState("");
  const name = nameOf(value, today, bounds);

  const openChange = (next: boolean) => {
    setOpen(next);
    if (!next) return;
    const from = toDate(value.from);
    const to = toDate(value.to);
    setTab(name ? "period" : "custom");
    setYear(from?.getFullYear() ?? thisYear);
    setDraft({ from, to });
    // Mở ở tháng của NGÀY CUỐI: thường là tháng người ta đang quan tâm (ngày đầu của "năm nay" là tận tháng 1).
    setMonth(to ?? now);
    setFromText(from ? format(from, DMY) : "");
    setToText(to ? format(to, DMY) : "");
  };
  const apply = (range: IsoRange) => {
    onChange(range);
    setOpen(false);
  };
  const pick = (range: DateRange | undefined) => {
    setDraft(range);
    setFromText(range?.from ? format(range.from, DMY) : "");
    setToText(range?.to ? format(range.to, DMY) : "");
  };
  // Lần bấm thứ nhất là ngày đầu, thứ hai là ngày cuối (bấm ngược thì đổi chỗ); đã đủ hai ngày thì bấm là chọn lại.
  const clickDay = (day: Date) => {
    if (!draft?.from || draft.to) return pick({ from: day, to: undefined });
    pick(day < draft.from ? { from: day, to: draft.from } : { from: draft.from, to: day });
  };
  // Gõ tay: hợp lệ thì cập nhật khoảng và nhảy lịch tới tháng đó; ngày đầu sau ngày cuối thì đổi chỗ.
  const typed = (which: "from" | "to", text: string) => {
    const d = parseDmy(text);
    if (!d) return;
    if (bounds && (toIso(d) < bounds.from || toIso(d) > bounds.to)) return;
    let from = which === "from" ? d : draft?.from;
    let to = which === "to" ? d : draft?.to;
    if (from && to && from > to) [from, to] = [to, from];
    pick({ from, to });
    setMonth(d);
  };
  // Mũi tên năm dùng chung cho hai tab: ở tab lịch thì lịch nhảy theo cả năm, khỏi bấm lùi từng tháng.
  const stepYear = (delta: number) => {
    const y = Math.min(thisYear, Math.max(MIN_YEAR, year + delta));
    setYear(y);
    if (month) setMonth(new Date(y, month.getMonth(), 1));
  };
  const shownMonth = month ?? now;
  const calendarYear = tab === "custom" ? shownMonth.getFullYear() : year;

  const { months, quarters, whole, school } = yearPeriods(year, today);
  const inYear = bounds ? schoolYearPeriods(bounds, today) : null;
  const lastDay = bounds && bounds.to < today ? toDate(bounds.to)! : now;
  const choice = (p: Period, extra?: string) => {
    const on = p.from === value.from && p.to === value.to;
    const future = p.from > today;
    const current = !future && p.from <= today && p.to === today;
    return (
      <button key={p.label} type="button" disabled={future} aria-pressed={on} title={`${p.label}: ${show(p.from)} – ${show(p.to)}`}
        onClick={() => apply({ from: p.from, to: p.to })}
        className={cn(
          "h-8 rounded-full px-2 text-[0.8125rem] whitespace-nowrap tabular-nums transition-[background-color,color,scale] duration-150 outline-none",
          "focus-visible:ring-ring/50 focus-visible:ring-[3px] active:scale-95 disabled:pointer-events-none disabled:opacity-35",
          on ? "bg-primary text-primary-foreground font-semibold" : "bg-muted/60 hover:bg-accent text-foreground",
          current && !on && "ring-primary/40 ring-1 ring-inset",
          extra,
        )}>
        {p.short}
      </button>
    );
  };
  const rowLabel = "text-muted-foreground text-xs font-medium";

  return (
    <Popover open={open} onOpenChange={openChange}>
      <PopoverTrigger asChild>
        {/* Trùng một kỳ thì chỉ ghi tên kỳ cho gọn hàng công cụ (hai ngày hiện khi rê chuột); khoảng lẻ thì ghi hai ngày. */}
        <Button type="button" variant="outline" title={`${show(value.from)} – ${show(value.to)}`}
          className={cn("justify-between gap-2 font-normal", className)}>
          <span className="flex items-center gap-2">
            <CalendarDays className="text-muted-foreground" />
            {name ? <span className="font-medium">{name}</span> : <span className="tabular-nums">{show(value.from)} – {show(value.to)}</span>}
          </span>
          <ChevronDown className="opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[22rem] max-w-[calc(100vw-2rem)] p-0" align="end" sideOffset={6}>
        <div className="flex items-center justify-between gap-2 border-b px-3 py-2.5">
          <Segmented label="Cách chọn kỳ" size="sm" value={tab} onChange={setTab}
            options={[{ value: "period", label: "Theo kỳ" }, { value: "custom", label: "Tự chọn ngày" }]} />
          {bounds ? <span className="text-muted-foreground truncate text-xs font-medium">{bounds.label}</span> : (
          <div className="flex items-center gap-0.5" role="group" aria-label="Năm">
            <Button type="button" variant="ghost" size="icon-sm" aria-label="Năm trước" disabled={calendarYear <= MIN_YEAR} onClick={() => stepYear(-1)}>
              <ChevronLeft />
            </Button>
            <span className="w-11 text-center text-sm font-semibold tabular-nums">{calendarYear}</span>
            <Button type="button" variant="ghost" size="icon-sm" aria-label="Năm sau" disabled={calendarYear >= thisYear} onClick={() => stepYear(1)}>
              <ChevronRight />
            </Button>
          </div>
          )}
        </div>

        {tab === "period" && inYear ? (
          <div className="grid gap-3 p-3">
            <div className="grid gap-1.5">
              <span className={rowLabel}>Năm học</span>
              {choice(inYear.whole)}
            </div>
            <div className="grid gap-1.5">
              <span className={rowLabel}>Tháng</span>
              <div className="grid grid-cols-6 gap-1.5">{inYear.months.map((p) => choice(p, "px-0"))}</div>
            </div>
          </div>
        ) : tab === "period" ? (
          <div className="grid gap-3 p-3">
            {/* Năm và năm học chung một hàng, ba nút bằng nhau — nút "Cả năm" kéo hết bề ngang thì quá to. */}
            <div className="grid grid-cols-3 gap-x-1.5 gap-y-1.5">
              <span className={rowLabel}>Năm</span>
              <span className={cn(rowLabel, "col-span-2")}>Năm học</span>
              {choice(whole)}
              {school.map((p) => choice(p))}
            </div>
            <div className="grid gap-1.5">
              <span className={rowLabel}>Quý</span>
              <div className="grid grid-cols-4 gap-1.5">{quarters.map((p) => choice(p))}</div>
            </div>
            <div className="grid gap-1.5">
              <span className={rowLabel}>Tháng</span>
              <div className="grid grid-cols-6 gap-1.5">{months.map((p) => choice(p, "px-0"))}</div>
            </div>
          </div>
        ) : (
          <div>
            <div className="flex items-center gap-1.5 px-3 pt-3 text-sm">
              {/* Gõ ngày tay — nhanh hơn bấm lịch khi đã biết ngày. */}
              <Input aria-label="Từ ngày" placeholder="Từ ngày" className="h-8 min-w-0 flex-1 text-center tabular-nums"
                value={fromText} onChange={(e) => setFromText(e.target.value)}
                onBlur={(e) => typed("from", e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") typed("from", e.currentTarget.value); }} />
              <span className="text-muted-foreground">–</span>
              <Input aria-label="Đến ngày" placeholder="Đến ngày" className="h-8 min-w-0 flex-1 text-center tabular-nums"
                value={toText} onChange={(e) => setToText(e.target.value)}
                onBlur={(e) => typed("to", e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") typed("to", e.currentTarget.value); }} />
            </div>
            {/* `onSelect` để trống: cách chọn của thư viện nới khoảng đang có khi bấm thêm — tự xử ở `clickDay`. */}
            <Calendar
              mode="range"
              locale={vi}
              weekStartsOn={1}
              showOutsideDays={false}
              selected={draft}
              onSelect={() => undefined}
              onDayClick={clickDay}
              month={shownMonth}
              onMonthChange={(m) => {
                setMonth(m);
                setYear(m.getFullYear());
              }}
              fromYear={bounds ? undefined : MIN_YEAR}
              fromDate={bounds ? toDate(bounds.from) : undefined}
              toDate={lastDay}
              className="flex justify-center"
              classNames={{
                head_cell: "text-muted-foreground w-10 font-normal text-xs",
                row: "flex w-full mt-1",
                cell: "relative size-10 p-0 text-center text-sm",
                day: "size-10 rounded-full p-0 text-sm font-normal hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring/50 outline-none disabled:opacity-35",
                day_range_start: "day-range-start !bg-primary !text-primary-foreground rounded-e-none",
                day_range_end: "day-range-end !bg-primary !text-primary-foreground rounded-s-none [&.day-range-start]:rounded-full",
                day_selected: "bg-primary/10 text-primary",
                day_range_middle: "rounded-none bg-primary/10 text-primary hover:bg-primary/20",
                day_today: "font-semibold underline underline-offset-4",
                day_outside: "invisible",
              }}
            />
            <div className="flex items-center justify-between gap-2 border-t px-3 py-2.5">
              <span className="text-muted-foreground text-xs">
                {!draft?.from ? "Chọn ngày đầu" : !draft.to ? "Chọn ngày cuối" : " "}
              </span>
              <div className="flex gap-2">
                <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)}>Huỷ</Button>
                <Button type="button" size="sm" disabled={!draft?.from || !draft?.to}
                  onClick={() => draft?.from && draft.to && apply({ from: toIso(draft.from), to: toIso(draft.to) })}>
                  Áp dụng
                </Button>
              </div>
            </div>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
