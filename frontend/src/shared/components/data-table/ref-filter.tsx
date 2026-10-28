import type { BaseRecord, HttpError } from "@refinedev/core";
import type { UseTableReturnType } from "@refinedev/react-table";
import type { ColumnFiltersState } from "@tanstack/react-table";

import { AsyncCombobox } from "@/shared/components/form/async-combobox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/ui/select";
import { usePerspective } from "@/shared/hooks/use-perspective";

/**
 * Ô lọc danh sách theo MỘT bản ghi tham chiếu (trường, cơ quan quản lý, cấp học…). Là lọc của máy chủ
 * (`<field>=<id>`), nên số đếm và phân trang vẫn đúng; ô chọn tìm và tải theo trang ở máy chủ, dùng
 * được cả với gần nghìn trường.
 */
export function RefFilter<T extends BaseRecord>({ table, field, resource, all, searchPlaceholder, className = "w-56" }: {
  table: UseTableReturnType<T, HttpError>;
  /** Tên tham số lọc, vd. `school.id`. */
  field: string;
  resource: string;
  /** Chữ khi chưa lọc, vd. "Mọi trường". */
  all: string;
  searchPlaceholder?: string;
  className?: string;
}) {
  // Ghi qua `columnFilters` của TanStack như ô tìm nhanh, không qua `refineCore.setFilters`: `useTable` dựng
  // lại bộ lọc lõi từ `columnFilters` mỗi lần đổi, nên bộ lọc đặt thẳng vào lõi bị xoá ngay sau đó.
  const { setColumnFilters, getState } = table.reactTable;
  const entries = getState().columnFilters as unknown as { id: string; value: unknown }[];
  const active = entries.find((e) => e.id === field)?.value;
  const value = active != null && active !== "" ? Number(active) : null;
  return (
    <div className={className}>
      <AsyncCombobox<{ id: number; name: string }>
        resource={resource}
        value={value}
        onChange={(id) =>
          setColumnFilters((prev) => {
            const others = (prev as unknown as { id: string }[]).filter((e) => e.id !== field);
            return (id == null ? others : [...others, { id: field, operator: "eq", value: id }]) as ColumnFiltersState;
          })
        }
        labelOf={(x) => x.name}
        placeholder={all}
        clearLabel={all}
        searchPlaceholder={searchPlaceholder}
      />
    </div>
  );
}

/**
 * Lọc theo trường — chỉ có ở góc nhìn của cơ quan quản lý và quản trị viên: tài khoản của một trường chỉ
 * thấy dữ liệu của trường mình, không có gì để lọc.
 */
export function SchoolFilter<T extends BaseRecord>({ table }: { table: UseTableReturnType<T, HttpError> }) {
  const { perspective } = usePerspective();
  if (perspective === "school") return null;
  return <RefFilter table={table} field="school.id" resource="schools" all="Mọi trường" searchPlaceholder="Tìm trường…" />;
}

const ANY = "__any__";

/**
 * Ô lọc theo MỘT giá trị trong danh sách cố định (trạng thái, năm…). Như {@link RefFilter}: lọc ở máy chủ,
 * ghi qua `columnFilters`.
 */
export function OptionFilter<T extends BaseRecord>({ table, field, all, options, className = "w-44" }: {
  table: UseTableReturnType<T, HttpError>;
  field: string;
  /** Chữ khi chưa lọc, vd. "Mọi trạng thái". */
  all: string;
  options: { value: string; label: string }[];
  className?: string;
}) {
  const { setColumnFilters, getState } = table.reactTable;
  const active = (getState().columnFilters as unknown as { id: string; value: unknown }[]).find((e) => e.id === field)?.value;
  return (
    <Select
      value={active != null && active !== "" ? String(active) : ANY}
      onValueChange={(v) =>
        setColumnFilters((prev) => {
          const others = (prev as unknown as { id: string }[]).filter((e) => e.id !== field);
          return (v === ANY ? others : [...others, { id: field, operator: "eq", value: v }]) as ColumnFiltersState;
        })
      }
    >
      <SelectTrigger className={className} aria-label={all}><SelectValue /></SelectTrigger>
      <SelectContent>
        <SelectItem value={ANY}>{all}</SelectItem>
        {options.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
      </SelectContent>
    </Select>
  );
}

/**
 * Ô SẮP XẾP của một danh sách — tiêu đề cột không bấm để xếp được (bỏ toàn ứng dụng), nên cách xếp là
 * một ô chọn trên hàng công cụ. Mỗi lựa chọn là một cặp trường + chiều; máy chủ xếp (`_sort`, `_order`).
 */
export function SortSelect<T extends BaseRecord>({ table, options, className = "w-48" }: {
  table: UseTableReturnType<T, HttpError>;
  options: { label: string; field: string; order: "asc" | "desc" }[];
  className?: string;
}) {
  const current = table.refineCore.sorters?.[0];
  const key = (o: { field: string; order: string }) => `${o.field}:${o.order}`;
  const value = current ? key(current) : key(options[0]);
  return (
    <Select
      value={options.some((o) => key(o) === value) ? value : key(options[0])}
      onValueChange={(v) => {
        const o = options.find((x) => key(x) === v);
        if (o) table.refineCore.setSorters([{ field: o.field, order: o.order }]);
      }}
    >
      <SelectTrigger className={className} aria-label="Sắp xếp"><SelectValue /></SelectTrigger>
      <SelectContent>
        {options.map((o) => <SelectItem key={key(o)} value={key(o)}>{o.label}</SelectItem>)}
      </SelectContent>
    </Select>
  );
}
