import { ArrowLeft, KeyRound, MailCheck } from "lucide-react";
import { useState, type ReactNode } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";

import { API_URL } from "@/shared/api/constants";
import { InputPassword } from "@/shared/components/form/input-password";
import { PasswordRules } from "@/shared/components/form/password-rules";
import { passwordOk } from "@/shared/lib/password-policy";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";

/** Khung chung của hai màn — cùng nền và thẻ với màn đăng nhập. */
function Shell({ title, description, children }: { title: string; description: ReactNode; children: ReactNode }) {
  return (
    <div className="flex min-h-svh items-center justify-center px-4 py-10 text-white"
      style={{ backgroundImage: "var(--gradient-sidebar)", backgroundColor: "var(--sidebar)" }}>
      <div className="w-full max-w-[24rem]">
        <div className="bg-card text-card-foreground shadow-e4 space-y-6 rounded-xl p-7 sm:p-8">
          <div className="space-y-1">
            <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
            <p className="text-muted-foreground text-sm">{description}</p>
          </div>
          {children}
          <Link to="/login" className="text-muted-foreground hover:text-foreground flex items-center gap-1.5 border-t pt-4 text-sm">
            <ArrowLeft className="size-4" />
            Về màn đăng nhập
          </Link>
        </div>
      </div>
    </div>
  );
}

async function post(path: string, body: unknown): Promise<{ message?: string }> {
  const response = await fetch(`${API_URL}/auth/${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = await response.json().catch(() => ({}));
  if (!response.ok) {
    const errors = (json as { errors?: Record<string, string> }).errors;
    throw new Error((errors && Object.values(errors)[0]) || (json as { message?: string }).message || "Không thực hiện được");
  }
  return json as { message?: string };
}

/**
 * Quên mật khẩu (QLTB-509): nhập tên đăng nhập hoặc email, máy chủ gửi link đặt lại tới email của tài khoản.
 * Câu trả lời luôn như nhau dù tài khoản có hay không — màn này không phải chỗ dò tài khoản.
 */
export function ForgotPassword() {
  const [login, setLogin] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      setSent((await post("forgot-password", { login: login.trim() })).message ?? "Đã gửi");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Shell title="Quên mật khẩu" description="Nhập tên đăng nhập hoặc email. Link đặt lại mật khẩu sẽ được gửi tới email của tài khoản.">
      {sent ? (
        <div className="bg-success-subtle text-success-text flex gap-3 rounded-lg p-4 text-sm">
          <MailCheck className="mt-0.5 size-5 shrink-0" />
          <p>{sent}</p>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="login">Tên đăng nhập hoặc email</Label>
            <Input id="login" autoFocus required value={login} onChange={(e) => setLogin(e.target.value)} className="h-10" maxLength={254} />
          </div>
          {error ? <p className="text-destructive text-sm">{error}</p> : null}
          <Button type="submit" size="lg" className="h-10 w-full" disabled={busy || !login.trim()}>
            {busy ? "Đang gửi…" : "Gửi link đặt lại mật khẩu"}
          </Button>
        </form>
      )}
    </Shell>
  );
}

/** Đặt mật khẩu mới từ link trong thư (`/reset-password?token=…`). Xong thì về màn đăng nhập. */
export function ResetPassword() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const token = params.get("token") ?? "";
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const mismatch = confirm.length > 0 && confirm !== password;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await post("reset-password", { token, newPassword: password });
      setDone(true);
      setTimeout(() => navigate("/login", { replace: true }), 2500);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Shell title="Đặt lại mật khẩu" description="Đặt mật khẩu mới cho tài khoản. Đặt xong, mọi phiên đăng nhập cũ đều bị đăng xuất.">
      {!token ? (
        <p className="text-destructive text-sm">Link không hợp lệ. <Link to="/forgot-password" className="underline">Yêu cầu link mới</Link>.</p>
      ) : done ? (
        <div className="bg-success-subtle text-success-text flex gap-3 rounded-lg p-4 text-sm">
          <KeyRound className="mt-0.5 size-5 shrink-0" />
          <p>Đã đặt mật khẩu mới. Đang chuyển về màn đăng nhập…</p>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="new-password">Mật khẩu mới</Label>
            <InputPassword id="new-password" autoFocus autoComplete="new-password" required className="h-10"
              value={password} onChange={(e) => setPassword(e.target.value)} />
            <PasswordRules value={password} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirm-password">Nhập lại mật khẩu mới</Label>
            <InputPassword id="confirm-password" autoComplete="new-password" required className="h-10"
              value={confirm} onChange={(e) => setConfirm(e.target.value)} />
            {mismatch ? <p className="text-destructive text-xs">Hai mật khẩu không khớp.</p> : null}
          </div>
          {error ? <p className="text-destructive text-sm">{error}</p> : null}
          <Button type="submit" size="lg" className="h-10 w-full" disabled={busy || !passwordOk(password) || password !== confirm}>
            {busy ? "Đang lưu…" : "Đặt mật khẩu mới"}
          </Button>
        </form>
      )}
    </Shell>
  );
}
