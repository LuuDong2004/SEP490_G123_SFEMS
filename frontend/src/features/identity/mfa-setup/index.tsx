import { useLogout } from "@refinedev/core";
import { LogOut, ShieldCheck } from "lucide-react";
import { useState } from "react";

import { kyInstance } from "@/shared/api/data";
import { portalBase } from "@/shared/api/portal";
import { homePath, saveIdentity, type Identity } from "@/shared/api/session";
import { Button } from "@/shared/ui/button";
import { EmailMfaCard } from "../profile/mfa-card";

/**
 * Tài khoản quản trị chưa có lớp xác thực thứ hai (cổng Admin cách ly, `mfaSetupRequired`): máy chủ trả 403 cho mọi
 * API ngoài `/auth/*`, nên thay cả khung ứng dụng bằng màn này — chỉ bật xác thực qua email hoặc đăng xuất. Bật xong thì đọc lại
 * `/auth/me` và vào trang đầu của cổng.
 */
export function AdminMfaSetup() {
  const { mutate: logout, isPending: leaving } = useLogout();
  const [entering, setEntering] = useState(false);

  async function onChange(on: boolean) {
    if (!on || entering) return;
    setEntering(true);
    try {
      const me = await kyInstance.get("auth/me").json<Identity>();
      saveIdentity(me);
      if (!me.mfaSetupRequired) {
        window.location.replace(`${portalBase()}${homePath()}`);
        return;
      }
    } catch {
      // Đọc lại hỏng: ở lại màn này, người dùng thử lại hoặc tải lại trang.
    }
    setEntering(false);
  }

  return (
    <div className="bg-background flex min-h-svh items-center justify-center px-4 py-10">
      <div className="w-full max-w-[36rem] space-y-5">
        <div className="space-y-1">
          <h1 className="flex items-center gap-2 text-xl font-semibold tracking-tight">
            <ShieldCheck className="text-primary size-5" />
            Bật xác thực qua email
          </h1>
          <p className="text-muted-foreground text-sm">
            Tài khoản quản trị phải bật xác thực qua email trước khi dùng hệ thống.
          </p>
        </div>
        <EmailMfaCard onChange={(on) => void onChange(on)} />
        <div className="flex justify-end">
          <Button type="button" variant="outline" disabled={leaving} onClick={() => logout()}>
            <LogOut />
            Đăng xuất
          </Button>
        </div>
      </div>
    </div>
  );
}
