import { useMemo, useState } from "react";
import { useSearchParams } from "react-router";

import { EmailMfaCard } from "./mfa-card";
import { NotificationPreferencesCard } from "./notification-card";
import { SessionsCard } from "@/shared/components/security/sessions-card";
import {
  useCustomMutation,
  useGetIdentity,
  useNotification,
  useOne,
  useTranslate,
} from "@refinedev/core";
import { useQuery } from "@tanstack/react-query";
import { AtSign, BadgeCheck, Bell, Check, KeyRound, Mail, MonitorSmartphone, School, Search, ShieldCheck, X } from "lucide-react";

import { API_URL } from "@/shared/api/constants";
import { kyInstance } from "@/shared/api/data";
import {
  getAuthorities,
  saveSession,
  type Identity,
  type TokenPair,
} from "@/shared/api/session";
import { initialsOf } from "@/shared/lib/format";
import { SYSTEM_ROLE_LABELS } from "@/domains/role/types";
import { Button } from "@/shared/ui/button";
import { Label } from "@/shared/ui/label";
import { Input } from "@/shared/ui/input";
import { InputPassword } from "@/shared/components/form/input-password";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/shared/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/shared/ui/table";
import { PasswordRules } from "@/shared/components/form/password-rules";
import { isPrivileged, passwordOk } from "@/shared/lib/password-policy";
import { LIFT_ROW } from "@/shared/lib/row-lift";
import { cn } from "@/shared/lib/utils";
import { TableEmpty } from "@/shared/components/data-table/table-empty";

/** Các hành động một mã quyền có thể mang, theo thứ tự cột của bảng quyền. */
const ACTIONS = [
  { key: "read", label: "Xem" },
  { key: "write", label: "Ghi" },
  { key: "delete", label: "Xoá" },
  { key: "approve", label: "Duyệt" },
  { key: "export", label: "Xuất" },
] as const;

/**
 * The signed-in user's own account.
 *
 * Not a Refine resource: there is no list of "my accounts" and no id in the
 * URL. It reads the identity from the auth provider and posts to
 * `/auth/change-password`, which is the one password endpoint that does not
 * need a permission — every account may change its own.
 *
 * <p>Quyền hiện thành BẢNG (mỗi chức năng một dòng, mỗi hành động một cột) chứ không
 * thành một chip mỗi mã: hai trăm mã quyền là một bức tường không ai đọc, còn bảng trả
 * lời đúng câu người ta hỏi — "tôi làm được gì với phiếu nhập".
 */
export const Profile = () => {
  // `?tab=security|sessions|permissions` mở đúng tab — dải nhắc bảo mật dẫn thẳng tới việc cần làm. Đổi mật khẩu và xác
  // thực qua email gộp một tab "Bảo mật" (theo trưởng nhóm); liên kết cũ `?tab=password|mfa` vẫn mở tab đó.
  const [search] = useSearchParams();
  const asked = search.get("tab") ?? "";
  const initialTab = asked === "password" || asked === "mfa" ? "security"
    : ["security", "sessions", "notifications", "permissions"].includes(asked) ? asked : "security";
  const { data: identity } = useGetIdentity<Identity>();
  // Roles and permissions are not part of the identity: they come from
  // `/auth/permissions`, which `authProvider.check` has already fetched and
  // cached by the time any route inside the shell renders.
  const authorities = getAuthorities();
  const t = useTranslate();
  const { data: mfaData } = useQuery({
    queryKey: ["auth", "mfa"],
    queryFn: ({ signal }) => kyInstance.get("auth/mfa", { signal }).json<{ email: boolean }>(),
  });
  const mfaOn = mfaData && "email" in mfaData ? mfaData.email : undefined;
  // Tài khoản của một trường thì nói luôn trường nào.
  const { result: school } = useOne<{ id: number; name: string }>({
    resource: "schools",
    id: authorities?.schoolId ?? "",
    queryOptions: { enabled: authorities?.schoolId != null },
  });

  const [permFilter, setPermFilter] = useState("");
  const rows = useMemo(() => {
    const byResource = new Map<string, Set<string>>();
    for (const code of authorities?.permissions ?? []) {
      const [resource, action] = code.split(":");
      if (!byResource.has(resource)) byResource.set(resource, new Set());
      byResource.get(resource)!.add(action);
    }
    return [...byResource.entries()]
      .map(([resource, actions]) => ({
        resource,
        label: t(`${resource}.${resource}`, resource),
        actions,
      }))
      .sort((a, b) => a.label.localeCompare(b.label, "vi"));
  }, [authorities, t]);
  const q = permFilter.trim().toLowerCase();
  const shownRows = q ? rows.filter((r) => r.label.toLowerCase().includes(q) || r.resource.includes(q)) : rows;

  const roleNames = (authorities?.roles ?? []).map((role) => SYSTEM_ROLE_LABELS[role] ?? role);
  // Cột "Giới thiệu": mỗi dòng một biểu tượng và một câu, như trang cá nhân.
  const intro: { icon: React.ReactNode; text: React.ReactNode }[] = [
    ...(school?.name ? [{ icon: <School />, text: <>Công tác tại <b className="font-semibold">{school.name}</b></> }] : []),
    ...(roleNames.length ? [{ icon: <BadgeCheck />, text: <>Vai trò <b className="font-semibold">{roleNames.join(", ")}</b></> }] : []),
    { icon: <AtSign />, text: identity?.username ?? "—" },
    ...(identity?.email ? [{ icon: <Mail />, text: identity.email }] : []),
    { icon: <KeyRound />, text: <>Được dùng <b className="font-semibold">{rows.length}</b> chức năng</> },
    {
      icon: <ShieldCheck />,
      text: mfaOn === undefined ? "Xác thực qua email…" : mfaOn ? "Đã bật xác thực qua email" : (
        <span className="text-warning-text">Chưa bật xác thực qua email</span>
      ),
    },
  ];
  const tab = "gap-1.5";

  return (
    <Tabs defaultValue={initialTab} className="screen-enter min-w-0 gap-4">
      {/* Đầu trang gọn: ảnh tài khoản, tên, vai và trường, rồi hàng tab ngay dưới — không ảnh bìa, không hoạ tiết. */}
      <Card className="gap-0 overflow-hidden py-0">
        <div className="flex items-center gap-4 px-6 py-4">
          <span className="bg-primary text-primary-foreground flex size-14 shrink-0 items-center justify-center rounded-full text-xl font-semibold">
            {initialsOf(identity?.fullName ?? identity?.username)}
          </span>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-xl font-semibold tracking-tight">{identity?.fullName ?? <span className="text-muted-foreground">Chưa khai họ tên</span>}</h1>
            <p className="text-muted-foreground truncate text-sm">
              {[roleNames.join(", "), school?.name].filter(Boolean).join(" · ") || `@${identity?.username ?? ""}`}
            </p>
          </div>
          {/* Thông tin nhanh bên phải đầu trang: tên đăng nhập, số chức năng, xác thực qua email (nhắc màu cam khi chưa bật). */}
          <div className="hidden flex-wrap justify-end gap-2 md:flex">
            <span className="bg-muted/60 flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs">
              <AtSign className="text-muted-foreground size-3.5" />
              {identity?.username ?? "—"}
            </span>
            <span className="bg-muted/60 flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs">
              <KeyRound className="text-muted-foreground size-3.5" />
              <b className="font-semibold tabular-nums">{rows.length}</b> chức năng
            </span>
            {mfaOn === undefined ? null : (
              <span className={mfaOn
                ? "bg-success-subtle text-success-text flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium"
                : "bg-warning-subtle text-warning-text flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium"}>
                <ShieldCheck className="size-3.5" />
                {mfaOn ? "Đã bật xác thực qua email" : "Chưa bật xác thực qua email"}
              </span>
            )}
          </div>
        </div>
        <TabsList className="mx-4 mb-4">
          {/* Mật khẩu và xác thực qua email chung một tab "Bảo mật"; phiên đăng nhập, quyền mỗi thứ một tab riêng. */}
          <TabsTrigger value="security" className={tab}>
            <ShieldCheck className="size-4" />
            Bảo mật
          </TabsTrigger>
          <TabsTrigger value="sessions" className={tab}>
            <MonitorSmartphone className="size-4" />
            Phiên đăng nhập
          </TabsTrigger>
          <TabsTrigger value="notifications" className={tab}>
            <Bell className="size-4" />
            Thông báo
          </TabsTrigger>
          <TabsTrigger value="permissions" className={tab}>
            <BadgeCheck className="size-4" />
            Quyền truy cập
          </TabsTrigger>
        </TabsList>
      </Card>

      <div className="grid items-start gap-4 lg:grid-cols-[20rem_minmax(0,1fr)]">
        <Card className="gap-3 lg:sticky lg:top-16">
          <CardHeader>
            <CardTitle className="text-base">Giới thiệu</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-3 text-sm">
              {intro.map((item, i) => (
                <li key={i} className="flex items-start gap-3">
                  <span className="text-muted-foreground mt-0.5 shrink-0 [&_svg]:size-4.5">{item.icon}</span>
                  <span className="min-w-0 break-words">{item.text}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <div className="min-w-0">
          {/* Hai cột trên màn rộng: mật khẩu bên trái, xác thực qua email bên phải — xếp dọc thì nửa phải trống. */}
          <TabsContent value="security" className="mt-0 grid items-start gap-4 xl:grid-cols-2">
            <ChangePasswordCard />
            <EmailMfaCard />
          </TabsContent>
          <TabsContent value="sessions" className="mt-0">
            <SessionsCard source="auth/sessions" endPath={(id) => `auth/sessions/${id}`} endOthers="auth/sessions/end-others" />
          </TabsContent>

          <TabsContent value="notifications" className="mt-0">
            <NotificationPreferencesCard email={identity?.email} />
          </TabsContent>
          <TabsContent value="permissions" className="mt-0">
          <Card className="gap-0 py-0">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b px-5 py-3">
              <h3 className="text-sm font-semibold">Quyền theo chức năng</h3>
              <div className="relative w-full sm:w-72">
                <Search className="text-muted-foreground absolute top-1/2 left-2.5 size-4 -translate-y-1/2" />
                <Input value={permFilter} onChange={(e) => setPermFilter(e.target.value)} placeholder="Tìm chức năng..."
                  className="h-8 pl-8" />
              </div>
            </div>
            <div className="max-h-[60vh] overflow-auto">
              <Table>
                <TableHeader className="bg-surface-subtle sticky top-0 z-10">
                  <TableRow>
                    <TableHead>Chức năng</TableHead>
                    {ACTIONS.map((a) => (
                      <TableHead key={a.key} className="w-20 text-center">{a.label}</TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {shownRows.length === 0 ? (
                    <TableEmpty colSpan={ACTIONS.length + 1} compact title={<>Không có chức năng nào khớp.</>} />
                  ) : (
                    shownRows.map((r) => (
                      <TableRow key={r.resource} className={cn("group/row", LIFT_ROW)}>
                        <TableCell className="py-2">
                          <span className="font-medium">{r.label}</span>
                        </TableCell>
                        {ACTIONS.map((a) => (
                          <TableCell key={a.key} className="py-2 text-center">
                            {r.actions.has(a.key) ? (
                              <Check className="text-success-text mx-auto size-4" aria-label="Được phép" />
                            ) : (
                              <X className="text-destructive-text mx-auto size-3.5 opacity-60" aria-label="Không được phép" />
                            )}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </Card>
        </TabsContent>
        </div>
      </div>
    </Tabs>
  );
};

/** Đổi mật khẩu của chính mình — các phiên khác bị đăng xuất, phiên này giữ. */
function ChangePasswordCard() {
  const { open } = useNotification();
  const { mutate, mutation } = useCustomMutation<TokenPair>();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const privileged = isPrivileged(getAuthorities()?.roles);
  const mismatch = confirmPassword.length > 0 && newPassword !== confirmPassword;
  // Máy chủ cũng chặn; báo sớm để người dùng không phải đợi một lần gửi hỏng.
  const sameAsCurrent = newPassword.length > 0 && newPassword === currentPassword;
  const canSubmit = currentPassword.length > 0 && passwordOk(newPassword, privileged) && newPassword === confirmPassword
    && !sameAsCurrent;

  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!canSubmit) return;

    mutate(
      {
        url: `${API_URL}/auth/change-password`,
        method: "post",
        values: { currentPassword, newPassword },
        // The rest provider sends a custom-call body as a plain string, so
        // without this the request arrives with no content type and Spring
        // answers 415 before the handler is reached.
        config: { headers: { "Content-Type": "application/json" } },
        successNotification: false,
      },
      {
        onSuccess: ({ data }) => {
          // The server ends every other session and hands back a fresh pair for
          // this one. Storing it is what keeps the person who just changed
          // their password from being signed out by their own action.
          if (data?.accessToken) {
            saveSession(data);
          }
          setCurrentPassword("");
          setNewPassword("");
          setConfirmPassword("");
          open?.({
            type: "success",
            message: "Đã đổi mật khẩu",
            description: "Đã đăng xuất khỏi các thiết bị khác.",
          });
        },
      }
    );
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <KeyRound className="text-primary size-4" />
          Đổi mật khẩu
        </CardTitle>
        <CardDescription>Đổi xong, các thiết bị khác sẽ bị đăng xuất. Máy này vẫn dùng tiếp.</CardDescription>
      </CardHeader>
      <CardContent>
        {/* Ba ô một cột; luật mật khẩu là hàng viên nhỏ ngay dưới ô Mật khẩu mới. */}
        <div className="grid max-w-xl items-start gap-5">
        <form onSubmit={submit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="current-password">Mật khẩu hiện tại</Label>
            <InputPassword
              id="current-password"
              autoComplete="current-password"
              required
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
            />
          </div>

          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="new-password">Mật khẩu mới</Label>
              <InputPassword
                id="new-password"
                autoComplete="new-password"
                placeholder="Tối thiểu 8 ký tự"
                minLength={8}
                required
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />
              <PasswordRules value={newPassword} privileged={privileged} />
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="confirm-password">Xác nhận mật khẩu mới</Label>
              <InputPassword
                id="confirm-password"
                autoComplete="new-password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
            </div>
          </div>
          {mismatch && <p className="text-destructive text-sm">Hai mật khẩu không khớp.</p>}
          {sameAsCurrent && <p className="text-destructive text-sm">Mật khẩu mới phải khác mật khẩu hiện tại.</p>}

          <div>
            <Button type="submit" disabled={!canSubmit || mutation.isPending}>
              {mutation.isPending ? "Đang đổi..." : "Đổi mật khẩu"}
            </Button>
          </div>
        </form>
        </div>
      </CardContent>
    </Card>
  );
}
