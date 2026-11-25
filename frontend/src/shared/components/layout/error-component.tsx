import { StatusScreen } from "@/shared/components/layout/status-screen";

/** Màn 404 — đường dẫn không khớp màn nào (gõ sai, liên kết cũ). */
export function ErrorComponent() {
  return (
    <StatusScreen code="404" title="Không tìm thấy trang"
      description="Liên kết đã cũ hoặc địa chỉ bị gõ nhầm." />
  );
}

ErrorComponent.displayName = "ErrorComponent";
