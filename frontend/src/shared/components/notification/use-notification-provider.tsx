import type { NotificationProvider } from "@refinedev/core";
import { toast } from "sonner";
import { friendlyError, statusOf, withoutStatus } from "@/shared/lib/error-message";
import { UndoableNotification } from "@/shared/components/notification/undoable-notification";

export function useNotificationProvider(): NotificationProvider {
  return {
    open: ({
      key,
      type,
      message,
      description,
      undoableTimeout,
      cancelMutation,
    }) => {
      switch (type) {
        case "success":
          toast.success(message, {
            id: key,
            // Refine gắn dòng phụ `notifications.success` cho mọi lần lưu; khoá đó cố ý rỗng ở vi.json, nhưng
            // i18n (`returnEmptyString: false`) trả về chữ mặc định tiếng Anh "Success" / "Successful" — bỏ dòng đó đi.
            description: description && description !== "Success" && description !== "Successful" ? description : undefined,
            richColors: true,
          });
          return;

        case "error":
          // Nơi gọi truyền `message` = câu lỗi của máy chủ (có khi dài), `description` = kết quả ("Đã lưu nháp
          // nhưng chưa trình được"). Hiện kết quả làm dòng đầu, lý do ở dưới; chữ màu thường, chỉ biểu tượng đỏ —
          // cả khối chữ đỏ trông như máy hỏng.
          {
            // Refine truyền ngược lại: `message` = kết quả ("Lưu … không thành công (mã 422)"), `description` = câu
            // của máy chủ. Câu ngắn hơn làm tiêu đề, câu dài làm dòng giải thích; câu kỹ thuật đổi thành câu dễ hiểu.
            const a = message ?? "";
            const b = description ?? "";
            const status = statusOf(a) ?? statusOf(b);
            const [head, detail] = !b ? [a, ""] : a.length <= b.length ? [a, b] : [b, a];
            const title = withoutStatus(head);
            const reason = detail ? friendlyError(detail, status) : "";
            // "Lỗi" trơn là lỗi khi đọc dữ liệu (`notifications.error` của Refine).
            const titleText = title === "Lỗi" ? "Không tải được dữ liệu"
              : title && friendlyError(title, status) === title ? title : "Không thực hiện được";
            toast.error(titleText, {
              id: key,
              description: reason && reason !== titleText ? reason : !detail && titleText !== title ? friendlyError(title, status) : undefined,
              duration: 8000,
            });
          }
          return;

        case "progress": {
          const toastId = key || Date.now();

          toast(
            () => (
              <UndoableNotification
                message={message}
                description={description}
                undoableTimeout={undoableTimeout}
                cancelMutation={cancelMutation}
                onClose={() => toast.dismiss(toastId)}
              />
            ),
            {
              id: toastId,
              duration: (undoableTimeout || 5) * 1000,
              unstyled: true,
            }
          );
          return;
        }

        default:
          return;
      }
    },
    close: (id) => {
      toast.dismiss(id);
    },
  };
}
