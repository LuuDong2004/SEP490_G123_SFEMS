import { isRecordMissing, RecordNotFound } from "@/shared/components/views/record-not-found";
import { useEffect } from "react";
import { useForm } from "@refinedev/react-hook-form";
import { useNavigate } from "react-router";

import {
  EditView,
  EditViewHeader,
} from "@/shared/components/views/edit-view";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { inputModeOf, maxLengthOf, mergeRules, textRules } from "@/shared/lib/field-rules";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/ui/select";
import { FormHint } from "@/shared/components/form/help-hint";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/shared/ui/form";
import { ProfileFields, profilePayload, type ProfileKind } from "@/features/administration/users/profile-fields";
import { RolePicker } from "@/features/administration/users/role-picker";
import { ResetMfaCard } from "@/features/administration/users/reset-mfa-card";
import { ResetPasswordCard } from "@/features/administration/users/reset-password-card";
import { STATUS_OPTIONS, USER_TYPE_LABELS, type User, type UserProfile } from "@/domains/user/types";
import { Label } from "@/shared/ui/label";
import { FormSection } from "@/shared/components/form/form-section";
import {
  FormActions,
  FormPanel,
} from "@/shared/components/form/form-panel";

/** Một ô chỉ đọc cùng cỡ ô nhập — đơn vị công tác không sửa được trên form này. */
function ReadOnlyLine({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="grid gap-2">
      <Label>{label}</Label>
      <span className="bg-muted/50 text-foreground flex h-9 items-center truncate rounded-md px-3 text-sm">{value}</span>
      {hint ? <FormHint>{hint}</FormHint> : null}
    </div>
  );
}

/**
 * Editing an account.
 *
 * Deliberately has no password field. Setting somebody else's password ends
 * every session they have open, which is right when that is what you meant to
 * do and alarming when you only meant to correct a typo in their name — so it
 * lives in its own card below the form, with its own button.
 */
export const UserEdit = () => {
  const navigate = useNavigate();

  const {
    refineCore: { onFinish, query },
    ...form
  } = useForm({
    refineCoreProps: {},
  });

  const user = query?.data?.data as User | undefined;
  const userId = user?.id;

  /**
   * Fill the form from the record, in one go.
   *
   * `@refinedev/react-hook-form` fills a form by walking the fields it believes
   * are registered and `setValue`ing them one at a time. `school` is driven by
   * `SchoolPicker` rather than by a `FormField`, so nó không bao giờ được đăng
   * ký và lần duyệt đó sẽ bỏ qua nó hoàn toàn — trường công tác sẽ hiện thành
   * "Không thuộc trường nào" trên mọi tài khoản thật ra có trường.
   *
   * `reset` writes the record into the form's values wholesale instead, so a
   * value is there whether or not anything registered a field for it.
   * `keepDirtyValues` stops the refetch that follows a cache hit from throwing
   * away whatever has been changed since.
   */
  const { reset } = form;
  useEffect(() => {
    if (!user) return;
    reset(user, { keepDirtyValues: true });
  }, [user, reset]);

  const profileKind: ProfileKind | null = !user ? null
    : user.userType === "SYSTEM" ? "system" : user.userType === "SCHOOL" ? "school" : "agency";

  function onSubmit(values: Record<string, unknown>) {
    // `roles` arrives from the API as full objects and goes back as `{ id }`
    // refs. The API ignores the extra keys, but trimming them keeps the request
    // an honest statement of what is being changed.
    const roles = Array.isArray(values.roles)
      ? (values.roles as { id: number }[]).map((role) => ({ id: role.id }))
      : values.roles;

    // Đơn vị không gửi lại: máy chủ không cho đổi, bỏ khoá là "để nguyên".
    const { school: _school, managingBody: _body, userType: _type, ...rest } = values;
    void _school; void _body; void _type;
    onFinish({
      ...rest,
      roles,
      profile: profileKind ? profilePayload(profileKind, values.profile as Partial<UserProfile> | null) : undefined,
    });
  }

  if (isRecordMissing(query)) {
    return (
      <EditView>
        <EditViewHeader />
        <RecordNotFound what="người dùng" />
      </EditView>
    );
  }

  return (
    <EditView>
      <EditViewHeader />
      <div className="w-full space-y-8">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)}>
            <FormPanel contentClassName="@container space-y-6">
              <FormSection title="Tài khoản" compact>
              <div className="grid items-start gap-5 @md:grid-cols-2 @3xl:grid-cols-4">
              <FormField
                control={form.control}
                name="username"
                rules={mergeRules(textRules("USERNAME", "Tên đăng nhập", { max: 100 }), {
                  required: "Tên đăng nhập là bắt buộc",
                  minLength: { value: 3, message: "Tên đăng nhập tối thiểu 3 ký tự" },
                })}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tên đăng nhập</FormLabel>
                    <FormControl>
                      <Input {...field} value={field.value ?? ""} maxLength={maxLengthOf("USERNAME", 100)} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="email"
                rules={mergeRules(textRules("EMAIL", "Email"), { required: "Email là bắt buộc" })}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input {...field} type="email" value={field.value ?? ""} maxLength={maxLengthOf("EMAIL")} inputMode={inputModeOf("EMAIL")} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="fullName"
                rules={mergeRules(textRules("NAME", "Họ tên"), { required: "Họ tên là bắt buộc" })}
                render={({ field }) => (
                  <FormItem className="@3xl:col-span-2">
                    <FormLabel>Họ tên</FormLabel>
                    <FormControl>
                      <Input {...field} value={field.value ?? ""} maxLength={maxLengthOf("NAME")} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="status"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Trạng thái</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      value={field.value ?? "active"}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Vui lòng chọn trạng thái" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {STATUS_OPTIONS.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormHint>
                      Ngừng hoạt động sẽ đăng xuất tài khoản này ở mọi nơi.
                    </FormHint>
                    <FormMessage />
                  </FormItem>
                )}
              />

              </div>
              </FormSection>

              <FormSection title="Nơi công tác" compact>
              {/* Đơn vị công tác cố định từ lúc tạo (docs/kien-truc/11): đổi trường / cơ quan = tạo tài khoản mới. */}
              <div className="@container space-y-5">
                <div className="grid items-start gap-5 @md:grid-cols-2">
                  <ReadOnlyLine label="Loại tài khoản" value={user ? USER_TYPE_LABELS[user.userType] : "—"} />
                  <ReadOnlyLine label={user?.school ? "Trường" : "Cơ quan quản lý"}
                    value={user?.school?.name ?? user?.managingBody?.name ?? "Không thuộc đơn vị"}
                    hint="Không đổi được. Chuyển đơn vị thì tạo tài khoản mới." />
                </div>
                {profileKind ? <ProfileFields control={form.control} kind={profileKind} /> : null}
              </div>
              </FormSection>

              <FormSection title="Phân quyền" compact className="border-b-0 pb-0">
              <FormField
                control={form.control}
                name="roles"
                rules={{
                  validate: (value) =>
                    (Array.isArray(value) && value.length > 0) ||
                    "Chọn ít nhất một vai trò",
                }}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Vai trò</FormLabel>
                    <FormControl>
                      <RolePicker value={field.value} onChange={field.onChange} userType={user?.userType ?? null} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              </FormSection>

              <FormActions>
                <Button type="submit" disabled={form.formState.isSubmitting}>
                  {form.formState.isSubmitting ? "Đang lưu..." : "Lưu"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => navigate(-1)}
                >
                  Huỷ
                </Button>
              </FormActions>
            </FormPanel>
          </form>
        </Form>

        {userId != null && <ResetPasswordCard userId={userId} />}
        {userId != null && <ResetMfaCard userId={userId} />}
      </div>
    </EditView>
  );
};
