import { useCan, useShow } from "@refinedev/core";
import { Link } from "react-router";

import { MANAGING_BODY_TYPE_SHORT_LABELS } from "@/domains/department-of-education/types";

import { LoadingOverlay } from "@/shared/components/layout/loading-overlay";
import {
  ShowView,
  ShowViewHeader,
} from "@/shared/components/views/show-view";
import { Badge } from "@/shared/ui/badge";
import { FormPanel } from "@/shared/components/form/form-panel";
import { FormSection } from "@/shared/components/form/form-section";
import { ReadField } from "@/shared/components/form/read-field";
import type { User } from "@/domains/user/types";
import { STATUS_LABELS } from "@/domains/user/types";
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
              <ReadField label="Cơ quan quản lý" className="@md:col-span-2">
                {record?.managingBody ? (
                  <Link to={`/departments_of_education/show/${record.managingBody.id}`} className="hover:underline">
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
            <ReadField label="Vai trò">
              <div className="flex flex-wrap gap-2">
                {record?.roles?.length ? (
                  record.roles.map((role) => (
                    <Badge key={role.id} variant="outline">
                      {role.name}
                      <span className="text-muted-foreground ml-1 font-mono text-[10px]">{role.code}</span>
                    </Badge>
                  ))
                ) : (
                  <span className="text-muted-foreground">Không có</span>
                )}
              </div>
            </ReadField>
          </FormSection>

          <p className="text-muted-foreground flex flex-wrap gap-x-6 text-xs">
            <span>Tạo lúc <span className="text-foreground">{record?.createdAt ? formatDateTime(record.createdAt) : "—"}</span></span>
            <span>Sửa lần cuối <span className="text-foreground">{formatEditedAt(record)}</span></span>
          </p>
        </FormPanel>
        {/* Phiên đang mở và lịch sử đăng nhập của tài khoản (QLTB-242). */}
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
