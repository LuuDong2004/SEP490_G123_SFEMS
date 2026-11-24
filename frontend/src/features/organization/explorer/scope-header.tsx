import { useCustom } from "@refinedev/core";

import { API_URL } from "@/shared/api/constants";
import { customResult } from "@/shared/hooks/use-custom-result";
import type { BodyStats } from "@/features/organization/explorer/body-grid";
import { KpiRow, type SchoolStats } from "@/features/organization/explorer/panels";

/**
 * Thẻ đầu của trục trường học — tên phạm vi, số trường, cơ sở, khối nhà, phòng. Cùng thẻ (`KpiRow`) và cùng nguồn
 * (`/school_overview`) với Tổng quan các trường, cho các màn khác của nhóm Trường học (Danh sách trường).
 */
export function SchoolScopeHeader() {
  const { result, query } = useCustom<{ totals: SchoolStats; total: number }>({
    url: `${API_URL}/school_overview`,
    method: "get",
    config: { query: { _start: 0, _end: 1 } },
  });
  const { result: bodyResult } = useCustom<BodyStats[]>({ url: `${API_URL}/school_overview/bodies`, method: "get" });
  const overview = customResult(result?.data, "totals") as { totals: SchoolStats; total: number } | undefined;
  const bodies = Array.isArray(bodyResult?.data) ? (bodyResult.data as BodyStats[]) : [];
  if (query.isLoading || !overview?.totals) return null;
  const onlyBody = bodies.length === 1 && bodies[0].id != null ? bodies[0] : null;
  return (
    <KpiRow
      s={overview.totals}
      schools={overview.total}
      title={onlyBody ? onlyBody.name : "Sở Giáo dục và Đào tạo TP. Hồ Chí Minh"}
      meta={onlyBody ? null : `${new Intl.NumberFormat("vi-VN", { useGrouping: false }).format(bodies.filter((b) => b.id != null).length)} cơ quan quản lý có trường`}
    />
  );
}
