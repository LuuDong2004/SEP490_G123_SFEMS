import { useCan, useNotification } from "@refinedev/core";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Mail, Send, Shield } from "lucide-react";
import { useState } from "react";

import { kyInstance } from "@/shared/api/data";
import { ListView, ListViewHeader } from "@/shared/components/views/list-view";
import { errorMessage } from "@/shared/lib/api-error";
import { cn } from "@/shared/lib/utils";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Card } from "@/shared/ui/card";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { Switch } from "@/shared/ui/switch";

const KEY = ["mail_config"];
const EMAIL_RE = /^[A-Za-z0-9._%+-]{1,64}@[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}$/;

interface MailConfig {
  host: string | null;
  port: number;
  username: string | null;
  hasPassword: boolean;
  passwordHint: string | null;
  fromAddress: string | null;
  authEnabled: boolean;
  tlsEnabled: boolean;
  updatedAt: string | null;
  updatedBy: string | null;
}

interface TestResult {
  sent: boolean;
  message: string;
}

type FormState = Partial<Record<string, string | number | boolean>>;

/**
 * `/mail-config` — Cài đặt máy chủ thư SMTP (chỉ quản trị): host, cổng, tên đăng nhập, mật khẩu,
 * địa chỉ gửi, bật/tắt xác thực và STARTTLS; kiểm tra kết nối bằng thư thử.
 */
export function MailConfigPage() {
  const { open: notify } = useNotification();
  const qc = useQueryClient();
  const canWrite = useCan({ resource: "mail_config", action: "edit" }).data?.can ?? false;
  const { data, isLoading } = useQuery({
    queryKey: KEY,
    queryFn: ({ signal }) => kyInstance.get("mail_config", { signal }).json<MailConfig>(),
  });

  const [form, setForm] = useState<FormState>({});
  const [saving, setSaving] = useState(false);
  const [testTo, setTestTo] = useState("");
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<TestResult | null>(null);

  const strField = (key: keyof MailConfig) =>
    String((key in form ? form[key] : data?.[key]) ?? "");

  const boolField = (key: keyof MailConfig, def: boolean) =>
    (key in form ? (form[key] as boolean) : (data?.[key] as boolean | undefined)) ?? def;

  const save = async () => {
    setSaving(true);
    try {
      const payload: Record<string, unknown> = { ...form };
      const fresh = await kyInstance.put("mail_config", { json: payload }).json<MailConfig>();
      qc.setQueryData(KEY, fresh);
      setForm({});
      notify?.({ type: "success", message: "Đã lưu cấu hình máy chủ thư" });
    } catch (error) {
      notify?.({ type: "error", message: await errorMessage(error), description: "Chưa lưu được" });
    } finally {
      setSaving(false);
    }
  };

  const sendTest = async () => {
    setSending(true);
    setResult(null);
    try {
      setResult(
        await kyInstance.post("mail_config/test", { json: { email: testTo.trim() } }).json<TestResult>(),
      );
    } catch (error) {
      setResult({ sent: false, message: await errorMessage(error) });
    } finally {
      setSending(false);
    }
  };

  const configured = !!(data?.host);
  const dirty = Object.keys(form).length > 0;
  const authOn = boolField("authEnabled", true);

  return (
    <ListView>
      <ListViewHeader canCreate={false} title="Cài đặt máy chủ thư" />
      {isLoading ? null : (
        <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_22rem]">
          <Card className="gap-4 px-5 py-4">
            <div className="flex items-center justify-between gap-2">
              <h3 className="flex items-center gap-2 text-sm font-semibold">
                <Mail className="size-4" />
                Thông số SMTP
              </h3>
              {configured ? (
                <Badge variant="success">Đã cấu hình</Badge>
              ) : (
                <Badge variant="warning">Chưa cấu hình</Badge>
              )}
            </div>

            <div className="grid gap-3 sm:grid-cols-[1fr_8rem]">
              <div className="grid gap-1.5">
                <Label htmlFor="smtp-host">Máy chủ (host)</Label>
                <Input
                  id="smtp-host"
                  value={strField("host")}
                  placeholder="smtp.gmail.com"
                  disabled={!canWrite}
                  onChange={(e) => setForm((f) => ({ ...f, host: e.target.value }))}
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="smtp-port">Cổng (port)</Label>
                <Input
                  id="smtp-port"
                  type="number"
                  min={1}
                  max={65535}
                  value={String("port" in form ? form["port"] : (data?.port ?? 587))}
                  disabled={!canWrite}
                  onChange={(e) => setForm((f) => ({ ...f, port: Number(e.target.value) }))}
                />
              </div>
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="smtp-from">Địa chỉ gửi (from)</Label>
              <Input
                id="smtp-from"
                value={strField("fromAddress")}
                placeholder="SFEMS <no-reply@sfems.vn>"
                disabled={!canWrite}
                onChange={(e) => setForm((f) => ({ ...f, fromAddress: e.target.value }))}
              />
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="flex items-center gap-3 rounded-md border px-3 py-2">
                <Switch
                  id="smtp-auth"
                  checked={authOn}
                  disabled={!canWrite}
                  onCheckedChange={(v) => setForm((f) => ({ ...f, authEnabled: v }))}
                />
                <Label htmlFor="smtp-auth" className="cursor-pointer">
                  Xác thực (AUTH)
                </Label>
              </div>
              <div className="flex items-center gap-3 rounded-md border px-3 py-2">
                <Switch
                  id="smtp-tls"
                  checked={boolField("tlsEnabled", true)}
                  disabled={!canWrite}
                  onCheckedChange={(v) => setForm((f) => ({ ...f, tlsEnabled: v }))}
                />
                <Label htmlFor="smtp-tls" className="flex cursor-pointer items-center gap-1.5">
                  <Shield className="size-3.5" />
                  STARTTLS
                </Label>
              </div>
            </div>

            {authOn && (
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="grid gap-1.5">
                  <Label htmlFor="smtp-user">Tên đăng nhập</Label>
                  <Input
                    id="smtp-user"
                    value={strField("username")}
                    placeholder="user@gmail.com"
                    disabled={!canWrite}
                    onChange={(e) => setForm((f) => ({ ...f, username: e.target.value }))}
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="smtp-pass">Mật khẩu</Label>
                  <Input
                    id="smtp-pass"
                    type="password"
                    value={String(form["password"] ?? "")}
                    placeholder={data?.hasPassword ? (data.passwordHint ?? "••••••••") : "Chưa đặt"}
                    disabled={!canWrite}
                    onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                  />
                </div>
              </div>
            )}

            {canWrite && (
              <div className="flex justify-end gap-2">
                {dirty && (
                  <Button variant="ghost" onClick={() => setForm({})}>
                    Huỷ
                  </Button>
                )}
                <Button onClick={() => void save()} disabled={!dirty || saving}>
                  {saving && <Loader2 className="size-4 animate-spin" />}
                  Lưu cấu hình
                </Button>
              </div>
            )}

            {data?.updatedBy && (
              <p className="text-muted-foreground text-xs">Cập nhật lần cuối bởi {data.updatedBy}</p>
            )}
          </Card>

          <Card className="gap-3 px-5 py-4">
            <h3 className="text-sm font-semibold">Gửi thư thử</h3>
            <p className="text-muted-foreground text-sm">Kiểm tra kết nối sau khi lưu cấu hình.</p>
            <form
              className="flex items-center gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                if (EMAIL_RE.test(testTo.trim()) && !sending) void sendTest();
              }}
            >
              <Input
                type="email"
                value={testTo}
                maxLength={254}
                placeholder="Địa chỉ nhận thư thử"
                className="bg-field min-w-0 flex-1"
                onChange={(e) => setTestTo(e.target.value)}
                disabled={!canWrite}
              />
              <Button
                type="submit"
                variant="outline"
                disabled={!canWrite || !EMAIL_RE.test(testTo.trim()) || sending}
              >
                {sending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
                Gửi thử
              </Button>
            </form>
            {result && (
              <p className={cn("text-sm", result.sent ? "text-success-text" : "text-destructive")}>
                {result.message}
              </p>
            )}
          </Card>
        </div>
      )}
    </ListView>
  );
}
