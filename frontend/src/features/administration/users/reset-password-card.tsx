import { useState } from "react";
import { useCustomMutation, useNotification } from "@refinedev/core";
import { KeyRoundIcon, MailIcon } from "lucide-react";

import { API_URL } from "@/shared/api/constants";
import { Button } from "@/shared/ui/button";
import { Label } from "@/shared/ui/label";
import { Separator } from "@/shared/ui/separator";
import { InputPassword } from "@/shared/components/form/input-password";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/shared/ui/card";
import { PasswordRules } from "@/shared/components/form/password-rules";
import { passwordOk } from "@/shared/lib/password-policy";

/** Email giả máy đặt cho tài khoản chưa có email (`PasswordResetService.PLACEHOLDER_DOMAIN`) — không gửi thư tới đó. */
const PLACEHOLDER_DOMAIN = "@qltb.local";

function hasRealEmail(email: string | null | undefined): email is string {
  return !!email && email.includes("@") && !email.endsWith(PLACEHOLDER_DOMAIN);
}

/**
 * Đặt lại mật khẩu thay người dùng — hai cách:
 *
 * - **Gửi link qua email** (`POST /users/{id}/password-reset-link`): mật khẩu cũ mất hiệu lực, mọi phiên bị đăng
 *   xuất, người dùng nhận thư mang link tự đặt mật khẩu mới. Không ai ngoài họ biết mật khẩu mới.
 * - **Đặt mật khẩu trực tiếp** (`POST /users/{id}/password`): khi tài khoản chưa có email, người quản trị tự trao
 *   mật khẩu cho người dùng.
 *
 * Tách khỏi form sửa thông tin: lưu hồ sơ và đăng xuất người khác là hai ý định khác nhau.
 * `useCustomMutation` thay cho `useUpdate` vì hai endpoint không theo dạng `update` của data provider.
 */
export function ResetPasswordCard({ userId, email }: { userId: number | string; email?: string | null }) {
  const [password, setPassword] = useState("");
  const { open } = useNotification();
  const { mutate, mutation } = useCustomMutation();
  const { mutate: sendLink, mutation: linkMutation } = useCustomMutation<{ sentTo: string }>();
  const canMail = hasRealEmail(email);

  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    mutate(
      {
        url: `${API_URL}/users/${userId}/password`,
        method: "post",
        values: { password },
        // The rest provider serialises a custom-call body itself and sends it
        // as a plain string, so without this the request arrives with no
        // content type and Spring answers 415 before the handler is reached.
        config: { headers: { "Content-Type": "application/json" } },
        // The provider's own success toast would say "Successfully created",
        // which is not what happened.
        successNotification: false,
      },
      {
        onSuccess: () => {
          setPassword("");
          open?.({
            type: "success",
            message: "Đã cập nhật mật khẩu",
            description:
              "Tài khoản này đã bị đăng xuất ở mọi thiết bị.",
          });
        },
      }
    );
  };

  const mailLink = () => {
    sendLink(
      {
        url: `${API_URL}/users/${userId}/password-reset-link`,
        method: "post",
        values: {},
        config: { headers: { "Content-Type": "application/json" } },
        successNotification: false,
      },
      {
        onSuccess: (res) => {
          open?.({
            type: "success",
            message: "Đã gửi link đặt lại mật khẩu",
            description: `Thư đã gửi tới ${res.data.sentTo}. Mật khẩu cũ không còn dùng được, tài khoản đã bị đăng xuất ở mọi thiết bị.`,
          });
        },
      }
    );
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <KeyRoundIcon className="size-4" />
          Đặt lại mật khẩu
        </CardTitle>
        <CardDescription>
          Gửi link để người dùng tự đặt mật khẩu mới qua email, hoặc đặt mật khẩu trực tiếp. Cách nào cũng làm mật
          khẩu cũ mất hiệu lực và đăng xuất tài khoản ở mọi nơi.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <div>
            <Button
              type="button"
              variant="secondary"
              disabled={!canMail || linkMutation.isPending}
              onClick={mailLink}
            >
              <MailIcon />
              {linkMutation.isPending ? "Đang gửi..." : "Gửi link đặt lại qua email"}
            </Button>
          </div>
          <p className="text-muted-foreground text-xs">
            {canMail
              ? `Thư gửi tới ${email}. Link có hiệu lực 3 ngày và chỉ dùng được một lần.`
              : "Tài khoản chưa có email — nhập email ở form trên và lưu, hoặc đặt mật khẩu trực tiếp bên dưới."}
          </p>
        </div>

        <Separator />

        <form onSubmit={submit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="new-password">Hoặc đặt mật khẩu trực tiếp</Label>
            <InputPassword
              id="new-password"
              autoComplete="new-password"
              placeholder="Tối thiểu 8 ký tự"
              minLength={8}
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <PasswordRules value={password} />
          </div>
          <div>
            <Button
              type="submit"
              variant="outline"
              disabled={mutation.isPending || !passwordOk(password)}
            >
              {mutation.isPending ? "Đang cập nhật..." : "Đặt mật khẩu"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
