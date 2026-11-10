import type { BaseRecord, HttpError } from "@refinedev/core";
import type { UseTableReturnType } from "@refinedev/react-table";
import type { ColumnFiltersState } from "@tanstack/react-table";
import { Check, ListFilter, Minus, X, type LucideIcon } from "lucide-react";
import { useState, type ReactNode } from "react";

import { cn } from "@/shared/lib/utils";
import { Button } from "@/shared/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/shared/ui/popover";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/shared/ui/tooltip";

/**
 * Nút "Bộ lọc" gom các ô lọc phụ (trạng thái, hình thức, thời gian…) vào một hộp bật ra — hàng công cụ chỉ còn ô
 * tìm, lọc chính và việc chính. Số trên nút = số điều kiện đang bật trong `fields`; "Xoá lọc" gỡ đúng các điều kiện đó.
 */
export function FilterPopover<T extends BaseRecord>({ table, fields, children }: {
  table: UseTableReturnType<T, HttpError>;
  /** Các trường lọc nằm trong hộp — để đếm và xoá. */
  fields: string[];
  children: ReactNode;
}) {
  const { setColumnFilters, getState } = table.reactTable;
  const ids = new Set((getState().columnFilters as unknown as { id: string; value: unknown }[])
    .filter((e) => fields.includes(e.id) && e.value != null && e.value !== "")
    .map((e) => e.id));
  return (
    <FilterButton iconOnly count={ids.size}
      onClear={() => setColumnFilters((prev) =>
        (prev as unknown as { id: string }[]).filter((e) => !fields.includes(e.id)) as ColumnFiltersState)}>
      {children}
    </FilterButton>
  );
}

/**
 * Khung nút "Bộ lọc" không gắn bảng — màn tự giữ trạng thái lọc (vd. báo cáo) thì truyền số điều kiện đang bật và
 * cách xoá. Cùng hình dạng với {@link FilterPopover} để mọi màn lọc giống nhau.
 */
export function FilterButton({ count, onClear, children, className, contentClassName, align = "start", iconOnly, hint }: {
  count: number;
  /** Chỉ biểu tượng (hàng công cụ chật): chữ "Bộ lọc" hiện khi rê chuột, số điều kiện thành chấm số ở góc. */
  iconOnly?: boolean;
  /** Lời giải thích khi rê chuột lên nút chỉ biểu tượng — vd. "Lọc theo trạng thái, tình trạng". */
  hint?: string;
  /** Độ rộng hộp khi nội dung rộng hơn mặc định (22rem) — vd. các viên chọn trạng thái. */
  contentClassName?: string;
  /** Hộp bật ra canh theo mép nào của nút — nút nằm cuối hàng thì "end". */
  align?: "start" | "end";
  onClear: () => void;
  children: ReactNode;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const trigger = (
      <PopoverTrigger asChild>
        {iconOnly ? (
          <Button type="button" variant="outline" size="icon" aria-label="Bộ lọc"
            className={cn("relative shrink-0", count && "border-primary/50 text-primary bg-primary/5", className)}>
            <ListFilter />
            {count ? (
              <span className="bg-primary text-primary-foreground ring-background absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[0.625rem] leading-none font-semibold tabular-nums ring-2">
                {count}
              </span>
            ) : null}
          </Button>
        ) : (
          <Button type="button" variant="outline" className={cn(count && "border-primary/50 text-primary", className)}>
            <ListFilter />
            Bộ lọc
            {count ? <span className="bg-primary text-primary-foreground rounded-full px-1.5 text-xs leading-5 tabular-nums">{count}</span> : null}
          </Button>
        )}
      </PopoverTrigger>
  );
  return (
    <Popover open={open} onOpenChange={setOpen}>
      {iconOnly ? (
        <Tooltip delayDuration={200}>
          <TooltipTrigger asChild>{trigger}</TooltipTrigger>
          {open ? null : (
            <TooltipContent side="bottom" sideOffset={4} className="font-medium">
              {hint ?? "Bộ lọc"}{count ? ` · ${count} đang bật` : ""}
            </TooltipContent>
          )}
        </Tooltip>
      ) : trigger}
      <PopoverContent align={align} className={cn("w-[22rem] max-w-[calc(100vw-2rem)] p-0", contentClassName)} onOpenAutoFocus={(e) => e.preventDefault()}>
        {/* Đầu hộp: tên + số ô đang lọc, "Xoá lọc" ngay góc — không cần một dải chân chỉ có một nút. */}
        <div className="bg-surface-subtle flex items-center justify-between gap-2 rounded-t-xl border-b px-4 py-2.5">
          <span className="flex items-center gap-2 text-sm font-semibold">
            <ListFilter className="text-muted-foreground size-4" />
            Bộ lọc
            {count ? <span className="text-muted-foreground text-xs font-normal">· {count} đang bật</span> : null}
          </span>
          {count ? (
            <Button type="button" variant="ghost" size="sm" className="text-primary h-7 px-2" onClick={onClear}>
              <X /> Xoá lọc
            </Button>
          ) : null}
        </div>
        <div className="grid gap-4 p-4">{children}</div>
      </PopoverContent>
    </Popover>
  );
}

/**
 * Một ô trong hộp lọc: nhãn (kèm biểu tượng) phía trên, ô lọc chiếm hết bề ngang. Ô đang lọc (`active`) viền xanh và
 * nhãn có chấm xanh — mở hộp ra là thấy ngay đang lọc theo gì.
 */
export function FilterField({ label, icon: Icon, active, children }: {
  label: string;
  icon?: LucideIcon;
  active?: boolean;
  children: ReactNode;
}) {
  return (
    <div className={cn("grid gap-1.5", active && "[&_[role=combobox]]:border-primary/60 [&_[role=combobox]]:bg-primary/5")}>
      <span className={cn("flex items-center gap-1.5 text-xs font-medium", active ? "text-primary" : "text-muted-foreground")}>
        {Icon ? <Icon className="size-3.5" /> : null}
        {label}
        {active ? <span className="bg-primary size-1.5 rounded-full" aria-label="đang lọc" /> : null}
      </span>
      {children}
    </div>
  );
}

/** Ô tích tự vẽ của hộp lọc (có trạng thái "một phần" cho đầu nhóm) — cả dòng là nút bấm, ô tích chỉ để nhìn. */
export function FilterCheck({ state }: { state: boolean | "some" }) {
  return (
    <span aria-hidden className={cn("flex size-4 shrink-0 items-center justify-center rounded-[4px] border transition-colors",
      state ? "border-primary bg-primary text-primary-foreground" : "border-input bg-card")}>
      {state === "some" ? <Minus className="size-3" strokeWidth={3} /> : state ? <Check className="size-3" strokeWidth={3} /> : null}
    </span>
  );
}

/** Một dòng chọn trong hộp lọc: ô tích + nhãn, gọn như mục menu. */
export function FilterOption({ on, label, onToggle, className }: { on: boolean; label: string; onToggle: () => void; className?: string }) {
  return (
    <button type="button" role="checkbox" aria-checked={on} onClick={onToggle} title={label}
      className={cn("hover:bg-accent flex h-7 min-w-0 items-center gap-2 rounded-md px-2 text-left text-[0.8125rem] transition-colors",
        on ? "text-foreground font-medium" : "text-muted-foreground", className)}>
      <FilterCheck state={on} />
      <span className="truncate">{label}</span>
    </button>
  );
}

export type FilterChoice = { value: string; label: string };

/**
 * Danh sách lựa chọn của một ô lọc — dáng của bộ lọc màn Thiết bị (ô tích, hai cột khi nhãn ngắn, dài thì cuộn).
 * Chọn MỘT giá trị (API lọc mỗi trường theo một giá trị): bấm mục khác là đổi, bấm lại mục đang chọn là bỏ lọc.
 */
export function ChoiceList({ value, onChange, options, columns }: {
  value: string | null | undefined;
  onChange: (v: string | null) => void;
  options: FilterChoice[];
  /** Mặc định: hai cột khi mọi nhãn ngắn, một cột khi có nhãn dài. */
  columns?: 1 | 2;
}) {
  const cols = columns ?? (options.every((o) => o.label.length <= 16) ? 2 : 1);
  return (
    <div className={cn("-mx-2 grid max-h-[17rem] overflow-y-auto pe-1 [scrollbar-width:thin]", cols === 2 && "grid-cols-2")}>
      {options.map((o) => (
        <FilterOption key={o.value} on={value === o.value} label={o.label}
          onToggle={() => onChange(value === o.value ? null : o.value)} />
      ))}
    </div>
  );
}

/** {@link ChoiceList} gắn với một cột lọc của bảng (`setColumnFilters`, toán tử `eq`). */
export function OptionChoices<T extends BaseRecord>({ table, field, options, columns }: {
  table: UseTableReturnType<T, HttpError>;
  field: string;
  options: FilterChoice[];
  columns?: 1 | 2;
}) {
  const { setColumnFilters, getState } = table.reactTable;
  const active = (getState().columnFilters as unknown as { id: string; value: unknown }[]).find((e) => e.id === field)?.value;
  return (
    <ChoiceList columns={columns} options={options}
      value={active != null && active !== "" ? String(active) : null}
      onChange={(v) => setColumnFilters((prev) => {
        const others = (prev as unknown as { id: string }[]).filter((e) => e.id !== field);
        return (v == null ? others : [...others, { id: field, operator: "eq", value: v }]) as ColumnFiltersState;
      })} />
  );
}
