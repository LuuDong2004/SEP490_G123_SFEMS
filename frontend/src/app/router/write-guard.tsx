import { useCan, useNavigation, useResourceParams } from "@refinedev/core";
import type { ReactNode } from "react";
import { Navigate } from "react-router";

import { Forbidden } from "@/shared/components/layout/forbidden";
import { FullPageSpinner } from "@/shared/components/spinner";

/**
 * Gác mọi đường dẫn Thêm / Sửa (`/x/create`, `/x/edit/:id`) theo quyền ghi của tài khoản — gồm cả cổng (quản trị viên chỉ
 * xem dữ liệu nghiệp vụ). Các route chỉ gác `list`, nên gõ địa chỉ hay tải lại trang sửa thì form vẫn mở, bấm Lưu mới nhận
 * lỗi "Thao tác này không được hỗ trợ" (trưởng nhóm 24/11/2026). Không có quyền: trang sửa chuyển sang trang chi tiết, trang
 * thêm báo không có quyền. Máy chủ vẫn là nơi chặn thật.
 */
export function WriteGuard({ children }: { children: ReactNode }) {
  const { resource, action, id } = useResourceParams();
  const { showUrl } = useNavigation();
  const writing = !!resource && (action === "create" || action === "edit" || action === "clone");
  const { data } = useCan({ resource: resource?.name ?? "", action: action ?? "", queryOptions: { enabled: writing } });
  if (!writing) return <>{children}</>;
  if (!data) return <FullPageSpinner label="Đang tải" />;
  if (data.can) return <>{children}</>;
  return action !== "create" && resource.show && id != null
    ? <Navigate to={showUrl(resource.name, id)} replace />
    : <Forbidden />;
}
