import { useTranslate } from "@refinedev/core";
import { DocumentTitleHandler } from "@refinedev/react-router";

const APP = "CSVC & Thiết bị";
const ACTION: Record<string, string> = { create: "Thêm mới", edit: "Sửa", show: "Chi tiết", clone: "Nhân bản" };

/**
 * Tiêu đề tab trình duyệt bằng tiếng Việt, theo đúng tên màn đang mở — thay cho mặc định
 * của Refine ("Equipment | Refine": tên resource tiếng Anh + tên framework).
 *
 * Lấy theo thứ tự: `<resource>.titles.<action>` trong `locales/vi.json` (vd. "Thêm thiết
 * bị"), rồi nhãn của resource kèm tên hành động. Màn không thuộc resource nào (đăng nhập,
 * lỗi) mang tên hệ thống.
 */
export function AppDocumentTitle() {
  const t = useTranslate();
  return (
    <DocumentTitleHandler
      handler={({ resource, action, params }) => {
        if (!resource?.name) return APP;
        const name = resource.name;
        const label =
          (resource.meta?.tabLabel as string | undefined) ??
          (resource.meta?.label as string | undefined) ??
          (() => {
            const k = `${name}.${name}`;
            const v = t(k, name);
            return v && v !== k ? v : name;
          })();
        const act = action ?? "list";
        // i18n trả lại chính KHOÁ khi thiếu bản dịch (không trả chuỗi mặc định rỗng) — coi như không có.
        const key = `${name}.titles.${act}`;
        const found = t(key, "");
        const specific = found && found !== key ? found : "";
        const base = specific || (act === "list" ? label : `${ACTION[act] ?? ""} ${label}`.trim());
        const id = act === "edit" || act === "show" ? (params?.id ? ` #${params.id}` : "") : "";
        return `${base}${id} · ${APP}`;
      }}
    />
  );
}
