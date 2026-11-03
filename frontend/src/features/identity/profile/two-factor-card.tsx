import { useNotification } from "@refinedev/core";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Mail, ShieldCheck, Smartphone } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { useState } from "react";

import { kyInstance } from "@/shared/api/data";
import { InputPassword } from "@/shared/components/form/input-password";
import { errorMessage } from "@/shared/lib/api-error";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/ui/card";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/shared/ui/input-otp";
import { Label } from "@/shared/ui/label";

/** `GET /auth/mfa`. */
type MfaStatus = {
  enabled: boolean;
  required: boolean;
  /** Đã sinh mã QR nhưng chưa xác nhận bằng mã 6 số. */
  pending: boolean;
  email: boolean;
  emailAddress: string | null;
};

/** `POST /auth/mfa/setup`. */
type MfaSetup = { secret: string; otpauthUri: string };

const STATUS_KEY = ["auth", "mfa"];

/** Ô nhập mã 6 số của ứng dụng xác thực. */
function CodeInput({ id, value, onChange }: { id: string; value: string; onChange: (v: string) => void }) {
  return (
    <InputOTP id={id} maxLength={6} inputMode="numeric" autoComplete="one-time-code" value={value} onChange={onChange}>
      <InputOTPGroup>
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <InputOTPSlot key={i} index={i} />
        ))}
      </InputOTPGroup>
    </InputOTP>
  );
}

/**
 * Xác thực hai bước của chính mình, hai cách: ứng dụng xác thực (quét QR) hoặc mã gửi qua email.
 * Bật bằng ứng dụng phải nhập đúng một mã trước, để không ai tự khoá mình vì quét sai.
 */
export function TwoFactorCard() {
  const client = useQueryClient();
  const { open } = useNotification();
  const { data: status, isLoading } = useQuery({
    queryKey: STATUS_KEY,
    queryFn: () => kyInstance.get("auth/mfa").json<MfaStatus>(),
  });

  const [busy, setBusy] = useState(false);
  const [setup, setSetup] = useState<MfaSetup | null>(null);
  const [code, setCode] = useState("");
  const [disabling, setDisabling] = useState(false);
  const [emailPassword, setEmailPassword] = useState("");
  const [emailOpen, setEmailOpen] = useState(false);

  const run = async (call: () => Promise<unknown>, done: string) => {
    setBusy(true);
    try {
      await call();
      open?.({ type: "success", message: done });
      await client.invalidateQueries({ queryKey: STATUS_KEY });
      return true;
    } catch (error) {
      open?.({ type: "error", message: await errorMessage(error) });
      return false;
    } finally {
      setBusy(false);
    }
  };

  const startSetup = async () => {
    setBusy(true);
    try {
      setSetup(await kyInstance.post("auth/mfa/setup").json<MfaSetup>());
      setCode("");
    } catch (error) {
      open?.({ type: "error", message: await errorMessage(error) });
    } finally {
      setBusy(false);
    }
  };

  const enableApp = async () => {
    if (await run(() => kyInstance.post("auth/mfa/enable", { json: { code } }).json(), "Đã bật xác thực hai bước")) {
      setSetup(null);
      setCode("");
    }
  };

  const disableApp = async () => {
    if (await run(() => kyInstance.post("auth/mfa/disable", { json: { code } }).json(), "Đã tắt xác thực bằng ứng dụng")) {
      setDisabling(false);
      setCode("");
    }
  };

  const toggleEmail = async (enabled: boolean) => {
    const ok = await run(
      () => kyInstance.post("auth/mfa/email", { json: { enabled, password: emailPassword } }).json(),
      enabled ? "Đã bật mã xác thực qua email" : "Đã tắt mã xác thực qua email",
    );
    if (ok) {
      setEmailOpen(false);
      setEmailPassword("");
    }
  };

  const on = !!status && (status.enabled || status.email);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <ShieldCheck className="text-primary size-4" />
          Xác thực hai bước
          {status && (
            <Badge variant={on ? "default" : "secondary"} className="ml-1">
              {on ? "Đang bật" : "Đang tắt"}
            </Badge>
          )}
        </CardTitle>
        <CardDescription>
          Ngoài mật khẩu, lúc đăng nhập cần thêm một mã 6 số.
          {status?.required && !on && " Vai trò của bạn được khuyến nghị bật tính năng này."}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col divide-y">
        {isLoading || !status ? (
          <p className="text-muted-foreground py-2 text-sm">Đang tải...</p>
        ) : (
          <>
            {/* Ứng dụng xác thực */}
            <section className="flex flex-col gap-3 pb-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex gap-3">
                  <Smartphone className="text-muted-foreground mt-0.5 size-4 shrink-0" />
                  <div>
                    <p className="text-sm font-medium">Ứng dụng xác thực</p>
                    <p className="text-muted-foreground text-sm">Google Authenticator, Microsoft Authenticator…</p>
                  </div>
                </div>
                {status.enabled ? (
                  !disabling && (
                    <Button type="button" variant="outline" size="sm" disabled={busy}
                      onClick={() => { setDisabling(true); setCode(""); }}>
                      Tắt
                    </Button>
                  )
                ) : (
                  !setup && (
                    <Button type="button" size="sm" disabled={busy} onClick={() => void startSetup()}>
                      Thiết lập
                    </Button>
                  )
                )}
              </div>

              {setup && !status.enabled && (
                <div className="bg-surface-subtle flex flex-col gap-4 rounded-md border p-4 sm:flex-row">
                  <div className="shrink-0 self-center rounded-md bg-white p-2">
                    <QRCodeSVG value={setup.otpauthUri} size={148} />
                  </div>
                  <div className="flex min-w-0 flex-col gap-3 text-sm">
                    <p>1. Mở ứng dụng xác thực, quét mã QR bên cạnh.</p>
                    <p className="text-muted-foreground">
                      Không quét được thì nhập khoá: <code className="font-mono break-all">{setup.secret}</code>
                    </p>
                    <div className="flex flex-col gap-2">
                      <Label htmlFor="mfa-enable-code">2. Nhập mã 6 số ứng dụng hiện ra</Label>
                      <CodeInput id="mfa-enable-code" value={code} onChange={setCode} />
                    </div>
                    <div className="flex gap-2">
                      <Button type="button" size="sm" disabled={busy || code.length !== 6} onClick={() => void enableApp()}>
                        Xác nhận và bật
                      </Button>
                      <Button type="button" variant="ghost" size="sm" disabled={busy} onClick={() => setSetup(null)}>
                        Huỷ
                      </Button>
                    </div>
                  </div>
                </div>
              )}

              {disabling && status.enabled && (
                <div className="bg-surface-subtle flex flex-col gap-3 rounded-md border p-4 text-sm">
                  <Label htmlFor="mfa-disable-code">Nhập mã 6 số hiện tại trong ứng dụng để tắt</Label>
                  <CodeInput id="mfa-disable-code" value={code} onChange={setCode} />
                  <div className="flex gap-2">
                    <Button type="button" variant="destructive" size="sm" disabled={busy || code.length !== 6}
                      onClick={() => void disableApp()}>
                      Tắt xác thực bằng ứng dụng
                    </Button>
                    <Button type="button" variant="ghost" size="sm" disabled={busy} onClick={() => setDisabling(false)}>
                      Huỷ
                    </Button>
                  </div>
                </div>
              )}
            </section>

            {/* Mã qua email */}
            <section className="flex flex-col gap-3 pt-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex gap-3">
                  <Mail className="text-muted-foreground mt-0.5 size-4 shrink-0" />
                  <div>
                    <p className="text-sm font-medium">Mã qua email</p>
                    <p className="text-muted-foreground text-sm">
                      {status.emailAddress ? `Gửi tới ${status.emailAddress}` : "Tài khoản chưa có email."}
                    </p>
                  </div>
                </div>
                {!emailOpen && (
                  <Button type="button" variant={status.email ? "outline" : "default"} size="sm"
                    disabled={busy || (!status.email && !status.emailAddress)}
                    onClick={() => { setEmailOpen(true); setEmailPassword(""); }}>
                    {status.email ? "Tắt" : "Bật"}
                  </Button>
                )}
              </div>

              {emailOpen && (
                <form
                  className="bg-surface-subtle flex flex-col gap-3 rounded-md border p-4 text-sm"
                  onSubmit={(e) => { e.preventDefault(); void toggleEmail(!status.email); }}
                >
                  <Label htmlFor="mfa-email-password">Nhập mật khẩu để xác nhận</Label>
                  <InputPassword id="mfa-email-password" autoComplete="current-password" className="max-w-sm"
                    value={emailPassword} onChange={(e) => setEmailPassword(e.target.value)} />
                  <div className="flex gap-2">
                    <Button type="submit" size="sm" variant={status.email ? "destructive" : "default"}
                      disabled={busy || emailPassword.length === 0}>
                      {status.email ? "Tắt mã qua email" : "Bật mã qua email"}
                    </Button>
                    <Button type="button" variant="ghost" size="sm" disabled={busy} onClick={() => setEmailOpen(false)}>
                      Huỷ
                    </Button>
                  </div>
                </form>
              )}
            </section>
          </>
        )}
      </CardContent>
    </Card>
  );
}
