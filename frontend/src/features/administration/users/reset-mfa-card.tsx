import { useNotification } from "@refinedev/core";
import { ShieldOff } from "lucide-react";
import { useState } from "react";

import { kyInstance } from "@/shared/api/data";
import { errorMessage } from "@/shared/lib/api-error";
import { Button } from "@/shared/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/ui/card";

/**
 * Đặt lại xác thực hai yếu tố cho người mất điện thoại. Sau bước này người đó
 * đăng nhập bằng mật khẩu và tự thiết lập lại ở trang cá nhân.
 */
export function ResetMfaCard({ userId }: { userId: number | string }) {
  const { open } = useNotification();
  const [busy, setBusy] = useState(false);
  async function reset() {
    setBusy(true);
    try {
      await kyInstance.post(`users/${userId}/mfa/reset`);
      open?.({ type: "success", message: "Đã đặt lại xác thực hai yếu tố" });
    } catch (error) {
      open?.({ type: "error", message: await errorMessage(error) });
    } finally {
      setBusy(false);
    }
  }
  return (
    <Card>
      <CardHeader>
        <CardTitle>Xác thực hai yếu tố</CardTitle>
        <CardDescription>
          Dùng khi người dùng mất điện thoại hoặc gỡ ứng dụng xác thực. Hãy chắc chắn đúng người trước khi đặt lại.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Button type="button" variant="outline" disabled={busy} onClick={() => void reset()}>
          <ShieldOff />
          Đặt lại xác thực hai yếu tố
        </Button>
      </CardContent>
    </Card>
  );
}
