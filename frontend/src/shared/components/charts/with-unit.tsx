import type { ReactNode } from "react";

/**
 * Con số kèm ĐƠN VỊ trên dải chỉ số, bảng điều khiển (QLTB-510): "627 thiết bị", "12 phiếu" — một con số
 * trần không nói nó đếm cái gì. Đơn vị nhỏ và mờ hơn số để mắt vẫn bắt vào số trước.
 */
export function WithUnit({ value, unit }: { value: ReactNode; unit: string }) {
  return (
    <>
      {value}
      <span className="text-muted-foreground ms-1.5 text-sm font-medium tracking-normal">{unit}</span>
    </>
  );
}
