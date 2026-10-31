import { useCan } from "@refinedev/core";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useState } from "react";

import { kyInstance } from "@/shared/api/data";
import { formatDateTime } from "@/shared/lib/format";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/ui/card";

const PAGE_SIZE = 10;

type LogRow = { id: number; createdAt: string; action: string; statusCode: number; ip: string | null; path: string };

/**
 * Lịch sử đăng nhập / đăng xuất của MỘT tài khoản (QLTB-242), phân trang ở máy chủ, đọc từ nhật ký hoạt động
 * (`activity_logs?resource=auth&actorId=`). Lần nhập sai mật khẩu chưa biết là tài khoản nào nên không mang id;
 * chúng vẫn tra được ở Nhật ký hoạt động theo tên đăng nhập đã gõ. Cần `activity_logs:read`.
 */
export function LoginHistoryCard({ userId }: { userId?: number }) {
  const may = useCan({ resource: "activity_logs", action: "list" }).data?.can ?? false;
  const [page, setPage] = useState(0);
  const { data } = useQuery({
    queryKey: ["login_history", userId, page],
    enabled: may && !!userId,
    placeholderData: keepPreviousData,
    queryFn: async () => {
      const res = await kyInstance.get("activity_logs", {
        searchParams: { resource: "auth", actorId: String(userId), _sort: "createdAt", _order: "desc",
          _start: String(page * PAGE_SIZE), _end: String((page + 1) * PAGE_SIZE) },
      });
      return { rows: await res.json<LogRow[]>(), total: Number(res.headers.get("X-Total-Count") ?? 0) };
    },
  });
  if (!may || !userId) return null;
  const rows = data?.rows ?? [];
  const total = data?.total ?? 0;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  return (
    <Card className="gap-3">
      <CardHeader>
        <CardTitle className="text-base">Lịch sử đăng nhập</CardTitle>
        <CardDescription>Các lần đăng nhập, đăng xuất của tài khoản, mới nhất trước.</CardDescription>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <p className="text-muted-foreground text-sm">Chưa có lần đăng nhập nào được ghi lại.</p>
        ) : (
          <ul className="divide-y rounded-md border text-sm">
            {rows.map((r) => {
              const ok = r.statusCode < 400;
              const label = r.path.includes("end-others") ? "Đăng xuất các thiết bị khác" : r.path.includes("sessions") ? "Đăng xuất một phiên"
                : r.path.includes("logout") ? "Đăng xuất" : r.path.includes("refresh") ? "Làm mới phiên" : "Đăng nhập";
              return (
                <li key={r.id} className="flex flex-wrap items-center gap-3 px-3 py-2">
                  <span className="w-36 shrink-0 tabular-nums">{formatDateTime(r.createdAt)}</span>
                  <span className="min-w-0 flex-1">{label}{r.ip ? <span className="text-muted-foreground"> · IP {r.ip}</span> : null}</span>
                  <Badge variant={ok ? "success" : "destructive"}>{ok ? "Thành công" : "Không thành công"}</Badge>
                </li>
              );
            })}
          </ul>
        )}
        {total > PAGE_SIZE ? (
          <div className="mt-2 flex items-center justify-between gap-2 text-sm">
            <span className="text-muted-foreground">{page * PAGE_SIZE + 1}–{Math.min(total, (page + 1) * PAGE_SIZE)} trên {total} lần</span>
            <div className="flex items-center gap-1">
              <Button type="button" variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(page - 1)}>Trước</Button>
              <span className="px-2 tabular-nums">Trang {page + 1}/{pages}</span>
              <Button type="button" variant="outline" size="sm" disabled={page >= pages - 1} onClick={() => setPage(page + 1)}>Sau</Button>
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

