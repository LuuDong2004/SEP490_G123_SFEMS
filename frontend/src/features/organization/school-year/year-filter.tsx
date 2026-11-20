import { useList } from "@refinedev/core";
import { CalendarRange } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router";

import { IconFilter } from "@/shared/components/data-table/icon-filter";
import type { SchoolYearOption } from "@/domains/school-year/types";

/** Tên ngắn của năm học: "2026–2027". */
export const yearLabel = (y: Pick<SchoolYearOption, "code" | "name"> | null | undefined) =>
  y ? (y.code ?? y.name).replace("-", "–") : "";

/** Mọi năm học của danh mục, mới nhất trước. */
export function useSchoolYears() {
  const { result, query } = useList<SchoolYearOption>({
    resource: "school_years",
    pagination: { pageSize: 100 },
    sorters: [{ field: "sortOrder", order: "asc" }],
  });
  const years = useMemo(() => [...(result?.data ?? [])].sort((a, b) => b.startDate.localeCompare(a.startDate)), [result]);
  return { years, current: years.find((y) => y.current) ?? null, loading: query.isLoading };
}

/**
 * Năm học đang xem, trên địa chỉ (`?year=`) để gửi liên kết / quay lại được; mặc định năm hiện tại. Trả cả danh sách để ô
 * chọn dùng lại.
 */
export function useYearParam() {
  const { years, current, loading } = useSchoolYears();
  const [params, setParams] = useSearchParams();
  const fromUrl = Number(params.get("year")) || null;
  const [local, setLocal] = useState<number | null>(fromUrl);
  useEffect(() => setLocal(fromUrl), [fromUrl]);
  const id = local ?? current?.id ?? null;
  const setId = (next: number) => {
    setLocal(next);
    setParams((p) => {
      const n = new URLSearchParams(p);
      if (current && next === current.id) n.delete("year");
      else n.set("year", String(next));
      return n;
    }, { replace: true });
  };
  return { id, setId, years, current, year: years.find((y) => y.id === id) ?? null, loading };
}

/** Ô chọn năm học có chữ ("Năm học: 2026–2027 ▾") — năm hiện tại không tính là đang lọc. */
export function YearFilter({ value, onChange, years, current }: {
  value: number | null;
  onChange: (id: number) => void;
  years: SchoolYearOption[];
  current: SchoolYearOption | null;
}) {
  return (
    <IconFilter labeled icon={<CalendarRange />} label="năm học" prefix="Năm học" value={value == null ? null : String(value)}
      baseline={current ? String(current.id) : undefined}
      onChange={(v) => v && onChange(Number(v))}
      groups={[{ items: years.map((y) => ({ key: String(y.id), label: yearLabel(y) + (y.current ? " (hiện tại)" : "") })) }]} />
  );
}
