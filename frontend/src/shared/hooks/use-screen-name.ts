import { useResourceParams, useTranslate } from "@refinedev/core";

/** Viết thường chữ đầu để ghép vào giữa câu ("Xoá phòng này?"); giữ nguyên chữ viết tắt (THCS…). */
export function midSentence(text: string) {
  return /^\p{Lu}\p{Lu}/u.test(text) ? text : text.charAt(0).toLowerCase() + text.slice(1);
}

/**
 * Tên của màn đang mở và của loại bản ghi nó nói về — để các hộp hỏi lại gọi đúng tên ("Thoát khỏi
 * màn lập phiếu nhập?", "Xoá phòng này?") thay cho một câu chung cho mọi màn. Cùng nguồn với tiêu đề
 * tab trình duyệt: `<resource>.titles.<action>` trong `vi.json`, rồi nhãn của resource.
 */
export function useScreenName(resourceName?: string) {
  const t = useTranslate();
  const { resource, action } = useResourceParams(resourceName ? { resource: resourceName } : undefined);
  const name = resource?.name;
  const found = (key: string) => {
    const v = t(key, "");
    return v && v !== key ? v : "";
  };
  const label = name ? ((resource?.meta?.label as string | undefined) ?? found(`${name}.${name}`)) : "";
  const title = name && action ? found(`${name}.titles.${action}`) : "";
  return { action, label, noun: label ? midSentence(label) : "", title };
}
