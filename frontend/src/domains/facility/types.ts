/** Cơ sở vật chất (khối nhà, phòng): hiện trạng và tình trạng sử dụng. */

export const CONDITION_LABELS: Record<string, string> = {
  TOT: "Tốt",
  BINH_THUONG: "Bình thường",
  CAN_SUA_CHUA: "Cần sửa chữa",
  XUONG_CAP: "Xuống cấp",
  HU_HONG_NANG: "Hư hỏng nặng",
};

/** Loại việc làm trên một công trình (sổ sửa chữa, cải tạo — `facility_works`). */
export const FACILITY_WORK_TYPE_LABELS: Record<string, string> = {
  REPAIR: "Sửa chữa",
  RENOVATION: "Cải tạo",
  UPGRADE: "Nâng cấp",
  MAINTENANCE: "Bảo trì",
};

/** Kết cấu công trình theo mẫu CSDL HCM (201) — khác Hiện trạng (chất lượng). */
export const STRUCTURE_LABELS: Record<string, string> = {
  KIEN_CO: "Kiên cố",
  BAN_KIEN_CO: "Bán kiên cố",
  TAM: "Tạm",
  NHO_MUON_THUE: "Nhờ, mượn, thuê",
};

/** Xác nhận hiện trạng của lãnh đạo đơn vị (202). */
export const CONFIRM_STATUS_LABELS: Record<string, string> = {
  PENDING: "Chờ xác nhận",
  CONFIRMED: "Chính thức",
  RETURNED: "Trả lại",
};

/** Cơ sở: trường chính, phân hiệu, điểm trường (201). */
export function campusKindLabel(c: { primaryCampus?: boolean | null; branch?: boolean | null } | null | undefined): string {
  if (!c) return "—";
  return c.primaryCampus ? "Trường chính" : c.branch ? "Phân hiệu" : "Điểm trường";
}

/** Lịch mở cửa của phòng (206): thứ theo ISO 1 = Thứ 2 … 7 = Chủ nhật; buổi SANG / CHIEU / TOI. */
export const OPEN_DAYS = [
  { value: 1, short: "T2" },
  { value: 2, short: "T3" },
  { value: 3, short: "T4" },
  { value: 4, short: "T5" },
  { value: 5, short: "T6" },
  { value: 6, short: "T7" },
  { value: 7, short: "CN" },
] as const;

export const OPEN_SESSIONS = [
  { value: "SANG", label: "Sáng" },
  { value: "CHIEU", label: "Chiều" },
  { value: "TOI", label: "Tối" },
] as const;

/** "T2, T3, T4 · sáng, chiều" — trống là mở mọi lúc. */
export function openingText(days?: number[] | null, sessions?: string[] | null): string {
  const d = days?.length ? OPEN_DAYS.filter((x) => days.includes(x.value)).map((x) => x.short).join(", ") : "Mọi ngày";
  const s = sessions?.length
    ? OPEN_SESSIONS.filter((x) => sessions.includes(x.value)).map((x) => x.label.toLowerCase()).join(", ")
    : "mọi buổi";
  return !days?.length && !sessions?.length ? "Mở mọi lúc" : `${d} · ${s}`;
}

export const USAGE_STATUS_LABELS: Record<string, string> = {
  DANG_SU_DUNG: "Đang sử dụng",
  BO_TRONG: "Bỏ trống",
  DANG_SUA_CHUA: "Đang sửa chữa",
  NGUNG_SU_DUNG: "Ngừng sử dụng",
};
