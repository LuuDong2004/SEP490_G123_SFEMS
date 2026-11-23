import { useNotification } from "@refinedev/core";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Mail, ShieldAlert, ShieldCheck, Smartphone } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { useState, type ReactNode } from "react";

import { kyInstance } from "@/shared/api/data";
import { errorMessage } from "@/shared/lib/api-error";
import { Alert, AlertDescription, AlertTitle } from "@/shared/ui/alert";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/shared/ui/dialog";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { InputPassword } from "@/shared/components/form/input-password";

type MfaStatus = { enabled: boolean; required: boolean; pending: boolean; email: boolean; emailAddress: string | null };
type MfaSetup = { secret: string; otpauthUri: string };

const KEY = ["auth", "mfa"];

/** Ô nhập mã 6 số: chỉ nhận chữ số, chữ to, giãn cách để dễ đối chiếu với màn hình điện thoại. */
function CodeInput({ id, value, onChange }: { id: string; value: string; onChange: (v: string) => void }) {
  return (
    <Input id={id} inputMode="numeric" autoComplete="one-time-code" maxLength={6} placeholder="000000"
      className="w-40 text-center font-mono text-lg tracking-[0.4em]" value={value}
      onChange={(e) => onChange(e.target.value.replace(/\D/g, ""))} />
  );
}

/** Một cách xác thực: biểu tượng, tên, một dòng nói nó là gì, trạng thái, nút bên phải — như danh sách cài đặt. */
function MethodRow({ icon, title, hint, on, action }: { icon: ReactNode; title: string; hint: ReactNode; on: boolean; action: ReactNode }) {
  return (
    <div className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
      <span className="bg-primary/10 text-primary flex size-9 shrink-0 items-center justify-center rounded-full [&_svg]:size-4">{icon}</span>
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-2 text-sm font-medium">
          {title}
          {on ? <Badge variant="success">Đang bật</Badge> : <Badge variant="neutral">Chưa bật</Badge>}
        </p>
        <p className="text-muted-foreground truncate text-xs">{hint}</p>
      </div>
      {action}
    </div>
  );
}

/**
 * Xác thực hai lớp của chính người đang đăng nhập — MỘT thẻ, hai cách (ứng dụng, email) là hai dòng có trạng thái và
 * một nút; thao tác (quét QR, nhập mã, nhập lại mật khẩu) mở trong hộp thoại từng bước. Trước đây là hai thẻ, một ô
 * mật khẩu nằm sẵn không rõ để làm gì (theo trưởng nhóm: khó hiểu, khó dùng).
 */
/**
 * @param onChange gọi sau mỗi lần bật / tắt thành công, với "đang có lớp thứ hai nào không" (màn bắt buộc 2 lớp).
 * @param hideRequiredNote bỏ dòng nhắc "phải bật" — màn bắt buộc 2 lớp đã nói điều đó ở tiêu đề.
 */
export function TwoFactorCard({ onChange, hideRequiredNote }: { onChange?: (on: boolean) => void; hideRequiredNote?: boolean } = {}) {
  const { open: notify } = useNotification();
  const queryClient = useQueryClient();
  const { data } = useQuery({ queryKey: KEY, queryFn: ({ signal }) => kyInstance.get("auth/mfa", { signal }).json<MfaStatus>() });
  const status = data && "enabled" in data ? data : undefined;
  const appOn = status?.enabled ?? false;
  const emailOn = status?.email ?? false;

  const [dialog, setDialog] = useState<null | "app-setup" | "app-off" | "email">(null);
  const [setup, setSetup] = useState<MfaSetup | null>(null);
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  const close = () => {
    setDialog(null);
    setSetup(null);
    setCode("");
    setPassword("");
  };

  async function run(fn: () => Promise<unknown>, ok: string) {
    setBusy(true);
    try {
      await fn();
      notify?.({ type: "success", message: ok });
      await queryClient.invalidateQueries({ queryKey: KEY });
      close();
      const next = queryClient.getQueryData<MfaStatus>(KEY);
      if (next) onChange?.(next.enabled || next.email);
    } catch (error) {
      notify?.({ type: "error", message: await errorMessage(error) });
    } finally {
      setBusy(false);
    }
  }

  async function startAppSetup() {
    setBusy(true);
    try {
      setSetup(await kyInstance.post("auth/mfa/setup").json<MfaSetup>());
      setDialog("app-setup");
    } catch (error) {
      notify?.({ type: "error", message: await errorMessage(error) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <ShieldCheck className="text-primary size-4" />
          Xác thực hai lớp
          {appOn || emailOn ? <Badge variant="success">Đang bật</Badge> : <Badge variant="warning">Chưa bật</Badge>}
        </CardTitle>
        <CardDescription>Sau mật khẩu, đăng nhập cần thêm một mã 6 số.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {status?.required && !appOn && !hideRequiredNote ? (
          <Alert variant="destructive">
            <ShieldAlert />
            <AlertTitle>Tài khoản quản trị phải bật xác thực bằng ứng dụng</AlertTitle>
            <AlertDescription>Tài khoản có nhiều quyền nên cần bảo vệ kỹ hơn.</AlertDescription>
          </Alert>
        ) : null}

        <div className="divide-y">
          <MethodRow icon={<Smartphone />} title="Ứng dụng xác thực" on={appOn}
            hint={appOn ? "Mất điện thoại thì nhờ quản trị viên đặt lại" : "Google Authenticator, Microsoft Authenticator…"}
            action={appOn ? (
              <Button type="button" size="sm" variant="outline" onClick={() => setDialog("app-off")}>Tắt</Button>
            ) : (
              <Button type="button" size="sm" disabled={busy} onClick={() => void startAppSetup()}>Thiết lập</Button>
            )} />
          <MethodRow icon={<Mail />} title="Mã qua email" on={emailOn}
            hint={appOn && emailOn ? "Đang dùng ứng dụng — mã ứng dụng được hỏi trước"
              : status?.emailAddress ?? "Tài khoản chưa có email — nhờ quản trị viên khai"}
            action={
              <Button type="button" size="sm" variant={emailOn ? "outline" : "default"}
                disabled={!emailOn && !status?.emailAddress} onClick={() => setDialog("email")}>
                {emailOn ? "Tắt" : "Bật"}
              </Button>
            } />
        </div>
      </CardContent>

      {/* Thiết lập ứng dụng: hai bước, quét rồi nhập mã. */}
      <Dialog open={dialog === "app-setup"} onOpenChange={(o) => !o && close()}>
        <DialogContent size="auto" className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Thiết lập ứng dụng xác thực</DialogTitle>
            <DialogDescription>Dùng Google Authenticator, Microsoft Authenticator hoặc ứng dụng tương tự.</DialogDescription>
          </DialogHeader>
          {setup ? (
            <div className="space-y-4 text-sm">
              <div className="space-y-2">
                <p className="font-medium">1. Quét mã bằng ứng dụng</p>
                <div className="flex justify-center rounded-lg border bg-white p-3"><QRCodeSVG value={setup.otpauthUri} size={168} /></div>
                <p className="text-muted-foreground text-xs">Không quét được thì nhập khoá: <code className="break-all">{setup.secret}</code></p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="mfa-on-code" className="font-medium">2. Nhập mã 6 số ứng dụng đang hiện</Label>
                <CodeInput id="mfa-on-code" value={code} onChange={setCode} />
              </div>
            </div>
          ) : null}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={close}>Huỷ</Button>
            <Button type="button" disabled={busy || code.length !== 6}
              onClick={() => void run(() => kyInstance.post("auth/mfa/enable", { json: { code } }), "Đã bật xác thực bằng ứng dụng")}>
              Bật
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Tắt ứng dụng: cần một mã hiện tại. */}
      <Dialog open={dialog === "app-off"} onOpenChange={(o) => !o && close()}>
        <DialogContent size="auto" className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Tắt xác thực bằng ứng dụng</DialogTitle>
            <DialogDescription>Nhập mã 6 số ứng dụng đang hiện để xác nhận.</DialogDescription>
          </DialogHeader>
          <CodeInput id="mfa-off-code" value={code} onChange={setCode} />
          <DialogFooter>
            <Button type="button" variant="outline" onClick={close}>Giữ lại</Button>
            <Button type="button" variant="destructive" disabled={busy || code.length !== 6}
              onClick={() => void run(() => kyInstance.post("auth/mfa/disable", { json: { code } }), "Đã tắt xác thực bằng ứng dụng")}>
              Tắt
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bật / tắt email: nhập lại mật khẩu. */}
      <Dialog open={dialog === "email"} onOpenChange={(o) => !o && close()}>
        <DialogContent size="auto" className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{emailOn ? "Tắt mã qua email" : "Bật mã qua email"}</DialogTitle>
            <DialogDescription>
              {emailOn ? "Nhập mật khẩu để xác nhận."
                : <>Mỗi lần đăng nhập, mã gửi tới <b>{status?.emailAddress}</b>, hiệu lực 5 phút. Nhập mật khẩu để xác nhận.</>}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="mfa-email-password">Mật khẩu</Label>
            <InputPassword id="mfa-email-password" autoComplete="current-password" value={password}
              onChange={(e) => setPassword(e.target.value)} />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={close}>Huỷ</Button>
            <Button type="button" variant={emailOn ? "destructive" : "default"} disabled={busy || !password}
              onClick={() => void run(() => kyInstance.post("auth/mfa/email", { json: { enabled: !emailOn, password } }),
                emailOn ? "Đã tắt mã qua email" : "Đã bật mã qua email")}>
              {emailOn ? "Tắt" : "Bật"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
