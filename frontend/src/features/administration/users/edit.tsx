import { isRecordMissing, RecordNotFound } from "@/shared/components/views/record-not-found";
import { useEffect, useState } from "react";
import { useForm } from "@refinedev/react-hook-form";
import { useNavigate } from "react-router";

import {
  EditView,
  EditViewHeader,
} from "@/shared/components/views/edit-view";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
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
import { PlacementField, placementProblem, type PlacementMode } from "@/features/administration/users/placement-field";
import { RolePicker, useRolePlacement } from "@/features/administration/users/role-picker";
import type { ManagingBodyRef } from "@/features/administration/users/managing-body-picker";
import type { SchoolRef } from "@/features/administration/users/school-picker";
import { ResetPasswordCard } from "@/features/administration/users/reset-password-card";
import { STATUS_OPTIONS, type User } from "@/domains/user/types";
import { FormSection } from "@/shared/components/form/form-section";
import {
  FormActions,
  FormPanel,
} from "@/shared/components/form/form-panel";

/**
 * Trims a placement down to the `{ id }` ref the API reads, preserving the
 * three states it distinguishes.
 *
 * `null` means the field is absent from the request — leave it as it is, which
 * is the right answer for an account that was unplaced and was not touched.
 * `{ id: null }` is the picker's way of saying "clear it", and has to survive
 * intact. Anything else arrived from the API as a full summary object and goes
 * back as its id alone.
 */
function toSchoolRef(value: unknown): SchoolRef | null {
  if (value == null) return null;
  const id = (value as { id?: number | string | null }).id;
  return { id: id == null ? null : Number(id) };
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

  const placement = useRolePlacement(form.watch("school"), form.watch("managingBody"));
  const [placementMode, setPlacementMode] = useState<PlacementMode>("school");
  const [placementError, setPlacementError] = useState<string | null>(null);

  function onSubmit(values: Record<string, unknown>) {
    const problem = placementProblem(placementMode, values.school as SchoolRef | null, values.managingBody as ManagingBodyRef | null);
    setPlacementError(problem);
    if (problem) return;
    // `roles` arrives from the API as full objects and goes back as `{ id }`
    // refs. The API ignores the extra keys, but trimming them keeps the request
    // an honest statement of what is being changed.
    const roles = Array.isArray(values.roles)
      ? (values.roles as { id: number }[]).map((role) => ({ id: role.id }))
      : values.roles;

    onFinish({
      ...values,
      roles,
      school: toSchoolRef(values.school),
      managingBody: toSchoolRef(values.managingBody) as ManagingBodyRef | null,
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
                rules={{
                  required: "Tên đăng nhập là bắt buộc",
                  minLength: { value: 3, message: "Tối thiểu 3 ký tự" },
                  pattern: {
                    value: /^[a-zA-Z0-9._-]+$/,
                    message: "Chỉ gồm chữ, số, dấu chấm, gạch dưới và gạch nối",
                  },
                }}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tên đăng nhập</FormLabel>
                    <FormControl>
                      <Input {...field} value={field.value ?? ""} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="email"
                rules={{
                  required: "Email là bắt buộc",
                  pattern: {
                    value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
                    message: "Nhập địa chỉ email hợp lệ",
                  },
                }}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input {...field} type="email" value={field.value ?? ""} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="fullName"
                rules={{ required: "Họ tên là bắt buộc" }}
                render={({ field }) => (
                  <FormItem className="@3xl:col-span-2">
                    <FormLabel>Họ tên</FormLabel>
                    <FormControl>
                      <Input {...field} value={field.value ?? ""} />
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
              {/*
                Trường / cơ quan của chính bản ghi được truyền vào BÊN CẠNH giá trị form:
                đó là thứ làm ô chọn hiện đúng tên trước khi danh sách kịp về, và giữ nó
                đọc được với một vai trò được sửa tài khoản nhưng không được đọc danh sách.
              */}
              <PlacementField
                school={form.watch("school")}
                managingBody={form.watch("managingBody")}
                onSchoolChange={(value) => form.setValue("school", value, { shouldDirty: true })}
                onManagingBodyChange={(value) => form.setValue("managingBody", value, { shouldDirty: true })}
                currentSchool={user?.school}
                currentManagingBody={user?.managingBody}
                onModeChange={setPlacementMode}
                error={placementError}
                emptyRecord={!!user && !user.school && !user.managingBody}
              />
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
                      <RolePicker value={field.value} onChange={field.onChange} placement={placement} />
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
      </div>
    </EditView>
  );
};
