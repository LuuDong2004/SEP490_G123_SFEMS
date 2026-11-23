import { useQuery } from "@tanstack/react-query";

import { kyInstance } from "@/shared/api/data";

/**
 * Năm học của một trường đã chốt chưa (278) — màn khai dữ liệu loại A (lớp, phân công, điều chỉnh) chỉ xem khi đã chốt;
 * máy chủ cũng chặn ghi.
 */
export function useYearLock(schoolId: number | null, yearId: number | null): { closed: boolean } {
  const { data } = useQuery({
    queryKey: ["school_year_profiles", "lock", schoolId ?? "own", yearId],
    enabled: yearId != null,
    queryFn: ({ signal }) => kyInstance.get("school_year_profiles/lock", {
      signal,
      searchParams: { yearId: String(yearId), ...(schoolId ? { schoolId: String(schoolId) } : {}) },
    }).json<{ closed: boolean }>(),
  });
  return { closed: data?.closed ?? false };
}
