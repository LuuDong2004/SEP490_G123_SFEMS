import type { BaseRecord, HttpError } from "@refinedev/core";
import type { UseTableReturnType } from "@refinedev/react-table";
import type { ColumnFiltersState } from "@tanstack/react-table";

import { ChevronDown } from "lucide-react";
import { useState } from "react";

import { DateInput } from "@/shared/components/form/date-input";
import { cn } from "@/shared/lib/utils";
import { Button } from "@/shared/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/shared/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/ui/select";

type Kind = "all" | "month" | "quarter" | "year";

const pad = (n: number) => String(n).padStart(2, "0");
const lastDay = (y: number, m: number) => new Date(y, m, 0).getDate();

/** Khoảng ngày [từ, đến] của một kỳ: tháng `n` (1–12), quý `n` (1–4) hoặc cả năm. */
function range(kind: Kind, year: number, n: number): [string, string] | null {
  if (kind === "month") return [`${year}-${pad(n)}-01`, `${year}-${pad(n)}-${pad(lastDay(year, n))}`];
  if (kind === "quarter") {
    const first = (n - 1) * 3 + 1;
    return [`${year}-${pad(first)}-01`, `${year}-${pad(first + 2)}-${pad(lastDay(year, first + 2))}`];
  }
  if (kind === "year") return [`${year}-01-01`, `${year}-12-31`];
  return null;
}

/** Đọc lại kỳ đang lọc từ hai điều kiện `_gte` / `_lte` trên URL (lọc giữ được khi tải lại trang). */
function parse(gte?: string, lte?: string): { kind: Kind; year: number; n: number } {
  const now = new Date();
  if (!gte || !lte) return { kind: "all", year: now.getFullYear(), n: now.getMonth() + 1 };
  const [y, m] = gte.split("-").map(Number);
  const [, m2] = lte.split("-").map(Number);
  if (m === 1 && m2 === 12) return { kind: "year", year: y, n: 1 };
  if (m2 - m === 2 && (m - 1) % 3 === 0) return { kind: "quarter", year: y, n: (m - 1) / 3 + 1 };
  return { kind: "month", year: y, n: m };
}

/**
 * Lọc danh sách phiếu theo THÁNG / QUÝ / NĂM của một ô ngày (vd ngày đề nghị ghi giảm, "sổ theo dõi"
 * xem lại theo kỳ). Là lọc của máy chủ (`<field>_gte` / `<field>_lte`), nên đếm, phân trang và xuất "tất cả"
 * đều theo kỳ đang chọn. Ghi qua `columnFilters` của TanStack như các ô lọc khác (`ref-filter.tsx`) — đặt thẳng
 * vào `refineCore` thì `useTable` xoá ngay ở lần render sau.
 */
export function PeriodFilter<T extends BaseRecord>({ table, field }: { table: UseTableReturnType<T, HttpError>; field: string }) {
  const { setColumnFilters, getState } = table.reactTable;
  const entries = getState().columnFilters as unknown as { id: string; value: unknown; operator?: string }[];
  const find = (op: string) => {
    const f = entries.find((x) => x.id === field && x.operator === op);
    return f?.value ? String(f.value) : undefined;
  };
  const current = parse(find("gte"), find("lte"));
  const thisYear = new Date().getFullYear();
  const years = Array.from({ length: 6 }, (_, i) => thisYear - i);

  const apply = (kind: Kind, year: number, n: number) => {
    const r = range(kind, year, n);
    setColumnFilters((prev) => {
      const others = (prev as unknown as { id: string }[]).filter((e) => e.id !== field);
      return (r
        ? [...others, { id: field, operator: "gte", value: r[0] }, { id: field, operator: "lte", value: r[1] }]
        : others) as ColumnFiltersState;
    });
  };

  return (
    <div className="flex items-center gap-1.5">
      <Select
        value={current.kind}
        onValueChange={(v) => {
          const kind = v as Kind;
          const now = new Date();
          apply(kind, current.year, kind === "quarter" ? Math.floor(now.getMonth() / 3) + 1 : now.getMonth() + 1);
        }}
      >
        <SelectTrigger className="w-36" aria-label="Kỳ">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Mọi thời gian</SelectItem>
          <SelectItem value="month">Theo tháng</SelectItem>
          <SelectItem value="quarter">Theo quý</SelectItem>
          <SelectItem value="year">Theo năm</SelectItem>
        </SelectContent>
      </Select>
      {current.kind === "month" || current.kind === "quarter" ? (
        <Select value={String(current.n)} onValueChange={(v) => apply(current.kind, current.year, Number(v))}>
          <SelectTrigger className="w-28" aria-label={current.kind === "month" ? "Tháng" : "Quý"}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Array.from({ length: current.kind === "month" ? 12 : 4 }, (_, i) => (
              <SelectItem key={i} value={String(i + 1)}>
                {current.kind === "month" ? `Tháng ${i + 1}` : `Quý ${["I", "II", "III", "IV"][i]}`}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : null}
      {current.kind !== "all" ? (
        <Select value={String(current.year)} onValueChange={(v) => apply(current.kind, Number(v), current.n)}>
          <SelectTrigger className="w-24" aria-label="Năm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {years.map((y) => (
              <SelectItem key={y} value={String(y)}>
                {y}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : null}
    </div>
  );
}

const vnDate = (iso: string) => iso.split("-").reverse().join("/");
/** Hôm nay theo giờ máy, "yyyy-MM-dd". */
const todayIso = () => {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

/**
 * Lọc theo NGÀY trong một ô (trưởng nhóm 15/11/2026: "gộp chung, một ô thôi … chỉ cần ngày tháng năm"): nút
 * "Thời gian: Mọi lúc" mở ra hai ô ngày Từ ngày / Đến ngày (gõ dd/mm/yyyy hoặc chọn lịch). Để trống một đầu là không
 * chặn đầu đó. Cùng điều kiện máy chủ với `PeriodFilter` (`<field>_gte` / `<field>_lte`), tải lại trang vẫn giữ.
 */
export function PeriodSelect<T extends BaseRecord>({ table, field, label = "Thời gian" }: {
  table: UseTableReturnType<T, HttpError>;
  field: string;
  label?: string;
}) {
  const { setColumnFilters, getState } = table.reactTable;
  const [open, setOpen] = useState(false);
  const entries = getState().columnFilters as unknown as { id: string; value: unknown; operator?: string }[];
  const find = (op: string) => {
    const f = entries.find((x) => x.id === field && x.operator === op);
    return f?.value ? String(f.value) : null;
  };
  const from = find("gte");
  const to = find("lte");
  const set = (nextFrom: string | null, nextTo: string | null) => setColumnFilters((prev) => {
    const others = (prev as unknown as { id: string }[]).filter((e) => e.id !== field);
    return [
      ...others,
      ...(nextFrom ? [{ id: field, operator: "gte", value: nextFrom }] : []),
      ...(nextTo ? [{ id: field, operator: "lte", value: nextTo }] : []),
    ] as ColumnFiltersState;
  });
  const text = from && to ? `${vnDate(from)} – ${vnDate(to)}` : from ? `từ ${vnDate(from)}` : to ? `đến ${vnDate(to)}` : "Mọi lúc";
  const filtering = !!(from || to);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" aria-label={`Lọc theo ${label.toLowerCase()}`}
          className={cn("max-w-80 min-w-0 shrink-0 justify-start font-normal", filtering && "border-primary/50 text-primary bg-primary/5")}>
          <span className="min-w-0 truncate">{label}: {text}</span>
          <ChevronDown className="ms-auto size-4 opacity-60" />
        </Button>
      </PopoverTrigger>
      {/* Không tự đặt con trỏ vào ô đầu: ô ngày bật lịch khi được focus, che mất ô "Đến ngày". */}
      <PopoverContent align="start" className="w-auto p-3" onOpenAutoFocus={(e) => e.preventDefault()}>
        <div className="grid grid-cols-[auto_10rem] items-center gap-x-3 gap-y-2 text-sm">
          <span className="text-muted-foreground">Từ ngày</span>
          {/* Chọn "Từ ngày" mà "Đến ngày" còn trống thì "Đến ngày" tự là hôm nay; người dùng sửa thì giữ theo họ
              (trưởng nhóm 15/11/2026). */}
          <DateInput value={from} onChange={(v) => set(v, to ?? (v ? todayIso() : null))} />
          <span className="text-muted-foreground">Đến ngày</span>
          <DateInput value={to} onChange={(v) => set(from, v)} />
        </div>
        {to && from && to < from ? <p className="text-destructive mt-2 text-xs">Đến ngày phải sau từ ngày</p> : null}
        <div className="mt-3 flex justify-end gap-2">
          {filtering ? (
            <Button type="button" variant="ghost" size="sm" onClick={() => set(null, null)}>Xoá lọc</Button>
          ) : null}
          <Button type="button" size="sm" onClick={() => setOpen(false)}>Xong</Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
