import { useCan, useNotification } from "@refinedev/core";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Mail, Send } from "lucide-react";
import { useState } from "react";

import { kyInstance } from "@/shared/api/data";
import { ListView, ListViewHeader } from "@/shared/components/views/list-view";
import { errorMessage } from "@/shared/lib/api-error";
import { cn } from "@/shared/lib/utils";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Card } from "@/shared/ui/card";
import { Checkbox } from "@/shared/ui/checkbox";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/ui/select";
import { Switch } from "@/shared/ui/switch";

const KEY = ["mail_config"];
const EMAIL_RE = /^[A-Za-z0-9._%+-]{1,64}@[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}$/;

type Security = "STARTTLS" | "SSL" | "NONE";

interface MailConfig {
  host: string | null;
  port: number;
  username: string | null;
  hasPassword: boolean;
  passwordHint: string | null;
  fromAddress: string | null;
  senderName: string | null;
  security: Security;
  enabled: boolean;
  updatedAt: string | null;
  updatedBy: string | null;
}

interface TestResult {
  sent: boolean;
  message: string;
}

type FormState = Partial<Record<string, string | number | boolean>>;

/**
 * `/mail-config` — Cài đặt máy chủ thư SMTP (chỉ quản trị): host, cổng, kiểu bảo mật,
 * tên đăng nhập, mật khẩu, địa chỉ gửi, tên người gửi; bật/tắt dùng cấu hình DB; gửi thư thử.
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

  const str = (key: keyof MailConfig) => String((key in form ? form[key] : data?.[key]) ?? "");
  const bool = (key: keyof MailConfig, def: boolean) =>
    (key in form ? (form[key] as boolean) : (data?.[key] as boolean | undefined)) ?? def;
  const security: Security = (form["security"] as Security | undefined) ?? data?.security ?? "STARTTLS";

  const set = (patch: Partial<FormState>) => setForm((f) => ({ ...f, ...patch }));

  const save = async () => {
    setSaving(true);
    try {
      const fresh = await kyInstance.put("mail_config", { json: { ...form } }).json<MailConfig>();
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

  const configured = !!(data?.host) && (data?.enabled ?? false);
  const dirty = Object.keys(form).length > 0;

  return (
    <ListView>
      <ListViewHeader canCreate={false} title="Cài đặt máy chủ thư" />
      {isLoading ? null : (
        <Card className="gap-5 px-5 py-4 max-w-2xl">
          {/* Toggle bật/tắt */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-3">
              <Switch
                id="smtp-enabled"
                checked={bool("enabled", true)}
                disabled={!canWrite}
                onCheckedChange={(v) => set({ enabled: v })}
              />
              <Label htmlFor="smtp-enabled" className="cursor-pointer text-sm font-medium">
                <Mail className="mr-1.5 inline size-4 align-text-bottom" />
                Gửi thư
              </Label>
            </div>
            {!(data?.enabled ?? true) ? (
              <Badge variant="neutral">Đã tắt, không gửi thư nào</Badge>
            ) : configured ? (
              <Badge variant="success">Đang dùng cấu hình này</Badge>
            ) : (
              <Badge variant="warning">Chưa khai máy chủ, chưa gửi được thư</Badge>
            )}
          </div>
          <p className="text-muted-foreground -mt-3 text-sm">
            Hệ thống chỉ gửi thư theo cấu hình ở trang này. Tắt, hoặc chưa khai máy chủ, thì không gửi thư nào: thông báo, thư
            mời tài khoản, mã đăng nhập, đặt lại mật khẩu.
          </p>

          <div className="h-px bg-border" />

          {/* Hàng 1: host / port / bảo mật */}
          <div className="grid gap-4 sm:grid-cols-[1fr_8rem_11rem]">
            <div className="grid gap-1.5">
              <Label htmlFor="smtp-host">
                Máy chủ SMTP <span className="text-destructive">*</span>
              </Label>
              <Input
                id="smtp-host"
                value={str("host")}
                placeholder="smtp.gmail.com"
                disabled={!canWrite}
                onChange={(e) => set({ host: e.target.value })}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="smtp-port">
                Cổng <span className="text-destructive">*</span>
              </Label>
              <Input
                id="smtp-port"
                type="number"
                min={1}
                max={65535}
                value={String("port" in form ? form["port"] : (data?.port ?? 587))}
                disabled={!canWrite}
                onChange={(e) => set({ port: Number(e.target.value) })}
              />
            </div>
            <div className="grid gap-1.5">
              <Label>Bảo mật kết nối</Label>
              <Select
                value={security}
                onValueChange={(v) => set({ security: v })}
                disabled={!canWrite}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="STARTTLS">STARTTLS</SelectItem>
                  <SelectItem value="SSL">SSL / TLS</SelectItem>
                  <SelectItem value="NONE">Không mã hoá</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Hàng 2: tài khoản / mật khẩu */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <Label htmlFor="smtp-user">Tài khoản</Label>
              <Input
                id="smtp-user"
                value={str("username")}
                placeholder="user@gmail.com"
                disabled={!canWrite}
                onChange={(e) => set({ username: e.target.value })}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="smtp-pass">Mật khẩu</Label>
              <Input
                id="smtp-pass"
                type="password"
                value={String(form["password"] ?? "")}
                placeholder={
                  data?.hasPassword ? (data.passwordHint ? `Đã lưu — để trống là giữ` : "Đã lưu — để trống là giữ") : "Chưa đặt"
                }
                disabled={!canWrite}
                onChange={(e) => set({ password: e.target.value })}
              />
              {canWrite && data?.hasPassword && (
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="smtp-clear-pwd"
                    checked={form["clearPassword"] === true}
                    onCheckedChange={(v) => set({ clearPassword: Boolean(v) })}
                  />
                  <Label htmlFor="smtp-clear-pwd" className="cursor-pointer text-sm font-normal">
                    Xoá mật khẩu đã lưu
                  </Label>
                </div>
              )}
            </div>
          </div>

          {/* Hàng 3: địa chỉ gửi / tên người gửi */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <Label htmlFor="smtp-from">Địa chỉ gửi</Label>
              <Input
                id="smtp-from"
                value={str("fromAddress")}
                placeholder="no-reply@sfems.vn"
                disabled={!canWrite}
                onChange={(e) => set({ fromAddress: e.target.value })}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="smtp-sender-name">Tên người gửi</Label>
              <Input
                id="smtp-sender-name"
                value={str("senderName")}
                placeholder="QLTB"
                disabled={!canWrite}
                onChange={(e) => set({ senderName: e.target.value })}
              />
            </div>
          </div>

          {canWrite && (
            <div className="flex justify-end gap-2">
              {dirty && (
                <Button variant="ghost" onClick={() => setForm({})}>
                  Huỷ
                </Button>
              )}
              <Button onClick={() => void save()} disabled={!dirty || saving}>
                {saving && <Loader2 className="size-4 animate-spin" />}
                Lưu
              </Button>
            </div>
          )}

          {data?.updatedBy && (
            <p className="text-muted-foreground text-xs">Cập nhật lần cuối bởi {data.updatedBy}</p>
          )}

          <div className="h-px bg-border" />

          {/* Gửi thư thử */}
          <div className="grid gap-2">
            <p className="text-sm font-medium">Gửi thư thử tới</p>
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
                placeholder="email@example.com"
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
                Gửi thư thử
              </Button>
            </form>
            {result && (
              <p className={cn("text-sm", result.sent ? "text-success-text" : "text-destructive")}>
                {result.message}
              </p>
            )}
          </div>
        </Card>
      )}
    </ListView>
  );
}
