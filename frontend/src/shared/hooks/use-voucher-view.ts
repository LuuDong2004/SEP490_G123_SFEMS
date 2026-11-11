import { usePersistentState } from "@/shared/hooks/use-persistent-state";

export type VoucherView = "work" | "document";

/**
 * Dạng xem của màn chi tiết một loại phiếu, nhớ theo người dùng (ai quen đọc phiếu như tờ giấy thì lần sau
 * mở ra vẫn là tờ giấy). `name` là tên ngắn của loại phiếu ("intake", "inventory") — mỗi loại nhớ riêng.
 */
export function useVoucherView(name: string) {
  return usePersistentState<VoucherView>(`${name}.show.view`, "work", "local");
}
