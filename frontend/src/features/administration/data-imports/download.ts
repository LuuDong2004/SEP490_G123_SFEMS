import { kyInstance, DOWNLOAD_TIMEOUT } from "@/shared/api/data";

/** Khoá react-query của danh sách lô — màn lô làm mới nó sau mỗi lần ghi, hoàn tác, xoá. */
export const BATCHES_KEY = ["data_imports", "list"];

/** Tải một tệp từ API (kèm token) và lưu theo tên máy chủ đặt trong Content-Disposition. */
export async function download(path: string, fallbackName: string) {
  const response = await kyInstance.get(path, { timeout: DOWNLOAD_TIMEOUT });
  const disposition = response.headers.get("Content-Disposition") ?? "";
  const match = /filename\*=UTF-8''([^;]+)/.exec(disposition) ?? /filename="?([^";]+)"?/.exec(disposition);
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = match ? decodeURIComponent(match[1]) : fallbackName;
  a.click();
  URL.revokeObjectURL(url);
}
