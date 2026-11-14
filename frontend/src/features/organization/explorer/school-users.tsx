import { useCan, useInvalidate, useNotification } from "@refinedev/core";
import { KeyRound, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";

import { kyInstance } from "@/shared/api/data";
import { FillBox } from "@/shared/components/layout/fill-box";
import { getIdentity } from "@/shared/api/session";
import { ListView, ListViewHeader } from "@/shared/components/views/list-view";
import { errorMessage } from "@/shared/lib/api-error";
import { inputModeOf, maxLengthOf, textError } from "@/shared/lib/field-rules";
import { formatDateTime } from "@/shared/lib/format";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Card } from "@/shared/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/shared/ui/dialog";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/ui/select";
import { MiniTable, type MiniColumn } from "@/features/organization/explorer/mini-table";
import { CredentialsDialog, type Issued } from "@/features/organization/explorer/staff-account";

/* eslint-disable @typescript-eslint/no-explicit-any */

/** Vai phía trường (vai loại trường, docs/kien-truc/11 §11). */
const ROLES = [
  { code: "SCHOOL_STAFF", label: "Cán bộ thiết bị (CSVC)" },
  { code: "SCHOOL_LEADER", label: "Lãnh đạo trường" },
];

const STATUS = {
  active: { label: "Hoạt động", variant: "success" },
  inactive: { label: "Đã khoá", variant: "neutral" },
  locked: { label: "Bị khoá (bảo mật)", variant: "warning" },
} as const;

const dash = <span className="text-muted-foreground">—</span>;

const COLUMNS: MiniColumn[] = [
  { header: "Tên đăng nhập", cell: (r) => <span className="font-mono text-sm">{r.username}</span>, className: "w-56" },
  { header: "Họ tên", cell: (r) => r.fullName },
  { header: "Email", cell: (r) => (r.email?.endsWith("@qltb.local") ? dash : r.email) },
  { header: "Vai trò", cell: (r) => r.roles?.map((x: any) => x.name).join(", ") || dash },
  {
    header: "Trạng thái",
    cell: (r) => {
      const s = STATUS[r.status as keyof typeof STATUS];
      return s ? <Badge variant={s.variant}>{s.label}</Badge> : r.status;
    },
  },
  { header: "Đăng nhập gần nhất", cell: (r) => (r.lastLoginAt ? formatDateTime(r.lastLoginAt) : <span className="text-muted-foreground">Chưa đăng nhập</span>) },
];

type IssuedResponse = { user: any; temporaryPassword: string };

function toIssued(res: IssuedResponse): Issued {
  return { userId: res.user.id, username: res.user.username, role: null, temporaryPassword: res.temporaryPassword };
}

/**
 * Hộp thoại thêm (`user` rỗng) / sửa một tài khoản của trường. Sửa: họ tên, email, vai, khoá / mở;
 * kèm đặt lại mật khẩu và xoá. Mật khẩu không bao giờ gõ ở đây — máy sinh, hiện một lần.
 */
function UserDialog({ open, user, onClose, onIssued }: {
  open: boolean;
  user: any | null;
  onClose: () => void;
  onIssued: (issued: Issued, name: string) => void;
}) {
  const [username, setUsername] = useState("");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("SCHOOL_STAFF");
  const [status, setStatus] = useState("active");
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const { open: notify } = useNotification();
  const invalidate = useInvalidate();
  // Chính mình: không tự đổi vai / tự khoá (máy chủ cũng chặn) — tự khoá mình là mất lối vào.
  const self = !!user && String(user.id) === String(getIdentity()?.id);
  const mayDelete = useCan({ resource: "school_users", action: "delete" }).data?.can ?? false;
  const usernameError = user ? undefined : textError("USERNAME", "Tên đăng nhập", username, 100);
  const nameError = textError("NAME", "Họ tên", fullName);
  const emailError = textError("EMAIL", "Email", email);
  const invalid = !!(usernameError || nameError || emailError);

  useEffect(() => {
    if (!open) return;
    setUsername(user?.username ?? "");
    setFullName(user?.fullName ?? "");
    setEmail(user?.email?.endsWith("@qltb.local") ? "" : user?.email ?? "");
    setRole(user?.roles?.[0]?.code ?? "TEACHER");
    setStatus(user?.status === "inactive" ? "inactive" : "active");
    setConfirmDelete(false);
  }, [open, user]);

  async function run(fn: () => Promise<void>) {
    setBusy(true);
    try {
      await fn();
      invalidate({ resource: "school_users", invalidates: ["list"] });
    } catch (e) {
      notify?.({ type: "error", message: await errorMessage(e) });
    } finally {
      setBusy(false);
    }
  }

  const save = () =>
    run(async () => {
      if (user) {
        await kyInstance.patch(`school_users/${user.id}`, { json: { fullName, email, role, status } });
        notify?.({ type: "success", message: "Đã lưu tài khoản" });
        onClose();
      } else {
        const res = await kyInstance.post("school_users", { json: { username, fullName, email, role } }).json<IssuedResponse>();
        onClose();
        onIssued(toIssued(res), fullName);
      }
    });

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent size="sm">
        <DialogHeader>
          <DialogTitle>{user ? `Tài khoản ${user.username}` : "Thêm tài khoản"}</DialogTitle>
          <DialogDescription>
            {user ? "Tài khoản thuộc trường của bạn." : "Tài khoản thuộc trường của bạn. Mật khẩu tạm chỉ hiện một lần."}
          </DialogDescription>
        </DialogHeader>
        <div className="grid items-start gap-4 sm:grid-cols-2">
          <div className="grid gap-2">
            <Label htmlFor="su-username">Tên đăng nhập</Label>
            <Input id="su-username" value={username} disabled={!!user} placeholder="vd. gv.nguyenvana"
              maxLength={maxLengthOf("USERNAME", 100)} aria-invalid={usernameError ? true : undefined}
              onChange={(e) => setUsername(e.target.value.replace(/[^A-Za-z0-9._-]/g, "").toLowerCase())} />
            {usernameError ? <p className="text-destructive text-sm">{usernameError}</p> : null}
          </div>
          <div className="grid gap-2">
            <Label htmlFor="su-name">Họ tên</Label>
            <Input id="su-name" value={fullName} onChange={(e) => setFullName(e.target.value)}
              maxLength={maxLengthOf("NAME")} aria-invalid={nameError ? true : undefined} />
            {nameError ? <p className="text-destructive text-sm">{nameError}</p> : null}
          </div>
          <div className="grid gap-2 sm:col-span-2">
            <Label htmlFor="su-email">Email <span className="text-muted-foreground font-normal">(không bắt buộc)</span></Label>
            <Input id="su-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)}
              maxLength={maxLengthOf("EMAIL")} inputMode={inputModeOf("EMAIL")} aria-invalid={emailError ? true : undefined} />
            {emailError ? <p className="text-destructive text-sm">{emailError}</p> : null}
          </div>
          <div className="grid gap-2">
            <Label>Vai trò</Label>
            <Select value={role} onValueChange={setRole} disabled={!!self}>
              <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                {ROLES.map((r) => <SelectItem key={r.code} value={r.code}>{r.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          {user ? (
            <div className="grid gap-2">
              <Label>Trạng thái</Label>
              <Select value={status} onValueChange={setStatus} disabled={!!self}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Hoạt động</SelectItem>
                  <SelectItem value="inactive">Khoá (không cho đăng nhập)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          ) : null}
        </div>
        <DialogFooter className="sm:justify-between">
          {user ? (
            <div className="flex gap-2">
              <Button type="button" variant="outline" disabled={busy}
                onClick={() => run(async () => {
                  const res = await kyInstance.post(`school_users/${user.id}/password`).json<IssuedResponse>();
                  onClose();
                  onIssued(toIssued(res), user.fullName);
                })}>
                <KeyRound />
                Đặt lại mật khẩu
              </Button>
              {mayDelete ? (
                <Button type="button" variant={confirmDelete ? "destructive" : "ghost"} disabled={busy}
                  onClick={() => (confirmDelete
                    ? run(async () => {
                      await kyInstance.delete(`school_users/${user.id}`);
                      notify?.({ type: "success", message: "Đã xoá tài khoản" });
                      onClose();
                    })
                    : setConfirmDelete(true))}>
                  <Trash2 />
                  {confirmDelete ? "Bấm lần nữa để xoá" : "Xoá"}
                </Button>
              ) : null}
            </div>
          ) : <span />}
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={onClose}>Huỷ</Button>
            <Button type="button" disabled={busy || invalid || (!user && (!username || !fullName))} onClick={() => void save()}>
              {user ? "Lưu" : "Thêm tài khoản"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * "Tài khoản của trường" (Quản trị hệ thống) — lãnh đạo trường quản trị tài khoản đăng nhập của
 * trường mình qua `/school_users` (quyền `school_users:*`). Máy chủ tự giới hạn trong trường và
 * trong ba vai phía trường.
 */
export function SchoolUsersPage() {
  const [dialog, setDialog] = useState<{ open: boolean; user: any | null }>({ open: false, user: null });
  const [issued, setIssued] = useState<{ issued: Issued; name: string } | null>(null);
  return (
    <ListView>
      <ListViewHeader />
      <FillBox>
      <Card className="min-h-0 flex-1 p-5">
        <MiniTable
          resource="school_users"
          path="/school-users"
          filters={[]}
          columns={COLUMNS}
          emptyText="Trường chưa có tài khoản nào."
          createLabel="Thêm tài khoản"
          onCreate={() => setDialog({ open: true, user: null })}
          onOpen={(r) => setDialog({ open: true, user: r })}
        />
      </Card>
      </FillBox>
      <UserDialog
        open={dialog.open}
        user={dialog.user}
        onClose={() => setDialog({ open: false, user: null })}
        onIssued={(i, name) => setIssued({ issued: i, name })}
      />
      <CredentialsDialog issued={issued?.issued ?? null} name={issued?.name ?? ""} onClose={() => setIssued(null)} />
    </ListView>
  );
}
