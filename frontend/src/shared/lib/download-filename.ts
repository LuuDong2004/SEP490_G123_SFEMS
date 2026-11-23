/** Giữ tên tiếng Việt có dấu nhưng loại ký tự không hợp lệ trong tên tệp Windows. */
export function safeDownloadName(title: string | undefined): string {
  return title?.replace(/[\\/:*?"<>|]/g, "-").trim() || "Báo cáo";
}
