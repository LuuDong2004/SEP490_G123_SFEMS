import { isRecordMissing, RecordNotFound } from "@/shared/components/views/record-not-found";
import { useForm } from "@refinedev/react-hook-form";
import { useNavigate } from "react-router";
import { ShieldIcon } from "lucide-react";

import { EditView, EditViewHeader } from "@/shared/components/views/edit-view";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Textarea } from "@/shared/ui/textarea";
import { Alert, AlertDescription, AlertTitle } from "@/shared/ui/alert";
import { Badge } from "@/shared/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/shared/ui/form";
import {
  PermissionMatrix,
  type PermissionRef,
} from "@/features/administration/roles/permission-matrix";

/** Một cặp nhãn và giá trị chỉ đọc trong bảng Chi tiết, cùng dạng với trang xem. */
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-muted-foreground text-xs">{label}</span>
      <div className="text-foreground text-sm font-medium">{children}</div>
    </div>
  );
}

/**
 * Sửa vai trò (HT-05). Bên trái là phần được sửa (mã, tên, mô tả), bên phải là những điều API đã
 * định (loại, id, số quyền). Dưới là ma trận quyền; tất cả lưu cùng một lần bấm Lưu.
 */
export const RoleEdit = () => {
  const navigate = useNavigate();

  const {
    refineCore: { onFinish, query },
    ...form
  } = useForm({
    refineCoreProps: {},
  });

  const record = query?.data?.data;
  const isSystemRole = record?.systemRole === true;

  const grantedCount = form.watch("permissions")?.length ?? 0;

  function onSubmit(values: Record<string, unknown>) {
    const permissions = Array.isArray(values.permissions)
      ? (values.permissions as PermissionRef[]).map((p) => ({ id: p.id }))
      : values.permissions;

    // API từ chối đổi mã của vai hệ thống; không gửi mã lên là nói rõ ý định thay vì nhận 409.
    const { code, ...rest } = values as Record<string, unknown>;
    const payload = isSystemRole ? { ...rest, permissions } : { ...rest, code, permissions };

    onFinish(payload);
  }

  if (isRecordMissing(query)) {
    return (
      <EditView>
        <EditViewHeader />
        <RecordNotFound what="vai trò" />
      </EditView>
    );
  }

  return (
    <EditView>
      <EditViewHeader />
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          {isSystemRole && (
            <Alert>
              <ShieldIcon className="size-4" />
              <AlertTitle>Vai trò hệ thống</AlertTitle>
              <AlertDescription>
                Vai trò này không đổi mã và không xoá được. Quyền vẫn sửa được, nhưng cẩn thận kẻo
                tự bỏ quyền của chính bạn.
              </AlertDescription>
            </Alert>
          )}

          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_18rem] lg:items-start">
            <Card>
              <CardHeader>
                <CardTitle>Thông tin vai trò</CardTitle>
                <CardDescription>Mã, tên và mô tả của vai trò.</CardDescription>
              </CardHeader>
              <CardContent className="grid items-start gap-x-4 gap-y-5 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="code"
                  rules={{
                    required: "Bắt buộc nhập mã",
                    pattern: {
                      value: /^[A-Z][A-Z0-9_]*$/,
                      message: "Chỉ gồm chữ in hoa, chữ số và gạch dưới, bắt đầu bằng chữ cái",
                    },
                  }}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Mã</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          value={field.value ?? ""}
                          className="font-mono"
                          disabled={isSystemRole}
                          onChange={(e) => field.onChange(e.target.value.toUpperCase())}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="name"
                  rules={{ required: "Bắt buộc nhập tên" }}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Tên</FormLabel>
                      <FormControl>
                        <Input {...field} value={field.value ?? ""} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem className="sm:col-span-2">
                      <FormLabel>Mô tả</FormLabel>
                      <FormControl>
                        <Textarea {...field} value={field.value ?? ""} rows={3} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Chi tiết</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                <Field label="Loại">
                  {isSystemRole ? (
                    <Badge variant="secondary">Hệ thống</Badge>
                  ) : (
                    <Badge variant="outline">Tuỳ biến</Badge>
                  )}
                </Field>
                <Field label="ID vai trò">
                  <span className="tabular-nums">{record?.id ?? "—"}</span>
                </Field>
                {/* Đếm theo ma trận hiện tại, nên tích một ô là số đổi trước khi lưu. */}
                <Field label="Số quyền đã cấp">
                  <span className="tabular-nums">{grantedCount}</span>
                </Field>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                Vai trò này được làm gì
                <Badge variant="secondary" className="tabular-nums">
                  {grantedCount}
                </Badge>
              </CardTitle>
              <CardDescription>
                Mỗi hàng là một chức năng, mỗi cột là một thao tác. Lưu xong là có hiệu lực, người
                dùng không cần đăng nhập lại.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <FormField
                control={form.control}
                name="permissions"
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <PermissionMatrix value={field.value} onChange={field.onChange} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          <div className="bg-card shadow-e2 sticky bottom-3 z-10 flex flex-row-reverse flex-wrap items-center gap-2 rounded-lg border px-4 py-3">
            <Button type="submit" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting ? "Đang lưu..." : "Lưu"}
            </Button>
            <Button type="button" variant="outline" onClick={() => navigate(-1)}>
              Huỷ
            </Button>
          </div>
        </form>
      </Form>
    </EditView>
  );
};
