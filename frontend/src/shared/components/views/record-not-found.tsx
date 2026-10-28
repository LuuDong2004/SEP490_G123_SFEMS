import { useNavigation, useResourceParams } from "@refinedev/core";
import { ArrowLeftIcon, SearchX } from "lucide-react";

import { Button } from "@/shared/ui/button";

type RecordQuery = { error?: unknown; failureReason?: unknown } | undefined;

/**
 * Bản ghi của trang sửa / chi tiết KHÔNG CÓ: id trên đường dẫn không tồn tại, đã bị xoá, hoặc nằm
 * ngoài phạm vi dữ liệu của người xem (máy chủ trả 404 cho cả ba — id không được phép đọc không nên
 * phân biệt được với id chưa từng có).
 *
 * Đọc cả `failureReason`, không chỉ `error`: react-query thử lại ba lần (chừng tám giây) rồi mới
 * đặt `isError`, mà một 404 thì thử lại cũng vẫn 404 — chờ hết là tám giây nhìn một form trống.
 */
export function isRecordMissing(query: RecordQuery) {
  const error = (query?.error ?? query?.failureReason) as
    | { statusCode?: number; response?: { status?: number } }
    | null
    | undefined;
  return (error?.statusCode ?? error?.response?.status) === 404;
}

/**
 * Thay cho thân trang khi {@link isRecordMissing}: một form trống trông như bản ghi có thật mà chưa
 * điền gì, và bấm Lưu trên nó chỉ nhận về một lỗi khó hiểu. Trang vẫn tự vẽ header của nó (breadcrumb,
 * nút quay lại); đây chỉ là phần thân.
 *
 * @param what tên loại bản ghi, viết thường — "vai trò", "người dùng"
 */
export function RecordNotFound({ what }: { what: string }) {
  const { list } = useNavigation();
  const { resource } = useResourceParams();

  return (
    <div className="bg-card flex flex-col items-center gap-3 rounded-lg border px-6 py-14 text-center">
      <SearchX className="text-muted-foreground size-8" />
      <div className="space-y-1">
        <h2 className="text-base font-semibold">Không tìm thấy {what}</h2>
        <p className="text-muted-foreground max-w-md text-sm">
          Mục này không còn, hoặc bạn không được xem.
        </p>
      </div>
      {resource?.list ? (
        <Button type="button" variant="outline" onClick={() => list(resource.name, "replace")}>
          <ArrowLeftIcon />
          Về danh sách
        </Button>
      ) : null}
    </div>
  );
}
