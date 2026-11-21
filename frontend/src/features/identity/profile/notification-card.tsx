import { useNotification } from "@refinedev/core";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import type { NotificationPreference } from "@/domains/notification/types";
import { kyInstance } from "@/shared/api/data";
import { TableEmpty } from "@/shared/components/data-table/table-empty";
import { errorMessage } from "@/shared/lib/api-error";
import { LIFT_ROW } from "@/shared/lib/row-lift";
import { cn } from "@/shared/lib/utils";
import { Card } from "@/shared/ui/card";
import { Checkbox } from "@/shared/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/shared/ui/table";

const KEY = ["notification_preferences"];

/**
 * Tab "Thông báo" của hồ sơ cá nhân: mỗi loại thông báo tài khoản này nhận được, ô tích nhận qua email.
 * Thông báo trên hệ thống luôn có; email chỉ bật được khi quản trị cho phép loại đó gửi email.
 */
export function NotificationPreferencesCard({ email }: { email?: string | null }) {
  const { open: notify } = useNotification();
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: KEY,
    queryFn: ({ signal }) => kyInstance.get("notification_preferences", { signal }).json<NotificationPreference[]>(),
  });
  const [saving, setSaving] = useState<string | null>(null);

  const toggle = async (row: NotificationPreference, on: boolean) => {
    setSaving(row.type);
    try {
      const fresh = await kyInstance
        .put("notification_preferences", { json: { items: [{ type: row.type, emailEnabled: on }] } })
        .json<NotificationPreference[]>();
      qc.setQueryData(KEY, fresh);
    } catch (error) {
      notify?.({ type: "error", message: await errorMessage(error), description: "Chưa lưu được" });
    } finally {
      setSaving(null);
    }
  };

  const rows = data ?? [];
  return (
    <Card className="gap-0 overflow-hidden py-0">
      <div className="flex flex-wrap items-baseline justify-between gap-2 border-b px-4 py-3">
        <h3 className="text-sm font-semibold">Nhận thông báo</h3>
        {email ? null : <span className="text-warning-text truncate text-xs">Tài khoản chưa có thư điện tử</span>}
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Loại thông báo</TableHead>
            <TableHead className="w-32 text-center">Trên hệ thống</TableHead>
            <TableHead className="w-32 text-center">Email</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading || rows.length === 0 ? (
            <TableEmpty colSpan={3} compact loading={isLoading} title={<>Không có loại thông báo nào.</>} />
          ) : (
            rows.map((row) => (
              <TableRow key={row.type} className={cn("group/row", LIFT_ROW)}>
                <TableCell className="font-medium">{row.label}</TableCell>
                <TableCell className="text-center">
                  <Checkbox checked disabled aria-label={`${row.label} trên hệ thống`} />
                </TableCell>
                <TableCell className="text-center">
                  <Checkbox
                    checked={row.emailEnabled}
                    disabled={!row.emailAllowed || !email || saving === row.type}
                    title={!row.emailAllowed ? "Quản trị đã tắt email cho loại này" : undefined}
                    aria-label={`${row.label} qua email`}
                    onCheckedChange={(on) => void toggle(row, on === true)}
                  />
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </Card>
  );
}
