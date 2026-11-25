import { useState } from "react";
import { useCan } from "@refinedev/core";
import { useForm } from "@refinedev/react-hook-form";
import { useNavigate } from "react-router";

import {
  CreateView,
  CreateViewHeader,
} from "@/shared/components/views/create-view";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { maxLengthOf, mergeRules, textRules } from "@/shared/lib/field-rules";
import { Textarea } from "@/shared/ui/textarea";
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
import { FormHint } from "@/shared/components/form/help-hint";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/shared/ui/form";
import { PermissionMatrix, type PermissionRef } from "@/features/administration/roles/permission-matrix";
import { SelectField } from "@/shared/components/form/simple-fields";
import type { AnyControl } from "@/features/administration/users/profile-fields";
import { USER_TYPE_LABELS } from "@/domains/user/types";
import { RoleDataScopes } from "@/features/administration/roles/data-scopes";

/**
 * The create payload, which is `RoleRequest` on the backend rather than the
 * `RoleResponse` shape the rest of the resource speaks.
 */
type RoleFormValues = {
  roleType: string;
  code: string;
  name: string;
  description: string;
  permissions: PermissionRef[];
};

/**
 * Annotated rather than inferred, so the empty arrays widen to their element
 * type instead of being pinned to `never[]`.
 */
const DEFAULT_VALUES: RoleFormValues = {
  roleType: "",
  code: "",
  name: "",
  description: "",
  permissions: [],
};

const ROLE_TYPES = (["SO", "SCHOOL", "SYSTEM"] as const).map((t) => ({ value: t, label: USER_TYPE_LABELS[t] }));

export const RoleCreate = () => {
  const navigate = useNavigate();

  const {
    refineCore: { onFinish },
    ...form
  } = useForm({
    // To the edit screen rather than back to the list, which is Refine's
    // default. A new role is not finished when its row exists: its data scopes
    // cannot be written until it has an id to belong to, and the tab that
    // writes them is on the edit screen. Landing there is the difference
    // between the second half of the job being the next thing in front of you
    // and being something you have to go and find.
    refineCoreProps: { redirect: "edit" },
    defaultValues: DEFAULT_VALUES,
  });

  const grantedCount = form.watch("permissions")?.length ?? 0;

  const { data: canReadScopes } = useCan({
    resource: "row_level_policies",
    action: "list",
  });
  const mayReadScopes = canReadScopes?.can ?? false;

  const [tab, setTab] = useState("permissions");

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
              <CardTitle>Thông tin</CardTitle>
              <CardDescription>
                Tên gọi và mục đích của vai trò.
              </CardDescription>
            </CardHeader>
            <CardContent className="@container"><div className="grid items-start gap-5 @md:grid-cols-2 @3xl:grid-cols-4">
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
                        placeholder="BIEN_TAP_VIEN"
                        className="font-mono"
                        maxLength={64}
                        // Typing lower case and having it silently rejected is
                        // a worse experience than having it corrected as you
                        // type.
                        onChange={(e) =>
                          field.onChange(e.target.value.toUpperCase())
                        }
                      />
                    </FormControl>
                    <FormHint>
                      Mã riêng của vai trò, viết hoa không dấu.
                    </FormHint>
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
                      <Input
                        {...field}
                        value={field.value ?? ""}
                        placeholder="Biên tập viên"
                        maxLength={maxLengthOf("NAME")}
                      />
                    </FormControl>
                    <FormHint>
                      Tên hiển thị trên giao diện.
                    </FormHint>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <SelectField
                control={form.control as unknown as AnyControl}
                name="roleType"
                label="Loại vai"
                rules={{ required: "Vui lòng chọn loại vai" }}
                placeholder="Vui lòng chọn loại vai"
                options={ROLE_TYPES}
                description="Tài khoản loại nào dùng vai này. Không đổi được sau khi tạo."
              />

              <FormField
                control={form.control}
                name="description"
                rules={textRules("NOTE", "Mô tả")}
                render={({ field }) => (
                  <FormItem className="@md:col-span-2 @3xl:col-span-4">
                    <FormLabel>Mô tả</FormLabel>
                    <FormControl>
                      <Textarea
                        {...field}
                        maxLength={maxLengthOf("NOTE")}
                        value={field.value ?? ""}
                        rows={3}
                        placeholder="Vai trò này dùng để làm gì, trong một câu."
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div></CardContent>
          </Card>

          <Tabs value={tab} onValueChange={setTab}>
            <TabsList>
              <TabsTrigger value="permissions">
                Quyền
                <Badge variant="secondary" className="ml-2 tabular-nums">
                  {grantedCount}
                </Badge>
              </TabsTrigger>
              {/*
                Present but empty rather than absent. A tab that appears only
                after the first save reads as a feature somebody has not found;
                one that is there and says why it is waiting reads as the order
                the work has to happen in.
              */}
              {mayReadScopes && (
                <TabsTrigger value="scopes">Phạm vi dữ liệu</TabsTrigger>
              )}
            </TabsList>

            <TabsContent value="permissions">
              <Card>
                <CardHeader>
                  <CardTitle>Vai trò này được làm gì</CardTitle>
                  <CardDescription>
                    Mỗi hàng là một chức năng, mỗi cột là một thao tác. Tích
                    vào ô để cấp quyền.
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
                            roleType={form.watch("roleType") || null}
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
                      Tạo vai trò xong mới thêm được phạm vi dữ liệu.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <RoleDataScopes roleId={undefined} roleCode={undefined} />
                  </CardContent>
                </Card>
              </TabsContent>
            )}
          </Tabs>

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
