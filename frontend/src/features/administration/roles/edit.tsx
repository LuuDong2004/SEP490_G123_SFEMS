import { isRecordMissing, RecordNotFound } from "@/shared/components/views/record-not-found";
import { useState } from "react";
import { useCan } from "@refinedev/core";
import { useForm } from "@refinedev/react-hook-form";
import { useNavigate } from "react-router";

import {
  EditView,
  EditViewHeader,
} from "@/shared/components/views/edit-view";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { maxLengthOf, mergeRules, textRules } from "@/shared/lib/field-rules";
import { Textarea } from "@/shared/ui/textarea";
import { Alert, AlertDescription, AlertTitle } from "@/shared/ui/alert";
import { Badge } from "@/shared/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/shared/ui/card";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/shared/components/tabs/tabs";
import { ShieldIcon } from "lucide-react";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/shared/ui/form";
import { PermissionMatrix, type PermissionRef } from "@/features/administration/roles/permission-matrix";
import { RoleDataScopes } from "@/features/administration/roles/data-scopes";
import { USER_TYPE_LABELS } from "@/domains/user/types";
import type { UserType } from "@/domains/portal/types";

/**
 * A read-only label-and-value pair in the details panel.
 *
 * Deliberately the same shape as the one on every show page, so a fact reads
 * identically whether you are looking at a role or changing one.
 */
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

/**
 * Editing a role.
 *
 * Three parts, and the split follows what each one *is*. On top, the short form
 * of what a role is called, beside a panel of the facts about it that are not
 * fields at all. Below them, the two things a role actually grants sit as tabs,
 * because they answer questions of different shapes about the same subject: a
 * permission decides whether an endpoint answers this role at all, a data scope
 * decides which rows it answers with. Reading one without the other gives half
 * a picture, and until now they were a navigation apart.
 *
 * **The tabs do not share a save.** Details and permissions are fields of this
 * form and go up together when Save is pressed; a data scope is a row in
 * another resource, with its own compiler, its own `422` naming the node at
 * fault, and its own audit trail, so each is written the moment its dialog is
 * submitted. `data-scopes.tsx` explains why folding them together would cost
 * more than it saved.
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
  /** Vai Quản trị viên khoá quyền: sửa được thì tự bỏ quyền quản lý vai của mình, không ai mở lại được. */
  const locked = record?.code === "ADMIN";

  const grantedCount = form.watch("permissions")?.length ?? 0;

  // `row_level_policies:*` is seeded to ADMIN alone, so somebody who may edit a
  // role is not necessarily somebody who may see its data scopes. The tab is
  // not offered rather than offered and then refused on arrival.
  const { data: canReadScopes } = useCan({
    resource: "row_level_policies",
    action: "list",
  });
  const mayReadScopes = canReadScopes?.can ?? false;

  const [tab, setTab] = useState("permissions");

  function onSubmit(values: Record<string, unknown>) {
    const permissions = Array.isArray(values.permissions)
      ? (values.permissions as PermissionRef[]).map((p) => ({ id: p.id }))
      : values.permissions;

    // The API refuses to change a system role's code, so sending it back
    // unchanged would be a no-op at best and a 409 if the field were touched.
    // Leaving it out of the payload states the intent instead.
    const { code, ...rest } = values as Record<string, unknown>;
    // Loại vai cố định từ lúc tạo — không gửi.
    delete rest.roleType;
    const payload = isSystemRole
      ? { ...rest, permissions }
      : { ...rest, code, permissions };

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
                {locked
                  ? "Vai Quản trị viên không đổi mã, không xoá và không sửa quyền được. Dữ liệu nghiệp vụ của trường và Sở chỉ xem, xuất."
                  : "Vai trò này không đổi mã và không xoá được. Quyền vẫn sửa được."}
              </AlertDescription>
            </Alert>
          )}

          {/* Two columns, and the split is what each half is for. The form on
              the left is everything about this role that is yours to change;
              the panel on the right is what the role *is* — facts the API
              settled, not fields. Putting them side by side is what stops the
              read-only ones being mistaken for inputs somebody forgot to fill
              in. It stacks below `lg`, where two columns of it would be
              narrower than the code they hold. */}
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_18rem] lg:items-start">
            <Card>
              <CardHeader>
                <CardTitle>Thông tin vai trò</CardTitle>
                <CardDescription>
                  Mã, tên và mô tả của vai trò.
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-6 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="code"
                  rules={{
                    required: "Bắt buộc nhập mã",
                    maxLength: { value: 64, message: "Mã tối đa 64 ký tự" },
                    pattern: {
                      value: /^[A-Z][A-Z0-9_]*$/,
                      message:
                        "Chỉ gồm chữ in hoa, chữ số và gạch dưới, bắt đầu bằng chữ cái",
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
                          maxLength={64}
                          disabled={isSystemRole}
                          onChange={(e) =>
                            field.onChange(e.target.value.toUpperCase())
                          }
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="name"
                  rules={mergeRules(textRules("NAME", "Tên"), { required: "Bắt buộc nhập tên" })}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Tên</FormLabel>
                      <FormControl>
                        <Input {...field} value={field.value ?? ""} maxLength={maxLengthOf("NAME")} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Spans both columns: a description is prose, and prose in a
                    half-width box wraps every few words. */}
                <FormField
                  control={form.control}
                  name="description"
                  rules={textRules("NOTE", "Mô tả")}
                  render={({ field }) => (
                    <FormItem className="sm:col-span-2">
                      <FormLabel>Mô tả</FormLabel>
                      <FormControl>
                        <Textarea
                          {...field}
                          maxLength={maxLengthOf("NOTE")}
                          value={field.value ?? ""}
                          rows={3}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>

            {/*
              What the API settled about this role, rather than what it holds.
              There is no `status`, and no created/updated audit trail, because
              `roles` carries none of them — the table is code, name,
              description and the system flag, and nothing else. Rendering the
              labels with an em dash beside each would draw five fields that
              will never fill in, so the panel reports the three facts that do
              exist and stops there.
            */}
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
                <Field label="Dùng cho">
                  {record?.roleType ? USER_TYPE_LABELS[record.roleType as UserType] : <span className="text-muted-foreground">Chưa chọn</span>}
                </Field>
                <Field label="ID vai trò">
                  <span className="tabular-nums">{record?.id ?? "—"}</span>
                </Field>
                {/* Live, not from the record: it counts what the matrix holds
                    now, so ticking a box moves it before anything is saved. */}
                <Field label="Số quyền đã cấp">
                  <span className="tabular-nums">{grantedCount}</span>
                </Field>
              </CardContent>
            </Card>
          </div>

          <Tabs value={tab} onValueChange={setTab}>
            <TabsList>
              <TabsTrigger value="permissions">
                Quyền
                <Badge variant="secondary" className="ml-2 tabular-nums">
                  {grantedCount}
                </Badge>
              </TabsTrigger>
              {mayReadScopes && (
                <TabsTrigger value="scopes">Phạm vi dữ liệu</TabsTrigger>
              )}
            </TabsList>

            <TabsContent value="permissions">
              <Card>
                <CardHeader>
                  <CardTitle>Vai trò này được làm gì</CardTitle>
                  <CardDescription>
                    {locked
                      ? "Quyền của vai Quản trị viên được khoá, ở đây chỉ xem."
                      : "Mỗi hàng là một chức năng, mỗi cột là một thao tác. Lưu xong là có hiệu lực, người dùng không cần đăng nhập lại."}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <FormField
                    control={form.control}
                    name="permissions"
                    render={({ field }) => (
                      <FormItem>
                        <FormControl>
                          <PermissionMatrix
                            value={field.value}
                            onChange={field.onChange}
                            roleType={(record?.roleType as string | undefined) ?? null}
                            readOnly={locked}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </CardContent>
              </Card>
            </TabsContent>

            {mayReadScopes && (
              <TabsContent value="scopes">
                <Card>
                  <CardHeader>
                    <CardTitle>Dữ liệu vai trò này được xem / sửa</CardTitle>
                    <CardDescription>
                      Chỉ một số chức năng đặt được phạm vi dữ liệu. Chức năng
                      chưa đặt thì dùng phạm vi mặc định của nó.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <RoleDataScopes
                      roleId={record?.id as number | undefined}
                      roleCode={record?.code as string | undefined}
                    />
                  </CardContent>
                </Card>
              </TabsContent>
            )}
          </Tabs>

          {/* Sticky, because the matrix is tall enough that a footer button
              would be scrolled off the moment you started using it. */}
          <div className="bg-card shadow-e2 sticky bottom-3 z-10 flex flex-row-reverse flex-wrap items-center gap-2 rounded-lg border px-4 py-3">
            <Button type="submit" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting ? "Đang lưu..." : "Lưu"}
            </Button>
            <Button type="button" variant="outline" onClick={() => navigate(-1)}>
              Huỷ
            </Button>
            {/* Said where the ambiguity actually is. On the permissions tab
                this button is the only way anything is written; on the other
                one it has nothing to do with what is on screen. */}
            {tab === "scopes" && (
              <span className="text-muted-foreground me-auto text-sm">
                Nút Lưu chỉ lưu thông tin và quyền. Phạm vi dữ liệu đã được lưu
                riêng.
              </span>
            )}
          </div>
        </form>
      </Form>
    </EditView>
  );
};
