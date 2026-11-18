import { useCustom, useSelect } from "@refinedev/core";
import type { UseFormReturn } from "react-hook-form";

import { customResult } from "@/shared/hooks/use-custom-result";
import { API_URL } from "@/shared/api/constants";
import { humanizeResource } from "@/domains/permission/types";
import { Alert, AlertDescription } from "@/shared/ui/alert";
import { Badge } from "@/shared/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/shared/ui/card";
import { FormHint } from "@/shared/components/form/help-hint";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/shared/ui/form";
import { Input } from "@/shared/ui/input";
import { maxLengthOf, mergeRules, textRules } from "@/shared/lib/field-rules";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/ui/select";
import { Switch } from "@/shared/ui/switch";
import { Textarea } from "@/shared/ui/textarea";
import { ScopeBuilder } from "@/features/administration/row-level-policies/scope-builder";
import {
  ACTIONS,
  EMPTY_SCOPE,
  actionLabel,
  kindLabel,
  type PolicyMetadata,
  type ScopeNode,
} from "@/domains/row-level-policy/types";

/**
 * The create and edit forms are the same form, so it lives here once.
 *
 * The shape it edits is `RowLevelPolicyRequest` on the backend. Two of its
 * fields are locked on edit rather than merely discouraged — see
 * `lockIdentity` below.
 */

export type PolicyFormValues = {
  kind: "SCOPE" | "FILTER";
  /**
   * Null for a filter, which has no role by design. Nullable rather than
   * optional because the field is always sent: an omitted role would leave the
   * API guessing, and an explicit null is the only way to say "nobody".
   */
  role: { id: number | null };
  resource: string;
  action: string;
  name: string;
  policyGroup: string;
  description: string;
  scope: ScopeNode;
  /**
   * The `WITH CHECK` clause. Null means "the same as `scope`" — see the card in
   * the form for why that is the default and when to override it.
   */
  checkScope: ScopeNode | null;
  enabled: boolean;
};

type PolicyFormProps = {
  form: UseFormReturn<PolicyFormValues>;
  /**
   * True on the edit screen. `kind` and `resource` are then read-only, because
   * changing either turns a policy into a different policy about different
   * rows — and the audit trail would claim one thing was edited when in truth
   * one rule was withdrawn and another introduced. The API rejects them for the
   * same reason; this is the form agreeing with it rather than discovering it.
   */
  lockIdentity?: boolean;
  /** Every resource under row-level management, for the resource picker. */
  resources: string[];
  /**
   * The role the record already names, for the edit screen.
   *
   * Both pickers here are fed by requests that finish after this form mounts,
   * and a Radix `Select` renders its label from the matching item — so a value
   * whose option has not arrived yet shows the placeholder and looks like an
   * empty field. Merging the current value into the list closes that window;
   * the role needs its label passed in because only the record knows it.
   */
  currentRole?: { id: number; code: string } | null;
  /**
   * True when the screen, rather than the form, has already decided the role —
   * the Data scopes tab of a role, where every policy written belongs to the
   * role being edited.
   *
   * The picker is shown disabled rather than hidden, for the same reason it is
   * on a filter: a field that vanishes reads as one somebody forgot, while a
   * disabled one holding the right value reads as a decision already made.
   */
  lockRole?: boolean;
  /**
   * True when the kind is fixed at `SCOPE`.
   *
   * A `FILTER` names no role by design — that is what makes it inescapable — so
   * there is no such thing as a filter *of* a role, and offering the choice on
   * a role's own screen would offer a policy that screen cannot save.
   */
  lockKind?: boolean;
};

export function PolicyForm({
  form,
  lockIdentity,
  resources,
  currentRole,
  lockRole,
  lockKind,
}: PolicyFormProps) {
  const kind = form.watch("kind");
  const resource = form.watch("resource");
  const action = form.watch("action");

  const { options: roleOptions, query: roleQuery } = useSelect({
    resource: "roles",
    optionLabel: "name",
    optionValue: "id",
    sorters: [{ field: "code", order: "asc" }],
    pagination: { pageSize: 200 },
  });

  // The current values, guaranteed to have an option to match, however late the
  // real lists arrive. Without this the field renders as blank rather than as
  // what it holds -- which reads as data loss on a form somebody is editing.
  const resourceOptions =
    resource && !resources.includes(resource) ? [resource, ...resources] : resources;

  const roleChoices = (roleOptions ?? []).some(
    (option) => String(option.value) === String(currentRole?.id)
  )
    ? (roleOptions ?? [])
    : [
        ...(currentRole ? [{ value: currentRole.id, label: currentRole.code }] : []),
        ...(roleOptions ?? []),
      ];

  // The server's own declaration of what a policy on this resource may say.
  // Everything the condition builder offers comes from here, which is what lets
  // that builder have no free-text expression box at all.
  const { result: metadataResult, query: metadataQuery } = useCustom<PolicyMetadata>({
    url: `${API_URL}/row_level_policies/metadata`,
    method: "get",
    config: { query: { resource } },
    queryOptions: { enabled: Boolean(resource) },
  });

  // Not `metadataResult?.data` on its own: refine answers a query that has not
  // run with a frozen empty object rather than undefined, and this query is
  // disabled until a resource is picked. See `customResult`.
  const metadata = customResult(metadataResult?.data, "fields");

  return (
    <Form {...form}>
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Chính sách này là gì</CardTitle>
            <CardDescription>
              Phạm vi gắn với một vai trò và mở thêm dữ liệu cho vai trò đó.
              Bộ lọc áp dụng cho mọi người và luôn thu hẹp.
            </CardDescription>
          </CardHeader>
          <CardContent className="max-w-3xl space-y-6">
            <div className="grid gap-6 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="kind"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Loại</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      value={field.value}
                      disabled={lockIdentity || lockKind}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="SCOPE">
                          Phạm vi: mở thêm dữ liệu cho một vai trò
                        </SelectItem>
                        <SelectItem value="FILTER">
                          Bộ lọc: thu hẹp dữ liệu của mọi người
                        </SelectItem>
                      </SelectContent>
                    </Select>
                    <FormHint>
                      {lockIdentity
                        ? "Không đổi được sau khi đã tạo."
                        : lockKind
                          ? "Bộ lọc áp dụng cho mọi người nên không tạo được từ màn hình của một vai trò."
                          : "Phạm vi của các vai trò cộng lại với nhau. Bộ lọc thì luôn áp dụng."}
                    </FormHint>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="resource"
                rules={{ required: "Chọn tài nguyên" }}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tài nguyên</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      value={field.value ?? ""}
                      disabled={lockIdentity}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Vui lòng chọn tài nguyên" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {resourceOptions.map((candidate) => (
                          <SelectItem key={candidate} value={candidate}>
                            {humanizeResource(candidate)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormHint>
                      Chỉ hiện các tài nguyên có giới hạn theo phạm vi dữ liệu.
                    </FormHint>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid gap-6 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="action"
                rules={{ required: "Bắt buộc chọn hành động" }}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Hành động</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value ?? ""}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Vui lòng chọn hành động" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {ACTIONS.map((candidate) => (
                          <SelectItem key={candidate} value={candidate}>
                            {actionLabel(candidate)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormHint>
                      {action === "write"
                        ? "Kiểm tra hai lần: trước khi sửa và sau khi lưu."
                        : "Áp dụng mỗi khi thực hiện hành động này trên tài nguyên."}
                    </FormHint>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/*
                A filter has no role by design. Showing the picker disabled
                rather than hiding it is what makes that visible as a decision
                instead of looking like a field somebody forgot.
              */}
              <FormField
                control={form.control}
                name="role.id"
                rules={{
                  validate: (value) =>
                    kind === "FILTER" ||
                    value != null ||
                    "Phạm vi phải chỉ định vai trò mà nó mở rộng",
                }}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Vai trò</FormLabel>
                    {/*
                      Role ids are numbers on the wire but `Select` compares its
                      values as strings, so the conversion happens at this
                      boundary and nowhere else.
                    */}
                    <Select
                      onValueChange={(next) => field.onChange(Number(next))}
                      value={
                        field.value === null || field.value === undefined
                          ? ""
                          : String(field.value)
                      }
                      disabled={kind === "FILTER" || lockRole}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue
                            placeholder={
                              kind === "FILTER"
                                ? "Bộ lọc áp dụng cho mọi người"
                                : roleQuery.isLoading
                                  ? "Đang tải..."
                                  : "Vui lòng chọn vai trò"
                            }
                          />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {roleChoices.map((option) => (
                          <SelectItem
                            key={String(option.value)}
                            value={String(option.value)}
                          >
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {lockRole && (
                      <FormHint>
                        Phạm vi này thuộc về vai trò đang sửa. Muốn đặt cho vai
                        trò khác thì mở vai trò đó.
                      </FormHint>
                    )}
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="name"
              rules={mergeRules(textRules("NAME", "Tên", { max: 160 }), { required: "Bắt buộc nhập tên" })}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tên</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      value={field.value ?? ""}
                      placeholder="Công việc trong phòng ban của tôi"
                      maxLength={maxLengthOf("NAME", 160)}
                    />
                  </FormControl>
                  <FormHint>
                    Đặt tên nói rõ quy tắc cho phép gì. Tên này hiện trong nhật
                    ký.
                  </FormHint>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid gap-6 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="policyGroup"
                rules={{ maxLength: { value: 64, message: "Nhóm tối đa 64 ký tự" } }}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nhóm</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        value={field.value ?? ""}
                        placeholder="Theo phòng ban"
                        maxLength={64}
                      />
                    </FormControl>
                    <FormHint>
                      Chỉ dùng để gom nhóm khi hiển thị.
                    </FormHint>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="enabled"
                render={({ field }) => (
                  <FormItem className="flex flex-col gap-2">
                    <FormLabel>Đang bật</FormLabel>
                    <FormControl>
                      <Switch
                        checked={field.value ?? true}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                    <FormHint>
                      {kind === "FILTER"
                        ? "Tắt bộ lọc là gỡ một hạn chế khỏi mọi người."
                        : "Tắt phạm vi là thu hẹp vai trò sở hữu nó."}
                    </FormHint>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="description"
              rules={textRules("NOTE", "Mô tả")}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Mô tả</FormLabel>
                  <FormControl>
                    <Textarea
                      {...field}
                      value={field.value ?? ""}
                      rows={3}
                      maxLength={maxLengthOf("NOTE")}
                      placeholder="Vì sao quy tắc này tồn tại, cho người đọc sau"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Những dòng nó khớp</CardTitle>
            <CardDescription>
              Chỉ chọn được những điều kiện có sẵn bên dưới, không gõ tự do.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {metadata && (
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <span className="text-muted-foreground">
                  Vai trò không có phạm vi trên tài nguyên này:
                </span>
                <Badge
                  variant={
                    metadata.defaultScope === "FULL" ? "secondary" : "outline"
                  }
                >
                  {metadata.defaultScope === "FULL"
                    ? "thấy tất cả"
                    : "không thấy gì"}
                </Badge>
              </div>
            )}

            {metadata && metadata.designTime.length > 0 && (
              <Alert>
                <AlertDescription className="flex flex-col gap-1">
                  <span className="font-medium">
                    Các quy tắc cố định sau cũng đang áp dụng, không sửa được ở đây:
                  </span>
                  {metadata.designTime.map((declared, index) => (
                    <span key={index} className="text-sm">
                      {kindLabel(declared.kind)} · {actionLabel(declared.action)}
                      {declared.role ? ` · ${declared.role}` : ""} —{" "}
                      {declared.name}
                    </span>
                  ))}
                </AlertDescription>
              </Alert>
            )}

            <FormField
              control={form.control}
              name="scope"
              render={({ field }) => (
                <FormItem>
                  <FormControl>
                    <div>
                      <ScopeBuilder
                        metadata={metadata}
                        value={field.value}
                        onChange={field.onChange}
                        action={action}
                        disabled={metadataQuery.isLoading}
                      />
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        {/*
          Only `write` leaves a new state behind, so only `write` has a second
          clause. Showing this card for `read` or `delete` would invite somebody
          to fill in a condition that is never consulted.
        */}
        {action === "write" && (
          <Card>
            <CardHeader>
              <CardTitle>Sau khi lưu được phép là gì</CardTitle>
              <CardDescription>
                Điều kiện trên cho biết dữ liệu nào được sửa. Điều kiện này cho
                biết dữ liệu <b>sau</b> khi lưu phải thế nào.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <FormField
                control={form.control}
                name="checkScope"
                render={({ field }) => (
                  <FormItem className="space-y-4">
                    <div className="flex items-start gap-3">
                      <FormControl>
                        <Switch
                          checked={field.value === null || field.value === undefined}
                          onCheckedChange={(sameAsAbove) =>
                            // Null and an empty tree are opposites here: null
                            // reuses the condition above, an empty tree allows
                            // any resulting state at all.
                            field.onChange(sameAsAbove ? null : EMPTY_SCOPE)
                          }
                        />
                      </FormControl>
                      <div className="space-y-1">
                        <FormLabel>Áp dụng cùng điều kiện sau khi lưu</FormLabel>
                        <FormHint>
                          Nên bật khi điều kiện trên nói về dữ liệu{" "}
                          <b>của ai</b>, như phòng ban, danh mục, người sở hữu.
                          Người sửa sẽ không chuyển được dữ liệu ra ngoài phạm
                          vi của mình.
                        </FormHint>
                      </div>
                    </div>

                    {field.value !== null && field.value !== undefined && (
                      <>
                        <Alert>
                          <AlertDescription>
                            Tắt khi điều kiện trên nói về <b>trạng thái</b>,
                            nếu không thì bản nháp sẽ mãi là bản nháp. Để trống
                            phần bên dưới là cho phép lưu ở mọi trạng thái.
                          </AlertDescription>
                        </Alert>
                        <FormControl>
                          <div>
                            <ScopeBuilder
                              metadata={metadata}
                              value={field.value}
                              onChange={field.onChange}
                              action={action}
                              disabled={metadataQuery.isLoading}
                            />
                          </div>
                        </FormControl>
                      </>
                    )}
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>
        )}
      </div>
    </Form>
  );
}
