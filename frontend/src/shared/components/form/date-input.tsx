import { addMonths, addYears, format, isValid, parse, setMonth as setMonthOf, setYear } from "date-fns";
import { vi } from "date-fns/locale";
import { CalendarDays, ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";

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
/** Năm đầu của lịch — ngày ban hành văn bản, ngày mua tài sản cũ nhất còn gặp. */
const FIRST_YEAR = 1980;

const toText = (iso: IsoDate) => {
  const d = toDate(iso);
  return d ? format(d, "dd/MM/yyyy") : "";
};

/**
 * Ô ngày theo giao diện dự án, thay cho `<input type="date">` của trình duyệt
 * (mỗi trình duyệt một kiểu, và lịch của nó không theo theme).
 *
 * <p>Gõ tay "dd/mm/yyyy" (tự thêm dấu /) hoặc bấm biểu tượng lịch. Lịch tiếng
 * Việt, tuần bắt đầu thứ Hai, có "Hôm nay" và "Xoá". Chọn nhanh tháng / năm bằng đầu lịch tự vẽ: bấm "Tháng 11, 2026"
 * → lưới 12 tháng, bấm năm → lưới 12 năm — không dùng ô xổ `<select>` của trình duyệt (lệch giao diện, và trong
 * popover lồng hộp thoại thì danh sách năm của trình duyệt bấm vào là đóng lịch).
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
  inputClassName,
}: {
  value: IsoDate;
  onChange: (value: string | null) => void;
  onBlur?: () => void;
  name?: string;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  /** Lớp của chính ô nhập — vd. ô trong bảng không khung (`CELL_INPUT` của bảng dòng phiếu). */
  inputClassName?: string;
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
  const today = new Date();
  const lastYear = today.getFullYear() + 10;
  // Lớp đang xem của lịch và tháng đang hiện — mở lịch thì về lớp ngày, tại tháng của ngày đã chọn (chưa chọn: hôm nay).
  const [view, setView] = useState<"days" | "months" | "years">("days");
  const [month, setMonth] = useState<Date>(selected ?? today);
  const [pageStart, setPageStart] = useState(today.getFullYear() - 6);
  useEffect(() => {
    if (!open) return;
    const at = toDate(value) ?? new Date();
    setView("days");
    setMonth(at);
    setPageStart(at.getFullYear() - 6);
  }, [open, value]);
  useEffect(() => {
    if (view === "years") setPageStart(month.getFullYear() - 6);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- chỉ khi mở lớp năm: trang năm quanh năm đang xem
  }, [view]);

  return (
    <Popover open={open} onOpenChange={setOpen} modal>
      {/* Neo lịch vào CẢ ô nhập (không phải nút lịch ở mép phải), để lịch
          mở thẳng dưới ô, canh trái với ô. */}
      <PopoverAnchor asChild>
      {/* Vừa đủ "dd/mm/yyyy" và biểu tượng lịch — một ô ngày kéo hết cột là một khoảng trống dài vô ích. Chỗ nào cần
          rộng khác thì truyền `className` (tailwind-merge ghi đè `max-w`). */}
      <div data-date-input className={cn("relative w-full max-w-40", className)}>
        <Input
          name={name}
          value={text}
          disabled={disabled}
          placeholder={placeholder}
          inputMode="numeric"
          maxLength={10}
          // Biểu tượng lịch ở MÉP PHẢI như ô chọn (mũi tên ⌄) — ô ngày vừa đủ "dd/mm/yyyy" nên lịch vẫn sát chữ ngày.
          className={cn("pe-9 tabular-nums", inputClassName)}
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
        {/* Cùng một khung cho ba lớp (ngày / tháng / năm) — đổi lớp lịch không co giãn. */}
        <div className="h-[21.75rem] w-[15.5rem]">
          {view === "days" ? (
            <Calendar
              mode="single"
              locale={vi}
              weekStartsOn={1}
              selected={selected}
              month={month}
              onMonthChange={setMonth}
              onSelect={pick}
              fromYear={FIRST_YEAR}
              toYear={lastYear}
              components={{
                Caption: ({ displayMonth }) => (
                  <PickerHeader
                    title={`Tháng ${displayMonth.getMonth() + 1}, ${displayMonth.getFullYear()}`}
                    onTitle={() => setView("months")}
                    onPrev={() => setMonth(addMonths(displayMonth, -1))}
                    onNext={() => setMonth(addMonths(displayMonth, 1))}
                    prevLabel="Tháng trước"
                    nextLabel="Tháng sau"
                  />
                ),
              }}
              initialFocus
            />
          ) : view === "months" ? (
            <div className="p-3">
              <PickerHeader
                title={String(month.getFullYear())}
                onTitle={() => setView("years")}
                onPrev={() => setMonth(addYears(month, -1))}
                onNext={() => setMonth(addYears(month, 1))}
                prevLabel="Năm trước"
                nextLabel="Năm sau"
                prevDisabled={month.getFullYear() <= FIRST_YEAR}
                nextDisabled={month.getFullYear() >= lastYear}
              />
              <div className="mt-4 grid grid-cols-3 gap-x-1 gap-y-2">
                {Array.from({ length: 12 }, (_, m) => (
                  <GridButton key={m} active={selected?.getFullYear() === month.getFullYear() && selected?.getMonth() === m}
                    current={today.getFullYear() === month.getFullYear() && today.getMonth() === m}
                    onClick={() => { setMonth(setMonthOf(month, m)); setView("days"); }}>
                    Tháng {m + 1}
                  </GridButton>
                ))}
              </div>
            </div>
          ) : (
            <div className="p-3">
              <PickerHeader
                title={`${pageStart} – ${pageStart + 11}`}
                onPrev={() => setPageStart(pageStart - 12)}
                onNext={() => setPageStart(pageStart + 12)}
                prevLabel="12 năm trước"
                nextLabel="12 năm sau"
                prevDisabled={pageStart <= FIRST_YEAR}
                nextDisabled={pageStart + 11 >= lastYear}
              />
              <div className="mt-4 grid grid-cols-3 gap-x-1 gap-y-2">
                {Array.from({ length: 12 }, (_, i) => pageStart + i).map((y) => (
                  <GridButton key={y} active={selected?.getFullYear() === y} current={today.getFullYear() === y}
                    disabled={y < FIRST_YEAR || y > lastYear}
                    onClick={() => { setMonth(setYear(month, y)); setView("months"); }}>
                    {y}
                  </GridButton>
                ))}
              </div>
            </div>
          )}
        </div>
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

/** Đầu một lớp lịch: ‹ tiêu đề ›. Bấm tiêu đề để lên lớp trên (ngày → tháng → năm). */
function PickerHeader({ title, onTitle, onPrev, onNext, prevLabel, nextLabel, prevDisabled, nextDisabled }: {
  title: string;
  onTitle?: () => void;
  onPrev: () => void;
  onNext: () => void;
  prevLabel: string;
  nextLabel: string;
  prevDisabled?: boolean;
  nextDisabled?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-1">
      <Button type="button" variant="ghost" size="icon-sm" aria-label={prevLabel} title={prevLabel} disabled={prevDisabled} onClick={onPrev}>
        <ChevronLeft />
      </Button>
      {onTitle ? (
        <Button type="button" variant="ghost" size="sm" className="h-8 gap-1 px-2.5 text-sm font-semibold" onClick={onTitle}>
          {title}
          <ChevronDown className="text-muted-foreground" />
        </Button>
      ) : (
        <span className="text-sm font-semibold tabular-nums">{title}</span>
      )}
      <Button type="button" variant="ghost" size="icon-sm" aria-label={nextLabel} title={nextLabel} disabled={nextDisabled} onClick={onNext}>
        <ChevronRight />
      </Button>
    </div>
  );
}

/** Ô của lưới tháng / năm: đang chọn tô nền chính, hiện tại viền. */
function GridButton({ active, current, disabled, onClick, children }: {
  active: boolean;
  current: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button type="button" disabled={disabled} onClick={onClick}
      className={cn(
        "h-10 rounded-full text-sm tabular-nums transition-colors outline-none focus-visible:border-ring disabled:pointer-events-none disabled:opacity-40",
        active ? "bg-primary text-primary-foreground font-medium" : "hover:bg-primary/10 hover:text-primary",
        !active && current && "border-primary/40 text-primary border",
      )}>
      {children}
    </button>
  );
}
