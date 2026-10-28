import { useResourceParams } from "@refinedev/core";

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Cột người dùng đã tắt / bật trong menu "Cột hiển thị", nhớ theo bảng ở localStorage — tải lại trang vẫn giữ.
 * Chỉ ghi những gì NGƯỜI DÙNG chọn, không ghi trạng thái hiện tại của bảng: cột do màn tự ẩn / hiện (cột Trường
 * với tài khoản một trường) không được biến thành "lựa chọn" rồi theo người ta sang lần sau.
 *
 * <p>Khoá là `meta.columnsKey` của bảng, không thì tài nguyên xuất (`meta.exportResource`), không thì tài nguyên
 * của trang.
 */
export function useColumnsKey(table: { reactTable: { options: { meta?: unknown } } }): string {
  const { resource } = useResourceParams();
  const meta = table.reactTable.options.meta as { columnsKey?: string; exportResource?: string } | undefined;
  return `dth-columns:${meta?.columnsKey ?? meta?.exportResource ?? resource?.name ?? ""}`;
}

export function readColumnPrefs(key: string): Record<string, boolean> {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as Record<string, boolean>) : {};
  } catch {
    return {};
  }
}

export function writeColumnPrefs(key: string, changes: Record<string, boolean>) {
  try {
    window.localStorage.setItem(key, JSON.stringify({ ...readColumnPrefs(key), ...changes }));
  } catch {
    // bộ nhớ bị chặn hoặc đầy — lựa chọn chỉ còn trong phiên này
  }
}

/**
 * Cột tự ẩn / hiện theo màn (vd. cột Trường khi tài khoản thấy nhiều trường) — trừ khi người dùng đã tự tắt nó.
 */
export function autoVisible(key: string, columnId: string, wanted: boolean): boolean {
  return wanted && readColumnPrefs(key)[columnId] !== false;
}

