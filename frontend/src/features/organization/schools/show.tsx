import { useCustom, useShow } from "@refinedev/core";
import { useState } from "react";
import { useSearchParams } from "react-router";

import { LoadingOverlay } from "@/shared/components/layout/loading-overlay";
import { ShowView, ShowViewHeader } from "@/shared/components/views/show-view";
import { API_URL } from "@/shared/api/constants";
import { customResult } from "@/shared/hooks/use-custom-result";
import type { School } from "@/domains/school/types";
import { type SchoolStats } from "@/features/organization/explorer/panels";
import { SchoolWorkspace } from "@/features/organization/explorer/school-workspace";
import { QueryError } from "@/shared/components/query-error";

/**
 * Trang riêng của MỘT trường: hồ sơ, sáu chỉ số, và năm bảng con của trường.
 *
 * <p>Trước đây những thứ này nằm ở nửa phải của màn Tổng quan, còn trang này
 * chỉ có hồ sơ. Hai nơi cùng nói về một trường mà nói khác nhau, nên người
 * dùng phải nhớ "muốn xem phòng thì vào Tổng quan, muốn xem ngày tạo thì vào
 * trang trường" — một luật không ai đoán ra và không có gì gợi ý.
 *
 * <p>Chỉ số lấy từ `school_overview/{id}` chứ không tính lại ở đây: đó là
 * cùng một endpoint mà màn Tổng quan gộp cho toàn ngành, nên "thiết bị" ở hai
 * chỗ không thể đếm khác nhau. Trang mở thẳng từ URL cũng là lý do phải có
 * endpoint riêng — không còn danh sách nào đã tải sẵn để lấy số ra.
 */
export const SchoolShow = () => {
  const { result: record, query } = useShow<School>({});
  const { isLoading } = query;

  // Tab nằm trên địa chỉ để một liên kết mở đúng bảng cần xem — cây Tổng quan
  // dùng chính nó cho nút Cán bộ và Thiết bị.
  const [params, setParams] = useSearchParams();
  const [fallbackTab, setFallbackTab] = useState("classes");
  const tab = params.get("tab") ?? fallbackTab;
  const setTab = (t: string) => {
    setFallbackTab(t);
    setParams(
      (p) => {
        p.set("tab", t);
        return p;
      },
      { replace: true }
    );
  };

  // Không khai kiểu cho `useCustom`: nó đòi `id` khác rỗng, mà `SchoolStats`
  // dùng `id` rỗng cho dòng tổng. Ép kiểu ở chỗ đọc, và đi qua `customResult`
  // vì "chưa có dữ liệu" của `useCustom` là một đối tượng rỗng ĐÃ ĐÓNG BĂNG
  // chứ không phải `undefined` — nó truthy, nên mọi guard hiển nhiên đều lọt.
  const { result: statsResult, query: statsQuery } = useCustom({
    url: `${API_URL}/school_overview/${record?.id}`,
    method: "get",
    queryOptions: { enabled: Boolean(record?.id) },
  });
  const stats = customResult(statsResult?.data as SchoolStats | undefined, "name");

  // Cùng một khuôn với bàn làm việc của trường ở Tổng quan: thẻ đầu (logo, tên, cấp học, phường, cơ quan
  // quản lý; nút "Hồ sơ trường"), rồi các tab mang số đếm của chính chúng — không còn hàng sáu ô chỉ số và
  // một lưới hồ sơ đầy ô "—" ở giữa.
  return (
    <ShowView>
      <ShowViewHeader />
      {(query.isError || statsQuery.isError) && !stats ? (
        <QueryError
          error={query.error ?? statsQuery.error}
          onRetry={() => void (query.isError ? query.refetch() : statsQuery.refetch())}
          retrying={query.isFetching || statsQuery.isFetching}
        />
      ) : (
      <LoadingOverlay loading={isLoading || !stats}>
        {stats ? <SchoolWorkspace stats={stats} tab={tab} onTab={setTab} /> : <div className="min-h-64" />}
      </LoadingOverlay>
      )}
    </ShowView>
  );
};
