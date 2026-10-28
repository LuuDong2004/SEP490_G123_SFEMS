import { useNotification } from "@refinedev/core";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { LogOut, Monitor, Smartphone } from "lucide-react";
import { useState } from "react";

import { kyInstance } from "@/shared/api/data";
import { errorMessage } from "@/shared/lib/api-error";
import { formatDateTime } from "@/shared/lib/format";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/ui/card";

/** Số phiên mỗi trang của khối "Phiên đăng nhập". */
const PAGE_SIZE = 5;

/** Một phiên đang mở (`GET /auth/sessions`, `GET /users/{id}/sessions`). */
export type SessionRow = {
  sessionId: string;
  startedAt: string;
  lastActiveAt: string;
  expiresAt: string;
  ip: string | null;
  userAgent: string | null;
  /** Chỉ có ở danh sách của chính mình: phiên của trình duyệt đang xem. */
  current?: boolean;
};

/** Trình duyệt và hệ điều hành đọc từ User-Agent — đủ để người dùng nhận ra máy của mình. */
export function describeAgent(ua: string | null) {
  if (!ua) return { label: "Không rõ thiết bị", mobile: false };
  const browser = /Edg\//.test(ua) ? "Edge" : /OPR\/|Opera/.test(ua) ? "Opera" : /Chrome\//.test(ua) ? "Chrome"
    : /Firefox\//.test(ua) ? "Firefox" : /Safari\//.test(ua) ? "Safari" : /okhttp|curl|python|Java/i.test(ua) ? "Ứng dụng / API" : "Trình duyệt khác";
  const os = /Windows/.test(ua) ? "Windows" : /Android/.test(ua) ? "Android" : /iPhone|iPad|iOS/.test(ua) ? "iOS"
    : /Mac OS X|Macintosh/.test(ua) ? "macOS" : /Linux/.test(ua) ? "Linux" : "";
  return { label: os ? `${browser} · ${os}` : browser, mobile: /Android|iPhone|iPad|Mobile/.test(ua) };
}

/**
 * Các phiên đăng nhập đang mở của một tài khoản (QLTB-242): thiết bị, IP, lúc mở, lần dùng gần nhất; mỗi phiên một
 * nút Đăng xuất. Đăng xuất là thu hồi refresh token của phiên — thiết bị kia mất phiên ở lần làm mới token kế tiếp
 * (tối đa 15 phút, thời hạn của access token).
 *
 * @param source  đường API đọc danh sách (`auth/sessions` của chính mình, `users/{id}/sessions` của người khác)
 * @param endPath đường API đăng xuất một phiên, nhận mã phiên
 * @param endOthers có thì hiện nút "Đăng xuất các thiết bị khác" (chỉ danh sách của chính mình)
 */
export function SessionsCard({ source, endPath, endOthers, canEnd = true, description }: {
  source: string;
  endPath: (sessionId: string) => string;
  endOthers?: string;
  canEnd?: boolean;
  description?: string;
}) {
  const client = useQueryClient();
  const { open } = useNotification();
  const [busy, setBusy] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const { data, isLoading } = useQuery({
    queryKey: ["sessions", source],
    queryFn: () => kyInstance.get(source).json<SessionRow[]>(),
  });
  // Phiên đang dùng luôn đứng đầu; còn lại theo lần dùng gần nhất (máy chủ đã xếp). Phân trang ở máy khách:
  // danh sách đã về đủ, phiên cũ có thể dồn tới vài chục dòng.
  const rows = [...(data ?? [])].sort((a, b) => Number(!!b.current) - Number(!!a.current));
  const pages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const current = Math.min(page, pages - 1);
  const shown = rows.slice(current * PAGE_SIZE, current * PAGE_SIZE + PAGE_SIZE);

  const run = async (key: string, call: () => Promise<unknown>, done: string) => {
    setBusy(key);
    try {
      await call();
      open?.({ type: "success", message: done });
      await client.invalidateQueries({ queryKey: ["sessions", source] });
    } catch (error) {
      open?.({ type: "error", message: await errorMessage(error) });
    } finally {
      setBusy(null);
    }
  };

  const others = rows.filter((r) => !r.current).length;
  return (
    <Card className="gap-3">
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-2">
        <div className="space-y-1">
          <CardTitle className="text-base">Phiên đăng nhập</CardTitle>
          <CardDescription>
            {description ?? "Các thiết bị đang đăng nhập. Đăng xuất một phiên thì thiết bị đó phải đăng nhập lại trong vòng 15 phút."}
          </CardDescription>
        </div>
        {endOthers && canEnd && others > 0 ? (
          <Button type="button" variant="outline" size="sm" disabled={busy != null}
            onClick={() => void run("others", () => kyInstance.post(endOthers).json(), `Đã đăng xuất ${others} thiết bị khác`)}>
            <LogOut />
            Đăng xuất các thiết bị khác
          </Button>
        ) : null}
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-muted-foreground text-sm">Đang tải…</p>
        ) : rows.length === 0 ? (
          <p className="text-muted-foreground text-sm">Không có phiên nào đang mở.</p>
        ) : (
          <ul className="divide-y rounded-md border">
            {shown.map((r) => {
              const agent = describeAgent(r.userAgent);
              const Icon = agent.mobile ? Smartphone : Monitor;
              return (
                <li key={r.sessionId} className="flex flex-wrap items-center gap-3 px-3 py-2.5 text-sm">
                  <Icon className="text-muted-foreground size-5 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2 font-medium">
                      {agent.label}
                      {r.current ? <Badge variant="success">Phiên đang dùng</Badge> : null}
                    </div>
                    <div className="text-muted-foreground text-xs">
                      {r.ip ? `IP ${r.ip} · ` : ""}Đăng nhập {formatDateTime(r.startedAt)} · Dùng gần nhất {formatDateTime(r.lastActiveAt)}
                    </div>
                  </div>
                  {canEnd && !r.current ? (
                    <Button type="button" variant="ghost" size="sm" disabled={busy != null}
                      onClick={() => void run(r.sessionId, () => kyInstance.delete(endPath(r.sessionId)).json(), "Đã đăng xuất phiên")}>
                      <LogOut />
                      Đăng xuất
                    </Button>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
        {rows.length > PAGE_SIZE ? (
          <div className="mt-2 flex items-center justify-between gap-2 text-sm">
            <span className="text-muted-foreground">
              {current * PAGE_SIZE + 1}–{Math.min(rows.length, (current + 1) * PAGE_SIZE)} trên {rows.length} phiên
            </span>
            <div className="flex items-center gap-1">
              <Button type="button" variant="outline" size="sm" disabled={current === 0} onClick={() => setPage(current - 1)}>Trước</Button>
              <span className="px-2 tabular-nums">Trang {current + 1}/{pages}</span>
              <Button type="button" variant="outline" size="sm" disabled={current >= pages - 1} onClick={() => setPage(current + 1)}>Sau</Button>
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
