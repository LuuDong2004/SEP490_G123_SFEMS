import { useQueryClient } from "@tanstack/react-query";
import { Component, useEffect, useState, type ReactNode } from "react";
import { useLocation } from "react-router";

import { StatusScreen } from "@/shared/components/layout/status-screen";

/** Lỗi do không gọi được máy chủ: mất kết nối, hoặc máy chủ trả 502 / 503 / 504 (đang khởi động lại, quá tải). */
function isServerDown(error: unknown): boolean {
  const e = error as { statusCode?: number; status?: number; response?: { status?: number }; name?: string; message?: string } | null;
  const status = e?.statusCode ?? e?.status ?? e?.response?.status;
  if (status === 502 || status === 503 || status === 504) return true;
  return e?.name === "TypeError" || /Failed to fetch|NetworkError|Load failed/i.test(String(e?.message ?? ""));
}

/**
 * Màn 503 thay cho vùng nội dung khi máy chủ không phản hồi — thay vì các ô "Đang tải…" đứng mãi hay bảng trống không lời
 * giải thích. Theo dõi mọi truy vấn: một lượt hỏng vì máy chủ thì bật, một lượt thành công thì tự tắt. "Thử lại" gọi lại mọi
 * truy vấn đang mở.
 */
export function ServerDownGate({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [down, setDown] = useState(false);
  useEffect(
    () =>
      queryClient.getQueryCache().subscribe((event) => {
        if (event.type !== "updated") return;
        if (event.action.type === "error" && isServerDown(event.action.error)) setDown(true);
        if (event.action.type === "success") setDown(false);
      }),
    [queryClient],
  );
  if (!down) return <>{children}</>;
  return (
    <StatusScreen code="503" title="Máy chủ chưa phản hồi"
      description="Hệ thống đang bận hoặc vừa khởi động lại. Thử lại sau ít phút."
      retry={() => {
        setDown(false);
        void queryClient.refetchQueries({ type: "active" });
      }} />
  );
}

/**
 * Màn 500 khi một màn bị lỗi lúc hiển thị — thay cho trang trắng. Chỉ bọc vùng nội dung: menu, đầu trang vẫn dùng được.
 * Đổi màn (đường dẫn khác) là tự xoá lỗi.
 */
class Boundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: unknown) {
    console.error("[SFEMS] Màn hình gặp lỗi khi hiển thị:", error);
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <StatusScreen code="500" title="Màn này đang gặp lỗi"
        description="Tải lại thường sẽ hết. Nếu vẫn lỗi, báo quản trị viên kèm tên màn."
        retry={() => window.location.reload()} />
    );
  }
}

export function ScreenErrorBoundary({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  return <Boundary key={pathname}>{children}</Boundary>;
}
