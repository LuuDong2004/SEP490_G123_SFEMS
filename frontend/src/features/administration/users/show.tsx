import { useCan, useShow } from "@refinedev/core";
import { Link } from "react-router";

import { MANAGING_BODY_TYPE_SHORT_LABELS } from "@/domains/department-of-education/types";

import { LoadingOverlay } from "@/shared/components/layout/loading-overlay";
import {
  ShowView,
  ShowViewHeader,
} from "@/shared/components/views/show-view";
import { isRecordMissing, RecordNotFound } from "@/shared/components/views/record-not-found";
import { Badge } from "@/shared/ui/badge";
import { FormPanel } from "@/shared/components/form/form-panel";
import { FormSection } from "@/shared/components/form/form-section";
import { ReadField } from "@/shared/components/form/read-field";
import type { User } from "@/domains/user/types";
import { STATUS_LABELS, USER_TYPE_LABELS, positionLabel } from "@/domains/user/types";
import { USER_STATUS_VARIANTS as STATUS_VARIANTS } from "@/shared/lib/status-variants";
import { formatDateTime, formatEditedAt } from "@/shared/lib/format";
import { SessionsCard } from "@/shared/components/security/sessions-card";
import { LoginHistoryCard } from "./login-history";

/** A never-signed-in account is a fact, not a missing value. */
function formatLastSignIn(value?: string | null) {
  return value ? formatDateTime(value) : "Chưa từng";
}

const GRID = "grid items-start gap-5 @md:grid-cols-2 @3xl:grid-cols-4";

/** Cùng nhóm, cùng lưới với form thêm / sửa tài khoản: bấm Sửa thì ô nằm nguyên chỗ. */
export const UserShow = () => {
  const { result: record, query } = useShow<User>({});
  const { isLoading } = query;
  const mayWrite = useCan({ resource: "users", action: "edit" }).data?.can ?? false;

  // Mở thẳng một id không có (gõ tay, liên kết cũ, ngoài phạm vi): báo "Không tìm thấy", không vẽ trang trống.
  if (isRecordMissing(query)) {
    return (
      <ShowView>
        <ShowViewHeader canEdit={false} canDelete={false} />
        <RecordNotFound what="người dùng" />
      </ShowView>
    );
  }

  return (
    <ShowView>
      <ShowViewHeader />
      <LoadingOverlay loading={isLoading}>
        <FormPanel contentClassName="@container space-y-6">
          <FormSection title="Tài khoản" compact>
            <div className={GRID}>
              <ReadField label="Tên đăng nhập">{record?.username}</ReadField>
              <ReadField label="Email">{record?.email}</ReadField>
              <ReadField label="Họ tên" className="@3xl:col-span-2">{record?.fullName}</ReadField>
              <ReadField label="Trạng thái">
                {record?.status ? (
                  <Badge variant={STATUS_VARIANTS[record.status] ?? "secondary"}>
                    {STATUS_LABELS[record.status] ?? record.status}
                  </Badge>
                ) : null}
              </ReadField>
              <ReadField label="Đăng nhập lần cuối">{formatLastSignIn(record?.lastLoginAt)}</ReadField>
            </div>
          </FormSection>

          <FormSection title="Nơi công tác" compact>
            <div className={GRID}>
              <ReadField label="Loại tài khoản">{record ? USER_TYPE_LABELS[record.userType] : null}</ReadField>
              {record && record.userType !== "SYSTEM" ? (
                <ReadField label="Chức vụ">{positionLabel(record.userType, record.profile?.position) ?? null}</ReadField>
              ) : null}
              <ReadField label="Chức danh">{record?.profile?.jobTitle || null}</ReadField>
              {record?.userType === "SO" ? (
                <ReadField label="Điện thoại cơ quan">{record.profile?.workPhone || null}</ReadField>
              ) : null}
              {record?.userType === "SYSTEM" ? (
                <>
                  <ReadField label="Quản trị cấp cao">{record.profile?.superAdmin ? "Có" : "Không"}</ReadField>
                  <ReadField label="IP được đăng nhập" className="@md:col-span-2">
                    {record.profile?.allowedIps || "Theo danh sách chung"}
                  </ReadField>
                  {record.profile?.note ? (
                    <ReadField label="Ghi chú" className="@md:col-span-2">{record.profile.note}</ReadField>
                  ) : null}
                </>
              ) : null}
              <ReadField label="Cơ quan quản lý" className="@md:col-span-2">
                {record?.managingBody ? (
                  <Link to={`/departments-of-education/show/${record.managingBody.id}`} className="hover:underline">
                    {MANAGING_BODY_TYPE_SHORT_LABELS[record.managingBody.type]} · {record.managingBody.name}
                    <span className="text-muted-foreground ml-2 font-mono text-xs">{record.managingBody.code}</span>
                  </Link>
                ) : (
                  <span className="text-muted-foreground">Không thuộc cơ quan nào</span>
                )}
              </ReadField>
              <ReadField label="Trường công tác" className="@md:col-span-2">
                {record?.school ? (
                  <Link to={`/schools/show/${record.school.id}`} className="hover:underline">
                    {record.school.name}
                    <span className="text-muted-foreground ml-2 font-mono text-xs">{record.school.code}</span>
                  </Link>
                ) : (
                  <span className="text-muted-foreground">Không thuộc trường nào</span>
                )}
              </ReadField>
            </div>
          </FormSection>

          <FormSection title="Phân quyền" compact>
            <div className={GRID}>
              {/* Một vai thì ô rộng bằng một cột như các ô trên; nhiều vai hoặc thẻ hẹp thì hai cột cho đủ chỗ. */}
              <ReadField label="Vai trò" className={(record?.roles?.length ?? 0) > 1 ? "@md:col-span-2" : "@md:col-span-2 @5xl:col-span-1"}>
                <div className="flex flex-wrap gap-2">
                  {record?.roles?.length ? (
                    record.roles.map((role) => (
                      <Badge key={role.id} variant="outline">{role.name}</Badge>
                    ))
                  ) : (
                    <span className="text-muted-foreground">Không có</span>
                  )}
                </div>
              </ReadField>
            </div>
          </FormSection>

          <p className="text-muted-foreground flex flex-wrap gap-x-6 text-xs">
            <span>Tạo lúc <span className="text-foreground">{record?.createdAt ? formatDateTime(record.createdAt) : "không rõ"}</span></span>
            <span>Sửa lần cuối <span className="text-foreground">{formatEditedAt(record)}</span></span>
          </p>
        </FormPanel>
        {/* Phiên đang mở và lịch sử đăng nhập của tài khoản. */}
        {record?.id ? (
          <div className="grid items-start gap-4 lg:grid-cols-2">
            <SessionsCard source={`users/${record.id}/sessions`} endPath={(sid) => `users/${record.id}/sessions/${sid}`}
              canEnd={mayWrite} description="Các thiết bị tài khoản này đang đăng nhập. Đăng xuất một phiên thì thiết bị đó phải đăng nhập lại trong vòng 15 phút." />
            <LoginHistoryCard userId={record.id} />
          </div>
        ) : null}
      </LoadingOverlay>
    </ShowView>
  );
};
