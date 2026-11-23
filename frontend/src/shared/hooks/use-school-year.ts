import { useList } from "@refinedev/core";
import { useEffect, useMemo, useSyncExternalStore } from "react";
import { useSearchParams } from "react-router";

import type { SchoolYearOption } from "@/domains/school-year/types";

/**
 * NĂM HỌC ĐANG LÀM VIỆC của cả hệ thống — chọn MỘT chỗ, ô năm học trên header. Mọi màn có dữ liệu gắn với năm (lớp,
 * phân công, chuẩn tối thiểu theo năm, hồ sơ năm học, kế hoạch, kỳ của báo cáo) đọc từ đây thay vì mỗi màn một ô chọn
 * riêng: đổi năm trên header là cả hệ thống chuyển sang bộ dữ liệu năm đó. Chưa chọn thì là năm hiện tại của danh mục.
 *
 * Nhớ trong tab (sessionStorage) — mở tab mới, đăng nhập lại thì về năm hiện tại, tránh vô tình làm việc trên năm cũ.
 * Liên kết mang `?year=` (gửi cho người khác, quay lại từ một màn khác) đặt năm đó làm năm đang làm việc.
 */
const KEY = "sfems.schoolYear";
const listeners = new Set<() => void>();

function read(): number | null {
  try {
    const raw = window.sessionStorage.getItem(KEY);
    return raw ? Number(raw) || null : null;
  } catch {
    return null;
  }
}

let chosen: number | null = read();

function write(id: number | null) {
  if (id === chosen) return;
  chosen = id;
  try {
    if (id == null) window.sessionStorage.removeItem(KEY);
    else window.sessionStorage.setItem(KEY, String(id));
  } catch {
    // bộ nhớ bị chặn — giữ trong bộ nhớ là đủ
  }
  listeners.forEach((l) => l());
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

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
 * Năm học đang làm việc: `id` (năm đã chọn trên header, chưa chọn thì năm hiện tại), `year` (bản ghi), `setId` (đổi cho
 * cả hệ thống), `past` (năm đã qua — màn ghi nên chuyển sang chỉ xem / cảnh báo).
 */
export function useSchoolYear() {
  const { years, current, loading } = useSchoolYears();
  const picked = useSyncExternalStore(subscribe, () => chosen, () => null);
  // Năm đã chọn không còn trong danh mục (bị xoá, đổi tài khoản) thì về năm hiện tại.
  const valid = picked != null && (loading || years.some((y) => y.id === picked)) ? picked : null;
  const id = valid ?? current?.id ?? null;
  const year = years.find((y) => y.id === id) ?? null;
  const setId = (next: number | null) => write(next != null && current && next === current.id ? null : next);
  return { id, setId, year, years, current, loading, past: !!year && !!current && year.startDate < current.startDate };
}

/**
 * Liên kết có `?year=` thì đặt năm đó làm năm đang làm việc rồi bỏ tham số khỏi địa chỉ — năm sống trên header, không
 * nhân bản trên từng địa chỉ. Gọi một lần ở khung ứng dụng.
 */
export function useYearFromUrl() {
  const [params, setParams] = useSearchParams();
  const fromUrl = Number(params.get("year")) || null;
  useEffect(() => {
    if (fromUrl == null) return;
    write(fromUrl);
    setParams((p) => {
      const n = new URLSearchParams(p);
      n.delete("year");
      return n;
    }, { replace: true });
  }, [fromUrl, setParams]);
}

