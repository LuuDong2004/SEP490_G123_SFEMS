import { useForm } from "@refinedev/react-hook-form";
import { useNavigate } from "react-router";

import { CreateView, CreateViewHeader } from "@/shared/components/views/create-view";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Textarea } from "@/shared/ui/textarea";
import { Badge } from "@/shared/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/ui/card";
import { FormHint } from "@/shared/components/form/help-hint";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/shared/ui/form";
import {
  PermissionMatrix,
  type PermissionRef,
} from "@/features/administration/roles/permission-matrix";

/** Payload tạo vai trò: `RoleRequest` phía backend, không phải `RoleResponse`. */
type RoleFormValues = {
  code: string;
  name: string;
  description: string;
  permissions: PermissionRef[];
};

const DEFAULT_VALUES: RoleFormValues = {
  code: "",
  name: "",
  description: "",
  permissions: [],
};

/** Thêm vai trò (HT-05): thông tin vai trò và ma trận quyền, lưu cùng một lần. */
export const RoleCreate = () => {
  const navigate = useNavigate();

  const {
    refineCore: { onFinish },
    ...form
  } = useForm({
    refineCoreProps: { redirect: "show" },
    defaultValues: DEFAULT_VALUES,
  });

  const grantedCount = form.watch("permissions")?.length ?? 0;

  function onSubmit(values: RoleFormValues) {
    onFinish(values);
  }

  return (
    <CreateView>
      <CreateViewHeader />
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Thông tin vai trò</CardTitle>
              <CardDescription>Tên gọi và mục đích của vai trò.</CardDescription>
            </CardHeader>
            <CardContent className="@container">
              <div className="grid items-start gap-x-4 gap-y-5 @md:grid-cols-2 @3xl:grid-cols-4">
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
                          placeholder="KE_TOAN_TRUONG"
                          className="font-mono"
                          // Gõ chữ thường rồi bị từ chối âm thầm tệ hơn là được sửa ngay khi gõ.
                          onChange={(e) => field.onChange(e.target.value.toUpperCase())}
                        />
                      </FormControl>
                      <FormHint>Mã riêng của vai trò, viết hoa không dấu.</FormHint>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="name"
                  rules={{ required: "Bắt buộc nhập tên" }}
                  render={({ field }) => (
                    <FormItem className="@3xl:col-span-2">
                      <FormLabel>Tên</FormLabel>
                      <FormControl>
                        <Input {...field} value={field.value ?? ""} placeholder="Kế toán trường" />
                      </FormControl>
                      <FormHint>Tên hiển thị trên giao diện.</FormHint>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem className="@md:col-span-2 @3xl:col-span-4">
                      <FormLabel>Mô tả</FormLabel>
                      <FormControl>
                        <Textarea
                          {...field}
                          value={field.value ?? ""}
                          rows={3}
                          placeholder="Vai trò này dùng để làm gì, trong một câu."
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                Vai trò này được làm gì
                <Badge variant="secondary" className="tabular-nums">
                  {grantedCount}
                </Badge>
              </CardTitle>
              <CardDescription>
                Mỗi hàng là một chức năng, mỗi cột là một thao tác. Tích vào ô để cấp quyền.
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

          {/* Dính đáy vì ma trận đủ cao để nút ở cuối trang trôi mất ngay khi bắt đầu dùng. */}
          <div className="bg-card shadow-e2 sticky bottom-3 z-10 flex flex-row-reverse flex-wrap items-center gap-2 rounded-lg border px-4 py-3">
            <Button type="submit" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting ? "Đang tạo..." : "Thêm mới"}
            </Button>
            <Button type="button" variant="outline" onClick={() => navigate(-1)}>
              Huỷ
            </Button>
          </div>
        </form>
      </Form>
    </CreateView>
  );
};
