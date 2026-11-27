import { useShow } from "@refinedev/core";

import { LoadingOverlay } from "@/shared/components/layout/loading-overlay";
import {
  ShowView,
  ShowViewHeader,
} from "@/shared/components/views/show-view";
import { isRecordMissing, RecordNotFound } from "@/shared/components/views/record-not-found";
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

  // Mở thẳng một id không có (gõ tay, liên kết cũ, ngoài phạm vi): báo "Không tìm thấy", không vẽ trang trống.
  if (isRecordMissing(query)) {
    return (
      <ShowView>
        <ShowViewHeader canEdit={false} canDelete={false} />
        <RecordNotFound what="cấp học" />
      </ShowView>
    );
  }

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
                {record?.code ?? <span className="text-muted-foreground">Chưa có mã</span>}
              </span>
            </Field>
            <Field label="Tên viết tắt">{record?.shortName ?? <span className="text-muted-foreground">Chưa khai</span>}</Field>
            <Field label="Thứ tự">
              <span className="tabular-nums">{record?.sortOrder ?? <span className="text-muted-foreground">Chưa xếp</span>}</span>
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
            <Field label="Ghi chú">{record?.note ?? <span className="text-muted-foreground">Không có ghi chú</span>}</Field>
            <Field label="Ngày tạo">
              {record?.createdAt ? formatDateTime(record.createdAt) : <span className="text-muted-foreground">Không rõ</span>}
            </Field>
            <Field label="Cập nhật lần cuối">
              {record?.updatedAt ? formatDateTime(record.updatedAt) : <span className="text-muted-foreground">Chưa sửa</span>}
            </Field>
          </CardContent>
        </Card>
      </LoadingOverlay>
    </ShowView>
  );
};
