import { createContext, useContext } from "react";

/**
 * Báo cho một khối nội dung (lịch sử sửa chữa, tệp đính kèm, thiết bị…) rằng nó đang là TRANG RIÊNG chiếm kín khung
 * bên phải của hộp hồ sơ (hộp phòng: Thiết bị · Lịch sử sửa chữa · Hồ sơ, bản vẽ). Khi đó khối giãn kín chiều cao và
 * lúc trống thì biểu tượng + chữ đứng CHÍNH GIỮA khung (trưởng nhóm 13/11/2026), thay cho một dòng viền đứt dồn lên đầu.
 * Ngoài ngữ cảnh này (khối nằm giữa trang hồ sơ) khối giữ dáng gọn như cũ.
 */
export const FillPanelContext = createContext(false);

export const useFillPanel = () => useContext(FillPanelContext);
