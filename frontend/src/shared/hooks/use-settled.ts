import { useEffect, useState } from "react";

/**
 * Giá trị chỉ "chốt" khi đứng yên `ms` mili giây. Dùng làm cửa cho truy vấn nặng: bấm lướt qua nhiều tab báo cáo
 * thì chỉ tab dừng lại cuối cùng mới gọi máy chủ, các tab lướt qua không bắn truy vấn nào.
 */
export function useSettled(value: string, ms = 250): string {
  const [settled, setSettled] = useState(value);
  useEffect(() => {
    if (value === settled) return;
    const id = setTimeout(() => setSettled(value), ms);
    return () => clearTimeout(id);
  }, [value, settled, ms]);
  return settled;
}
