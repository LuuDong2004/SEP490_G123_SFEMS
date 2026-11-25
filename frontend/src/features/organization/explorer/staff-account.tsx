import { useCan, useInvalidate, useNotification } from "@refinedev/core";
import { Check, Copy, KeyRound, Lock, LockOpen, UserCheck, UserMinus, UserPlus, UserX } from "lucide-react";
import { useState } from "react";

import { kyInstance } from "@/shared/api/data";
import { CampusScopeSelect } from "@/shared/components/campus/campus";
import { errorMessage } from "@/shared/lib/api-error";
import { maxLengthOf, textError } from "@/shared/lib/field-rules";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/shared/ui/dialog";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/shared/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/ui/select";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/shared/ui/tooltip";

/* eslint-disable @typescript-eslint/no-explicit-any */

/** Vai phía trường cấp ở lối này (vai loại trường, docs/kien-truc/11 §11). */
const ROLES = [
  { code: "SCHOOL_STAFF", label: "Cán bộ thiết bị (CSVC)" },
  { code: "SCHOOL_LEADER", label: "Lãnh đạo trường" },
];

/** Vai mặc định theo chức vụ — như `StaffAccountService.defaultRole`; chức vụ khác phải chọn. */
function defaultRole(staff: any) {
  if (staff.position === "HIEU_TRUONG" || staff.position === "PHO_HIEU_TRUONG") return "SCHOOL_LEADER";
  return staff.position === "CAN_BO_THIET_BI" ? "SCHOOL_STAFF" : "";
}

/** `invitedEmail`: email (đã che) đã nhận thư mời tự đặt mật khẩu — máy chủ gửi khi cán bộ có email. */
export type Issued = { userId: number; username: string; role: string | null; temporaryPassword: string; invitedEmail?: string | null };

/** Hiện tên đăng nhập + mật khẩu tạm MỘT lần, có nút chép. */
export function CredentialsDialog({ issued, name, onClose }: { issued: Issued | null; name: string; onClose: () => void }) {
  const [copied, setCopied] = useState(false);
  const text = issued ? `Tên đăng nhập: ${issued.username}\nMật khẩu: ${issued.temporaryPassword}` : "";
  return (
    <Dialog open={!!issued} onOpenChange={(o) => !o && onClose()}>
      <DialogContent size="sm" onClick={(e) => e.stopPropagation()}>
        <DialogHeader>
          <DialogTitle>Tài khoản của {name}</DialogTitle>
          <DialogDescription>
            {issued?.invitedEmail
              ? `Đã gửi thư tới ${issued.invitedEmail} — cán bộ mở link trong thư để tự đặt mật khẩu. Mật khẩu tạm dưới đây chỉ dùng khi thư không tới.`
              : "Đưa thông tin này cho cán bộ. Mật khẩu chỉ hiện một lần, đăng nhập xong nên đổi mật khẩu."}
          </DialogDescription>
        </DialogHeader>
        <dl className="bg-surface-subtle divide-y rounded-lg border text-sm">
          <div className="flex justify-between gap-4 px-4 py-2.5">
            <dt className="text-muted-foreground">Tên đăng nhập</dt>
            <dd className="font-mono font-medium">{issued?.username}</dd>
          </div>
          <div className="flex justify-between gap-4 px-4 py-2.5">
            <dt className="text-muted-foreground">Mật khẩu tạm</dt>
            <dd className="font-mono font-medium">{issued?.temporaryPassword}</dd>
          </div>
        </dl>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              void navigator.clipboard?.writeText(text);
              setCopied(true);
            }}
          >
            {copied ? <Check /> : <Copy />}
            {copied ? "Đã chép" : "Chép"}
          </Button>
          <Button type="button" onClick={onClose}>Xong</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Ô "Tài khoản" của một dòng cán bộ: đã cấp thì tên đăng nhập + trạng thái + đặt lại mật khẩu /
 * khoá; chưa cấp thì nút "Cấp tài khoản" (với người có `staff_accounts:write`). Mọi nút chặn sự
 * kiện lan lên dòng — bấm dòng là mở hồ sơ cán bộ.
 */
export function StaffAccountCell({ staff }: { staff: any }) {
  const canManage = useCan({ resource: "staff_accounts", action: "edit" }).data?.can ?? false;
  const [creating, setCreating] = useState(false);
  const [role, setRole] = useState(defaultRole(staff));
  const [username, setUsername] = useState("");
  const [campus, setCampus] = useState<number | null>(null);
  const usernameError = textError("USERNAME", "Tên đăng nhập", username);
  const [issued, setIssued] = useState<Issued | null>(null);
  const [busy, setBusy] = useState(false);
  const { open: notify } = useNotification();
  const invalidate = useInvalidate();
  const account = staff.account as { username: string; status: string } | null;

  async function call(path: string, json?: unknown) {
    setBusy(true);
    try {
      const res = await kyInstance.post(`staff/${staff.id}/account${path}`, json === undefined ? undefined : { json }).json<any>();
      invalidate({ resource: "staff", invalidates: ["list", "detail"] });
      return res;
    } catch (e) {
      notify?.({ type: "error", message: await errorMessage(e) });
      return null;
    } finally {
      setBusy(false);
    }
  }

  const stop = (e: React.MouseEvent) => e.stopPropagation();

  if (account) {
    const active = account.status === "active";
    // Một biểu tượng: xanh = đang dùng được, xám = đã khoá. Bấm mở ô nhỏ: tên đăng nhập và thao tác.
    return (
      <div className="flex justify-center" onClick={stop}>
        <Popover>
          <Tooltip>
            <TooltipTrigger asChild>
              <PopoverTrigger asChild>
                <Button type="button" variant="ghost" size="icon-sm" aria-label={`Tài khoản ${account.username}`}
                  className={active ? "text-success-text" : "text-muted-foreground"}>
                  {active ? <UserCheck /> : <UserX />}
                </Button>
              </PopoverTrigger>
            </TooltipTrigger>
            <TooltipContent>{account.username} · {active ? "Hoạt động" : "Đã khoá"}</TooltipContent>
          </Tooltip>
          <PopoverContent align="end" className="w-64 space-y-3 p-3" onClick={stop}>
            <div className="space-y-1">
              <div className="text-muted-foreground text-xs">Tên đăng nhập</div>
              <div className="flex items-center justify-between gap-2">
                <span className="font-mono text-sm font-medium">{account.username}</span>
                <Badge variant={active ? "success" : "neutral"}>{active ? "Hoạt động" : "Đã khoá"}</Badge>
              </div>
            </div>
            {canManage ? (
              <div className="grid gap-1.5">
                <Button type="button" variant="outline" size="sm" disabled={busy} className="justify-start"
                  onClick={async () => {
                    const res = await call("/password");
                    if (res) setIssued(res);
                  }}>
                  <KeyRound />
                  Đặt lại mật khẩu
                </Button>
                <Button type="button" variant="outline" size="sm" disabled={busy} className="justify-start"
                  onClick={async () => {
                    const res = await call("/status", { active: !active });
                    if (res) notify?.({ type: "success", message: active ? "Đã khoá tài khoản" : "Đã mở khoá tài khoản" });
                  }}>
                  {active ? <Lock /> : <LockOpen />}
                  {active ? "Khoá tài khoản" : "Mở khoá"}
                </Button>
              </div>
            ) : null}
          </PopoverContent>
        </Popover>
        <CredentialsDialog issued={issued} name={staff.name} onClose={() => setIssued(null)} />
      </div>
    );
  }

  if (!canManage) {
    return (
      <div className="flex justify-center">
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="text-muted-foreground/60 inline-flex size-8 items-center justify-center" aria-label="Chưa có tài khoản">
              <UserMinus className="size-4" />
            </span>
          </TooltipTrigger>
          <TooltipContent>Chưa có tài khoản</TooltipContent>
        </Tooltip>
      </div>
    );
  }

  return (
    <div className="flex justify-center" onClick={stop}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button type="button" variant="ghost" size="icon-sm" aria-label="Cấp tài khoản" className="text-primary" onClick={() => setCreating(true)}>
            <UserPlus />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Cấp tài khoản</TooltipContent>
      </Tooltip>
      <Dialog open={creating} onOpenChange={setCreating}>
        <DialogContent size="sm" onClick={stop}>
          <DialogHeader>
            <DialogTitle>Cấp tài khoản cho {staff.name}</DialogTitle>
            <DialogDescription>Tài khoản thuộc trường này. Mật khẩu tạm chỉ hiện một lần sau khi cấp.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label>Vai trò</Label>
              <Select value={role} onValueChange={setRole}>
                <SelectTrigger className="w-full"><SelectValue placeholder="Vui lòng chọn vai trò" /></SelectTrigger>
                <SelectContent>
                  {ROLES.map((r) => <SelectItem key={r.code} value={r.code}>{r.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor={`username-${staff.id}`}>Tên đăng nhập</Label>
              <Input id={`username-${staff.id}`} value={username} placeholder="Để trống: mã trường.mã cán bộ"
                maxLength={maxLengthOf("USERNAME")} aria-invalid={usernameError ? true : undefined}
                onChange={(e) => setUsername(e.target.value.replace(/[^A-Za-z0-9._-]/g, "").toLowerCase())} />
              {usernameError ? <p className="text-destructive text-sm">{usernameError}</p> : null}
            </div>
            <div className="grid gap-2">
              <Label htmlFor={`campus-${staff.id}`}>Phạm vi</Label>
              <CampusScopeSelect id={`campus-${staff.id}`} value={campus} onChange={setCampus} schoolId={staff.school?.id} />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setCreating(false)}>Huỷ</Button>
            <Button type="button" disabled={busy || !role || !!usernameError} onClick={async () => {
              const res = await call("", { role, username: username || null, campus: { id: campus } });
              if (res) {
                setCreating(false);
                setIssued(res);
              }
            }}>
              Cấp tài khoản
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <CredentialsDialog issued={issued} name={staff.name} onClose={() => setIssued(null)} />
    </div>
  );
}
