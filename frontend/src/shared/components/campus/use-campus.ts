import { useList, type BaseRecord } from "@refinedev/core";
import { useMemo, useSyncExternalStore } from "react";

import { getPinnedCampusId, subscribeToAuthorities } from "@/shared/api/session";
import { usePerspective } from "@/shared/hooks/use-perspective";

/** Cơ sở như các API trả: `/campuses` mang `primaryCampus`, `/equipment_items` mang `primary`. */
export type CampusLike = {
  id: number;
  name?: string | null;
  primaryCampus?: boolean | null;
  primary?: boolean | null;
  branch?: boolean | null;
};

/** Tham số lọc theo cơ sở THỰC của dòng (phòng → khối nhà → cơ sở chính) — máy chủ hiểu ở mọi danh sách CSVC, thiết bị. */
export const CAMPUS_FILTER_FIELD = "campus";

export function kindOf(c: CampusLike): "main" | "branch" | "site" {
  return c.primaryCampus || c.primary ? "main" : c.branch ? "branch" : "site";
}

/** Cơ sở mà tài khoản bị giới hạn trong (`null` = cả trường) — vẽ lại khi quyền được đẩy xuống. */
export function usePinnedCampusId(): number | null {
  return useSyncExternalStore(subscribeToAuthorities, getPinnedCampusId);
}

/** Các cơ sở còn dùng của một trường (vắng `schoolId`: trường của tài khoản — phạm vi dòng tự giới hạn). */
export function useCampusOptions(schoolId?: number | null, enabled = true): CampusLike[] {
  const { result } = useList<CampusLike & BaseRecord>({
    resource: "campuses",
    filters: [
      ...(schoolId ? [{ field: "school.id", operator: "eq" as const, value: schoolId }] : []),
      { field: "active", operator: "eq" as const, value: true },
    ],
    pagination: { pageSize: 100 },
    sorters: [{ field: "sortOrder", order: "asc" }],
    queryOptions: { enabled },
  });
  return useMemo(() => (result?.data ?? []) as CampusLike[], [result]);
}

/**
 * Cột / bộ lọc Cơ sở có nghĩa không: tài khoản trường, chưa bị giới hạn trong một cơ sở, trường có từ hai cơ sở.
 * Trả cả danh sách cơ sở để ô lọc và nhãn dùng lại.
 */
export function useCampusScope(): { show: boolean; campuses: CampusLike[] } {
  const { perspective } = usePerspective();
  const pinned = usePinnedCampusId();
  const school = perspective === "school";
  const campuses = useCampusOptions(null, school);
  return { show: school && pinned == null && campuses.length > 1, campuses };
}

/**
 * Cơ sở thực của một dòng: cơ sở ghi trên nó nếu còn dùng, không thì cơ sở chính (luật của máy chủ,
 * `FacilityCounting.campusJoins`). Danh sách cơ sở chưa về thì trả cơ sở ghi trên dòng.
 */
export function effectiveCampus(own: CampusLike | null | undefined, campuses: CampusLike[]): CampusLike | null {
  if (!campuses.length) return own ?? null;
  const found = own ? campuses.find((c) => c.id === own.id) : undefined;
  return found ?? campuses.find((c) => kindOf(c) === "main") ?? null;
}
