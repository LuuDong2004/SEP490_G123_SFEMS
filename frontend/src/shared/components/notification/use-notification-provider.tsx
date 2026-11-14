import type { NotificationProvider } from "@refinedev/core";
import { toast } from "sonner";
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
          toast.error(description || message, {
            id: key,
            description: description ? message : undefined,
            classNames: {
              icon: "!text-destructive",
              description: "!text-foreground/80 !text-[0.8125rem] !leading-relaxed",
            },
          });
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
