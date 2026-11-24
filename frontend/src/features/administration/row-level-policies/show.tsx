import { useCan, useShow } from "@refinedev/core";
import { TriangleAlert } from "lucide-react";

import { FormSection } from "@/shared/components/form/form-section";
import { ReadField } from "@/shared/components/form/read-field";
import { LoadingOverlay } from "@/shared/components/layout/loading-overlay";
import {
  ShowView,
  ShowViewHeader,
} from "@/shared/components/views/show-view";
import { isRecordMissing, RecordNotFound } from "@/shared/components/views/record-not-found";
import { Alert, AlertDescription } from "@/shared/ui/alert";
import { Badge } from "@/shared/ui/badge";
import {
  Card,
  CardContent,
} from "@/shared/ui/card";
import { Separator } from "@/shared/ui/separator";
import { ExplainPanel } from "@/features/administration/row-level-policies/explain-panel";
import { readCondition } from "@/domains/row-level-policy/read-condition";
import type { RowLevelPolicy } from "@/domains/row-level-policy/types";
import { actionLabel, kindLabel } from "@/domains/row-level-policy/types";
import { humanizeResource } from "@/domains/permission/types";
import { formatDateTime, editedAt } from "@/shared/lib/format";

export const RowLevelPolicyShow = () => {
  const { result: record, query } = useShow<RowLevelPolicy>({});
  const { isLoading } = query;

  // The explain and simulate endpoints take somebody else's account id, so they
  // require users:read on top of the policy permission. Without it they would
  // 403, so the panel is not offered rather than offered and then refused.
  const { data: canReadUsers } = useCan({ resource: "users", action: "list" });
  const mayExplain = canReadUsers?.can ?? false;

  // Mở thẳng một id không có (gõ tay, liên kết cũ, ngoài phạm vi): báo "Không tìm thấy", không vẽ trang trống.
  if (isRecordMissing(query)) {
    return (
      <ShowView>
        <ShowViewHeader canEdit={false} canDelete={false} />
        <RecordNotFound what="phạm vi dữ liệu" />
      </ShowView>
    );
  }

  return (
    <ShowView>
      <ShowViewHeader />

      <Card>
        <CardContent className="@container">
          <FormSection title="Chính sách này là gì" compact>
            <div className="grid items-start gap-5 @md:grid-cols-2 @3xl:grid-cols-4">
              <ReadField label="Tên" className="@md:col-span-2">{record?.name}</ReadField>
              <ReadField label="Loại">
                {record ? <Badge variant={record.kind === "FILTER" ? "default" : "secondary"}>{kindLabel(record.kind)}</Badge> : null}
              </ReadField>
              <ReadField label="Trạng thái">
                {record ? <Badge variant={record.enabled ? "success" : "neutral"}>{record.enabled ? "Đang bật" : "Tắt"}</Badge> : null}
              </ReadField>
              <ReadField label="Tài nguyên">
                {record ? humanizeResource(record.resource) : null}
              </ReadField>
              <ReadField label="Hành động">{record ? actionLabel(record.action) : null}</ReadField>
              <ReadField label="Vai trò" className="@md:col-span-2">
                {record ? (record.role ? <span className="font-mono">{record.role.code}</span> : "Mọi người") : null}
              </ReadField>
            </div>
          </FormSection>
        </CardContent>

        <CardContent>
          <LoadingOverlay loading={isLoading}>
            <div className="flex flex-col gap-6">
              {record?.invalidReason && (
                <Alert variant="destructive">
                  <TriangleAlert className="h-4 w-4" />
                  <AlertDescription>
                    Đã bị tắt vì điều kiện không còn hợp lệ:{" "}
                    {record.invalidReason}
                    {record.kind === "FILTER" && (
                      <>
                        {" "}
                        Vì đây là bộ lọc, mọi thao tác trên{" "}
                        <span className="font-mono">
                          {record.resource}:{record.action}
                        </span>{" "}
                        đều bị từ chối cho tới khi sửa xong.
                      </>
                    )}
                  </AlertDescription>
                </Alert>
              )}

              <div className="flex flex-col gap-1">
                <span className="text-muted-foreground text-xs">
                  Tác dụng
                </span>
                <p className="text-sm">
                  {record?.kind === "FILTER"
                    ? "Thu hẹp dữ liệu của mọi người, giữ vai trò nào cũng vậy."
                    : `Mở thêm dữ liệu cho ${record?.role?.code ?? "một vai trò"}. Phạm vi của các vai trò cộng lại với nhau.`}
                </p>
              </div>

              {record?.description && (
                <div className="flex flex-col gap-1">
                  <span className="text-muted-foreground text-xs">
                    Mô tả
                  </span>
                  <p className="text-sm">{record.description}</p>
                </div>
              )}

              <Separator />

              <div className="flex flex-col gap-2">
                <span className="text-muted-foreground text-xs">
                  Điều kiện
                </span>
                <p className="text-sm">
                  {record ? readCondition(record.scope) : "—"}
                </p>
                {/*
                  The stored tree as well as the sentence. Anybody debugging a
                  policy eventually wants to see exactly what is in the column,
                  and the alternative is opening devtools to find out.
                */}
                <pre className="bg-muted overflow-x-auto rounded-md p-3 text-xs">
                  {record ? JSON.stringify(record.scope, null, 2) : ""}
                </pre>
              </div>

              {record?.action === "write" && (
                <div className="flex flex-col gap-2">
                  <span className="text-muted-foreground text-xs">
                    Sau khi lưu được phép là gì
                  </span>
                  {record.checkScope ? (
                    <>
                      <p className="text-sm">{readCondition(record.checkScope)}</p>
                      <pre className="bg-muted overflow-x-auto rounded-md p-3 text-xs">
                        {JSON.stringify(record.checkScope, null, 2)}
                      </pre>
                    </>
                  ) : (
                    <p className="text-sm">
                      Dùng cùng điều kiện cho dữ liệu sau khi lưu, để không ai
                      chuyển nó ra ngoài phạm vi của mình.
                    </p>
                  )}
                </div>
              )}

              <Separator />

              <div className="text-muted-foreground grid gap-2 text-xs sm:grid-cols-2">
                <span>
                  Tạo bởi {record?.createdBy?.username ?? "—"}
                  {record?.createdAt
                    ? ` lúc ${formatDateTime(record.createdAt)}`
                    : ""}
                </span>
                {editedAt(record) ? (
                  <span>
                    Sửa lần cuối bởi {record?.updatedBy?.username ?? "—"}
                    {` lúc ${formatDateTime(editedAt(record)!)}`}
                  </span>
                ) : null}
              </div>
            </div>
          </LoadingOverlay>
        </CardContent>
      </Card>

      {record && mayExplain && (
        <ExplainPanel resource={record.resource} action={record.action} />
      )}
    </ShowView>
  );
};
