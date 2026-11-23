import { useShow } from "@refinedev/core";

import { LoadingOverlay } from "@/shared/components/layout/loading-overlay";
import {
  ShowView,
  ShowViewHeader,
} from "@/shared/components/views/show-view";
import { Badge } from "@/shared/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/shared/ui/card";
import { formatDateTime } from "@/shared/lib/format";
import type { EducationLevel } from "@/domains/education-level/types";
import { ACTIVE_LABELS } from "@/domains/education-level/types";

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-muted-foreground text-xs">{label}</span>
      <div className="text-foreground text-sm font-medium">{children}</div>
    </div>
  );
}

export const EducationLevelShow = () => {
  const { result: record, query } = useShow<EducationLevel>({});
  const { isLoading } = query;

  return (
    <ShowView>
      {/* Header là chỗ có breadcrumb, nút Sửa, Xoá và Tải lại. Quên nó thì
          trang hiện ra không có đường ra nào và không có lỗi nào. */}
      <ShowViewHeader />
      <LoadingOverlay loading={isLoading}>
        <Card>
          <CardHeader>
            <CardTitle className="text-xl">{record?.name ?? "—"}</CardTitle>
            <CardDescription>
              Cấp học là danh mục dùng chung cho mọi trường.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-6 sm:grid-cols-2">
            <Field label="Mã">
              <span className="font-mono text-xs font-medium">
                {record?.code ?? "—"}
              </span>
            </Field>
            <Field label="Tên viết tắt">{record?.shortName ?? "—"}</Field>
            <Field label="Thứ tự">
              <span className="tabular-nums">{record?.sortOrder ?? "—"}</span>
            </Field>
            <Field label="Trạng thái">
              {record ? (
                <Badge variant={record.active ? "success" : "neutral"}>
                  {ACTIVE_LABELS[record.active ? "true" : "false"]}
                </Badge>
              ) : (
                "—"
              )}
            </Field>
            <Field label="Ghi chú">{record?.note ?? "—"}</Field>
            <Field label="Ngày tạo">
              {record?.createdAt ? formatDateTime(record.createdAt) : "—"}
            </Field>
            <Field label="Cập nhật lần cuối">
              {record?.updatedAt ? formatDateTime(record.updatedAt) : "—"}
            </Field>
          </CardContent>
        </Card>
      </LoadingOverlay>
    </ShowView>
  );
};
