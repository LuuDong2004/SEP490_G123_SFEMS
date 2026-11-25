import { keepPreviousData, QueryClient } from "@tanstack/react-query";

/** Mã HTTP của một lỗi, dù nó đến từ data provider của Refine (`statusCode`) hay từ ky (`response.status`). */
function statusOf(error: unknown): number | undefined {
  const e = error as { statusCode?: unknown; status?: unknown; response?: { status?: unknown } } | null;
  const s = e?.statusCode ?? e?.response?.status ?? e?.status;
  return typeof s === "number" ? s : undefined;
}

/**
 * Bộ nhớ đệm truy vấn DUY NHẤT của ứng dụng — `App.tsx` trao nó cho `<Refine>`,
 * và `authProvider.login` xoá nó, để người đăng nhập sau không thấy chớp dữ liệu
 * của người trước (cùng một tab, không tải lại trang).
 *
 * Trao một instance thì Refine KHÔNG trộn mặc định của nó vào, nên hai mặc định
 * của Refine được chép lại ở đây: không tải lại khi quay về cửa sổ, và giữ dữ
 * liệu cũ trong lúc tải trang kế (bảng không nháy trống khi lật trang).
 *
 * - `staleTime` 10 giây: quay lại một màn vừa xem không bắn lại cả cụm truy vấn,
 *   mà dữ liệu một màn khác vừa làm đổi (phiếu duyệt xong sinh tài sản) cũng
 *   không cũ lâu. Truy vấn gộp nặng (trang chủ, tổng hợp) tự đặt dài hơn.
 * - Không thử lại lỗi 4xx: 403 / 404 / 422 là câu trả lời, không phải trục trặc —
 *   thử lại ba lần chỉ bắt người dùng nhìn khung xương thêm bảy giây. Lỗi mạng
 *   và 5xx thử lại một lần.
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      placeholderData: keepPreviousData,
      staleTime: 10_000,
      retry: (failureCount, error) => {
        const status = statusOf(error);
        if (status !== undefined && status >= 400 && status < 500) return false;
        return failureCount < 1;
      },
    },
  },
});

/**
 * Truy vấn xác thực của Refine (`check`, `identity`, `permissions`) giữ
 * `staleTime: 0` như trước: `authProvider.check` là chỗ đổi access token hết
 * hạn thành một lần refresh lặng lẽ, và việc đọc lại quyền đã tự giới hạn một
 * lần mỗi lần tải trang (`revalidateAuthorities`) — không cần đệm thêm ở đây.
 */
queryClient.setQueryDefaults(["auth"], { staleTime: 0 });
