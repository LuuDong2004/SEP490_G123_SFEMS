import { useEffect, useState } from "react";

/**
 * `useState` nhớ qua tải lại trang và qua lần chuyển menu.
 *
 * - `local`: sở thích của người dùng (dạng xem cây / khối) — giữ lâu dài.
 * - `session`: chỗ đang đứng (tầng đang mở, trang, ô tìm) — giữ trong tab này,
 *   mất khi đóng tab, để lần mở sau bắt đầu từ đầu thay vì từ một chỗ đã quên.
 *
 * Bộ nhớ trình duyệt có thể bị chặn (trình duyệt riêng tư, chính sách máy) — lúc
 * đó hook chạy như `useState` thường, không bao giờ làm vỡ màn hình.
 */
export function usePersistentState<T>(key: string, initial: T, where: "local" | "session" = "session") {
  const storage = () => (where === "local" ? window.localStorage : window.sessionStorage);
  const [value, setValue] = useState<T>(() => {
    try {
      const raw = storage().getItem(key);
      return raw === null ? initial : (JSON.parse(raw) as T);
    } catch {
      return initial;
    }
  });
  useEffect(() => {
    try {
      storage().setItem(key, JSON.stringify(value));
    } catch {
      // bộ nhớ bị chặn hoặc đầy — giữ trong bộ nhớ React là đủ
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, value]);
  return [value, setValue] as const;
}
