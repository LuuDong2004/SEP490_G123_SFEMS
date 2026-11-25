import { useState } from "react";
import { ProfileFields, profilePayload, type AnyControl, type ProfileKind } from "@/features/administration/users/profile-fields";
import { useOne } from "@refinedev/core";
import { useForm } from "@refinedev/react-hook-form";
import { Loader2, UserPlus } from "lucide-react";
import { useNavigate } from "react-router";

import { Button } from "@/shared/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/ui/dialog";
import { Input } from "@/shared/ui/input";
import { InputPassword } from "@/shared/components/form/input-password";
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
import { placementType, RolePicker, useRolePlacement, type RoleRef } from "@/features/administration/users/role-picker";
import type { ManagingBodyRef } from "@/features/administration/users/managing-body-picker";
import type { SchoolRef } from "@/features/administration/users/school-picker";
import { STATUS_OPTIONS, type UserProfile, type UserStatus } from "@/domains/user/types";
import { StepTitle } from "@/shared/components/voucher/voucher-layout";
import { PasswordRules } from "@/shared/components/form/password-rules";
import { passwordOk } from "@/shared/lib/password-policy";
import { inputModeOf, maxLengthOf, mergeRules, textRules } from "@/shared/lib/field-rules";

/**
 * The create payload, which is `UserRequest` on the backend rather than the
 * `UserResponse` shape the rest of the resource speaks. Naming it keeps the
 * defaults below and the submit handler agreeing on one type.
 */
type UserFormValues = {
  username: string;
  email: string;
  fullName: string;
  password: string;
  status: UserStatus;
  roles: RoleRef[];
  school: SchoolRef;
  managingBody: ManagingBodyRef;
  profile: Partial<UserProfile>;
};

/**
 * Annotated rather than inferred, so `status` widens to the union instead of
 * being pinned to the literal "active" the object happens to start with.
 */
const DEFAULT_VALUES: UserFormValues = {
  username: "",
  email: "",
  fullName: "",
  password: "",
  status: "active",
  roles: [],
  // `{ id: null }` chứ không bỏ trống: đó là hình dạng mà API đọc thành "không
  // thuộc trường nào", và nó giữ giá trị của ô chọn luôn là một object ổn định.
  school: { id: null },
  managingBody: { id: null },
  profile: {},
};

/** Tiền tố tài khoản của một trường — cùng phép với máy chủ (`UserService.schoolLogin`) và màn đăng nhập. */
function loginPrefix(code: string): string {
  return code.normalize("NFD").replace(/\p{M}/gu, "").replace(/đ/g, "d").replace(/Đ/g, "D")
    .toLowerCase().replace(/[^a-z0-9._-]/g, "");
}

const GRID = "grid items-start gap-x-4 gap-y-5";
/** Các phần trong hộp thoại không mang khung thẻ riêng — hộp đã là khung; ngăn nhau bằng một đường kẻ mảnh. */
const SECTION = "@container grid gap-4 border-t py-5 first:border-t-0";
/** Nút Thêm mới nằm ở chân hộp, ngoài `<form>` — nối lại bằng thuộc tính `form`. */
const FORM_ID = "user-create-form";

/**
 * Creating an account.
 *
 * This is the only way a user comes into existence — there is no
 * self-registration. Mật khẩu để trống thì máy chủ gửi thư mời tới email, chủ
 * tài khoản tự đặt mật khẩu qua link; nhập thì người tạo tự giao mật khẩu.
 *
 * <p>Hộp thoại mở trên danh sách (route `create` lồng dưới route danh sách,
 * danh sách vẽ `<Outlet />`): các phần xếp theo thứ tự điền (tài khoản · nơi
 * công tác · vai trò), chỉ thân cuộn, Huỷ · Thêm mới ở chân hộp.
 */
export const UserCreate = () => {
  const navigate = useNavigate();

  const {
    refineCore: { onFinish },
    ...form
  } = useForm({
    refineCoreProps: {
      // Mật khẩu trống = mời qua email: nói rõ để người tạo không phải tự giao mật khẩu.
      successNotification: (_data, values) => ({
        type: "success",
        message: (values as UserFormValues | undefined)?.password
          ? "Đã thêm người dùng"
          : "Đã thêm người dùng và gửi thư mời đặt mật khẩu tới email",
      }),
    },
    defaultValues: DEFAULT_VALUES,
  });

  const placement = useRolePlacement(form.watch("school"), form.watch("managingBody"));
  const [placementMode, setPlacementMode] = useState<PlacementMode>("school");
  const [placementError, setPlacementError] = useState<string | null>(null);
  const profileKind: ProfileKind = placementMode === "school" ? "school" : placementMode === "body" ? "agency" : "system";
  // Tài khoản trường mang tên <mã trường>.<tên> — máy chủ tự ghép; ô tên đăng nhập hiện sẵn tiền tố để người tạo thấy tên đầy đủ.
  const schoolId = form.watch("school")?.id ?? null;
  const { result: pickedSchool } = useOne<{ code: string }>({
    resource: "schools",
    id: schoolId ?? "",
    queryOptions: { enabled: placementMode === "school" && schoolId != null },
  });
  const prefix = placementMode === "school" && schoolId != null && pickedSchool?.code ? loginPrefix(pickedSchool.code) : null;

  function onSubmit(values: UserFormValues) {
    const problem = placementProblem(placementMode, values.school, values.managingBody);
    setPlacementError(problem);
    if (problem) return;
    onFinish({ ...values, profile: profilePayload(profileKind, values.profile) });
  }

  const main = (
    <>
      <section className={SECTION}>
        <StepTitle title="Tài khoản" />
        <div className={`${GRID} @2xl:grid-cols-2 @4xl:grid-cols-3`}>
          <FormField
            control={form.control}
            name="fullName"
            rules={mergeRules(textRules("NAME", "Họ tên"), { required: "Họ tên là bắt buộc" })}
            render={({ field }) => (
              <FormItem>
                <FormLabel>Họ tên</FormLabel>
                <FormControl>
                  <Input {...field} value={field.value ?? ""} placeholder="Nguyễn Văn A" maxLength={maxLengthOf("NAME")} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

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
                <div className="flex">
                  {prefix ? (
                    <span className="bg-muted text-muted-foreground flex max-w-[50%] shrink-0 items-center truncate rounded-s-md border border-e-0 px-3 text-sm"
                      title={`${prefix}.`}>
                      {prefix}.
                    </span>
                  ) : null}
                  <FormControl>
                    <Input {...field} value={field.value ?? ""} placeholder="nguyenvana" autoComplete="off" maxLength={maxLengthOf("USERNAME", 100)}
                      className={prefix ? "rounded-s-none" : undefined} />
                  </FormControl>
                </div>
                <FormHint>
                  {prefix
                    ? `Tên đầy đủ là ${prefix}.${field.value || "…"} — đăng nhập thì chọn trường rồi gõ phần sau dấu chấm.`
                    : "Dùng để đăng nhập. Không được trùng với tài khoản khác."}
                </FormHint>
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
                  <Input
                    {...field}
                    type="email"
                    value={field.value ?? ""}
                    placeholder="nguyenvana@example.com"
                    maxLength={maxLengthOf("EMAIL")}
                    inputMode={inputModeOf("EMAIL")}
                  />
                </FormControl>
                <FormHint>Có thể dùng email thay tên đăng nhập.</FormHint>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="password"
            rules={{
              validate: (v: string) => !v || passwordOk(v) || "Mật khẩu chưa đủ các yêu cầu bên dưới",
            }}
            render={({ field }) => (
              <FormItem>
                <FormLabel>Mật khẩu ban đầu</FormLabel>
                <FormControl>
                  <InputPassword
                    {...field}
                    value={field.value ?? ""}
                    autoComplete="new-password"
                    placeholder="Để trống: gửi thư mời qua email"
                  />
                </FormControl>
                <FormHint>
                  Để trống thì hệ thống gửi tới email trên một link để chủ tài khoản tự đặt mật khẩu. Nhập mật khẩu
                  thì bạn tự giao cho họ — lưu xong không xem lại được.
                </FormHint>
                <FormMessage />
                {field.value ? <PasswordRules value={field.value} className="pt-1" /> : null}
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
                  onValueChange={(v) => { if (v) field.onChange(v); }}
                  value={field.value ?? "active"}
                >
                  <FormControl>
                    <SelectTrigger className="w-full">
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
                <FormHint>Chỉ tài khoản đang hoạt động mới đăng nhập được.</FormHint>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
      </section>

      <section className={SECTION}>
        <StepTitle title="Nơi công tác" />
        <PlacementField
          school={form.watch("school")}
          managingBody={form.watch("managingBody")}
          onSchoolChange={(value) => form.setValue("school", value, { shouldDirty: true })}
          onManagingBodyChange={(value) => form.setValue("managingBody", value, { shouldDirty: true })}
          onModeChange={setPlacementMode}
          error={placementError}
        />
        <ProfileFields control={form.control as unknown as AnyControl} kind={profileKind} />
      </section>

      <section className={SECTION}>
        <FormField
          control={form.control}
          name="roles"
          rules={{
            validate: (value) =>
              (Array.isArray(value) && value.length > 0) ||
              "Chọn ít nhất một vai trò",
          }}
          render={({ field }) => (
            <FormItem className="gap-4">
              <StepTitle
                title="Vai trò"
                hint="Vai trò quyết định tài khoản này được làm gì. Chọn được nhiều vai trò."
                aside={field.value?.length ? `Đã chọn ${field.value.length}` : undefined}
              />
              <FormControl>
                <RolePicker value={field.value} onChange={field.onChange} userType={placementType(placementMode, placement)} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </section>
    </>
  );

  // Đóng hộp là về danh sách — kể cả Esc, bấm ra ngoài, nút X. Đi qua `navigate`
  // thường (không `replace`) để còn hỏi lại khi form đang có chữ chưa lưu.
  const close = () => navigate("/users");

  return (
    <Dialog open onOpenChange={(open) => { if (!open) close(); }}>
      <DialogContent size="wide" className="flex flex-col gap-0 overflow-hidden p-0 outline-none">
        <DialogHeader className="border-b px-6 py-4 pr-12">
          <DialogTitle>Thêm người dùng</DialogTitle>
          <DialogDescription className="sr-only">Nhập tài khoản, nơi công tác và vai trò của người dùng mới.</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form id={FORM_ID} onSubmit={form.handleSubmit(onSubmit)} className="min-h-0 flex-1 overflow-y-auto px-6">
            {main}
          </form>
        </Form>
        <DialogFooter className="border-t px-6 py-4">
          <Button type="button" variant="ghost" onClick={close}>
            Huỷ
          </Button>
          <Button type="submit" form={FORM_ID} disabled={form.formState.isSubmitting}>
            {form.formState.isSubmitting ? <Loader2 className="animate-spin" /> : <UserPlus />}
            {form.formState.isSubmitting ? "Đang thêm..." : "Thêm mới"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
