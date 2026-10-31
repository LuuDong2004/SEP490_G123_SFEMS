import { useState } from "react";
import { useCustomMutation, useNotification } from "@refinedev/core";
import { KeyRoundIcon } from "lucide-react";

import { API_URL } from "@/shared/api/constants";
import { Button } from "@/shared/ui/button";
import { Label } from "@/shared/ui/label";
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

/**
 * Setting a user's password on their behalf.
 *
 * Kept out of the edit form on purpose. Saving a profile and revoking somebody's
 * sessions are different intentions, and folding the second into the first
 * would make a corrected surname sign that person out of their laptop.
 *
 * `useCustomMutation` rather than `useUpdate`, because the endpoint is
 * `POST /users/{id}/password` and returns the user rather than a patched
 * record — outside the shape the data provider's `update` speaks.
 */
export function ResetPasswordCard({ userId }: { userId: number | string }) {
  const [password, setPassword] = useState("");
  const { open } = useNotification();
  const { mutate, mutation } = useCustomMutation();

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

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <KeyRoundIcon className="size-4" />
          Đặt lại mật khẩu
        </CardTitle>
        <CardDescription>
          Đặt mật khẩu mới cho tài khoản này. Đổi xong, tài khoản bị đăng xuất
          ở mọi nơi.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={submit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="new-password">Mật khẩu mới</Label>
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
              variant="secondary"
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
