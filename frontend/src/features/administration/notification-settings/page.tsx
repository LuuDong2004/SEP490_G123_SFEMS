import { useCan, useNotification } from "@refinedev/core";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Send } from "lucide-react";
import { useState } from "react";

import type { NotificationTypeSetting, NotificationTypeSettings } from "@/domains/notification/types";
import { kyInstance } from "@/shared/api/data";
import { TableEmpty } from "@/shared/components/data-table/table-empty";
import { ListView, ListViewHeader } from "@/shared/components/views/list-view";
import { errorMessage } from "@/shared/lib/api-error";
import { LIFT_ROW } from "@/shared/lib/row-lift";
import { cn } from "@/shared/lib/utils";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Card } from "@/shared/ui/card";
import { Input } from "@/shared/ui/input";
import { Switch } from "@/shared/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/shared/ui/table";

const KEY = ["notification_type_settings"];
const EMAIL = /^[A-Za-z0-9._%+-]{1,64}@[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}$/;

type TestResult = { sent: boolean; message: string };

/**
 * `/notification-settings` — Cài đặt thông báo toàn hệ thống (chỉ quản trị): bật / tắt từng loại trên hệ
 * thống và qua email; tình trạng máy chủ thư và gửi thư thử. Người dùng tắt email loại của mình ở Hồ sơ cá nhân.
 */
export function NotificationSettingsPage() {
  const { open: notify } = useNotification();
  const qc = useQueryClient();
  const canWrite = useCan({ resource: "notification_type_settings", action: "edit" }).data?.can ?? false;
  const { data, isLoading } = useQuery({
    queryKey: KEY,
    queryFn: ({ signal }) => kyInstance.get("notification_type_settings", { signal }).json<NotificationTypeSettings>(),
  });
  const [saving, setSaving] = useState<string | null>(null);
  const [to, setTo] = useState("");
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<TestResult | null>(null);

  const save = async (row: NotificationTypeSetting, inAppEnabled: boolean, emailEnabled: boolean) => {
    setSaving(row.type);
    try {
      const fresh = await kyInstance
        .put("notification_type_settings", { json: { items: [{ type: row.type, inAppEnabled, emailEnabled }] } })
        .json<NotificationTypeSettings>();
      qc.setQueryData(KEY, fresh);
    } catch (error) {
      notify?.({ type: "error", message: await errorMessage(error), description: "Chưa lưu được" });
    } finally {
      setSaving(null);
    }
  };

  const sendTest = async () => {
    setSending(true);
    setResult(null);
    try {
      setResult(
        await kyInstance.post("notification_type_settings/test-mail", { json: { email: to.trim() } }).json<TestResult>(),
      );
    } catch (error) {
      setResult({ sent: false, message: await errorMessage(error) });
    } finally {
      setSending(false);
    }
  };

  const rows = data?.items ?? [];
  const validTo = EMAIL.test(to.trim());

  return (
    <ListView>
      <ListViewHeader canCreate={false} title="Cài đặt thông báo" />
      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <Card className="gap-0 overflow-hidden py-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Loại thông báo</TableHead>
                <TableHead className="w-36 text-center">Trên hệ thống</TableHead>
                <TableHead className="w-36 text-center">Email</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading || rows.length === 0 ? (
                <TableEmpty colSpan={3} loading={isLoading} title={<>Không có loại thông báo nào.</>} />
              ) : (
                rows.map((row) => (
                  <TableRow key={row.type} className={cn("group/row", LIFT_ROW)}>
                    <TableCell className="font-medium">{row.label}</TableCell>
                    <TableCell className="text-center">
                      <Switch
                        checked={row.inAppEnabled}
                        disabled={!canWrite || !row.inAppOptional || saving === row.type}
                        aria-label={`${row.label} trên hệ thống`}
                        onCheckedChange={(on) => void save(row, on, on && row.emailEnabled)}
                      />
                    </TableCell>
                    <TableCell className="text-center">
                      <Switch
                        checked={row.emailEnabled}
                        disabled={!canWrite || !row.inAppEnabled || saving === row.type}
                        aria-label={`${row.label} qua email`}
                        onCheckedChange={(on) => void save(row, row.inAppEnabled, on)}
                      />
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </Card>

        <Card className="gap-3 px-5 py-4">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm font-semibold">Máy chủ thư</h3>
            {data ? (
              data.mailConfigured ? (
                <Badge variant="success">Đã cấu hình</Badge>
              ) : (
                <Badge variant="warning">Chưa cấu hình</Badge>
              )
            ) : null}
          </div>
          <form
            className="flex items-center gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (validTo && !sending) void sendTest();
            }}
          >
            <Input
              type="email"
              value={to}
              maxLength={254}
              placeholder="Địa chỉ nhận thư thử"
              className="bg-field min-w-0 flex-1"
              onChange={(e) => setTo(e.target.value)}
              disabled={!canWrite}
            />
            <Button type="submit" variant="outline" disabled={!canWrite || !validTo || sending}>
              {sending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
              Gửi thử
            </Button>
          </form>
          {result ? (
            <p className={cn("text-sm", result.sent ? "text-success-text" : "text-destructive")}>{result.message}</p>
          ) : null}
        </Card>
      </div>
    </ListView>
  );
}
