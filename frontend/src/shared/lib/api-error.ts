/** Câu báo lỗi của server (422 nói bằng tiếng Việt), thay vì "Request failed with status code 422". */
export async function errorMessage(error: unknown): Promise<string> {
  const response = (error as { response?: Response })?.response;
  if (response) {
    try {
      const body = (await response.clone().json()) as { message?: string };
      if (body?.message) return body.message;
    } catch {
      // không phải JSON — dùng câu mặc định bên dưới
    }
  }
  // `kyInstance` ném object thường `{message, statusCode, errors}` (hook cuối của `shared/api/data.ts`), không phải
  // `Error` — thiếu nhánh này thì mọi câu 422 của máy chủ (trình, duyệt, trả lại…) thành "Không thực hiện được".
  const message = (error as { message?: unknown })?.message;
  if (typeof message === "string" && message) return message;
  return "Không thực hiện được";
}
