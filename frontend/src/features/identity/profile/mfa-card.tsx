import { useNotification } from "@refinedev/core";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Mail } from "lucide-react";
import { useState } from "react";

import { kyInstance } from "@/shared/api/data";
import { errorMessage } from "@/shared/lib/api-error";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/shared/ui/dialog";
import { Label } from "@/shared/ui/label";
import { InputPassword } from "@/shared/components/form/input-password";

type MfaStatus = { email: boolean; emailAddress: string | null };

const KEY = ["auth", "mfa"];

/**
 * Xác thực qua email của chính người đang đăng nhập: bật thì mỗi lần đăng nhập phải nhập thêm mã 6 số gửi tới email.
 * Bật / tắt phải nhập lại mật khẩu, hỏi trong hộp thoại.
 *
 * @param onChange gọi sau mỗi lần bật / tắt thành công, với "đang bật không" (màn bắt buộc bật của cổng Admin).
 */
export function EmailMfaCard({ onChange }: { onChange?: (on: boolean) => void } = {}) {
  const { open: notify } = useNotification();
  const queryClient = useQueryClient();
  const { data } = useQuery({ queryKey: KEY, queryFn: ({ signal }) => kyInstance.get("auth/mfa", { signal }).json<MfaStatus>() });
  const status = data && "email" in data ? data : undefined;
  const on = status?.email ?? false;

  const [asking, setAsking] = useState(false);
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  const close = () => {
    setAsking(false);
    setPassword("");
  };

  async function toggle() {
    setBusy(true);
    try {
      const next = await kyInstance.post("auth/mfa/email", { json: { enabled: !on, password } }).json<MfaStatus>();
      notify?.({ type: "success", message: next.email ? "Đã bật xác thực qua email" : "Đã tắt xác thực qua email" });
      queryClient.setQueryData(KEY, next);
      close();
      onChange?.(next.email);
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
          <Mail className="text-primary size-4" />
          Xác thực qua email
          {status ? on ? <Badge variant="success">Đang bật</Badge> : <Badge variant="warning">Chưa bật</Badge> : null}
        </CardTitle>
        <CardDescription>Sau mật khẩu, đăng nhập cần thêm mã 6 số gửi tới email.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-3">
          <p className="text-muted-foreground min-w-0 flex-1 truncate text-sm">
            {status ? status.emailAddress ?? "Tài khoản chưa có email. Nhờ quản trị viên khai email trước." : "Đang tải…"}
          </p>
          <Button type="button" size="sm" variant={on ? "outline" : "default"}
            disabled={!status || (!on && !status.emailAddress)} onClick={() => setAsking(true)}>
            {on ? "Tắt" : "Bật"}
          </Button>
        </div>
      </CardContent>

      <Dialog open={asking} onOpenChange={(o) => !o && close()}>
        <DialogContent size="auto" className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{on ? "Tắt xác thực qua email" : "Bật xác thực qua email"}</DialogTitle>
            <DialogDescription>
              {on ? "Nhập mật khẩu để xác nhận."
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
            <Button type="button" variant={on ? "destructive" : "default"} disabled={busy || !password}
              onClick={() => void toggle()}>
              {on ? "Tắt" : "Bật"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
