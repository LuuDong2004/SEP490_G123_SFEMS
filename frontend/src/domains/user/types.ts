/**
 * The `users` resource as the API reports it — `UserResponse` on the backend.
 *
 * Nothing generates this from the Java record, so the two are kept in step by
 * hand; that is the same bargain the rest of the API contract is on.
 */
export type User = {
  id: number;
  username: string;
  email: string;
  fullName: string;
  status: UserStatus;
  roles: RoleSummary[];
  /** Rỗng với tài khoản chưa gắn vào trường nào. */
  school: SchoolSummary | null;

  /**
   * Cơ quan quản lý — Sở hoặc UBND. Rỗng với tài khoản của trường.
   *
   * Đi song song với `school`, không thay thế: người của trường điền trường,
   * người của Sở hoặc UBND điền cơ quan, quản trị viên bỏ trống cả hai. Đây
   * là thứ làm cho "UBND chỉ thấy trường trên địa bàn mình" viết ra được.
   */
  managingBody: ManagingBodySummary | null;
  createdAt: string;
  updatedAt: string | null;
  lastLoginAt: string | null;
};

/** The role as a user row reports it — no permission list at this depth. */
export type RoleSummary = {
  id: number;
  code: string;
  name: string;
};

/**
 * Trường như một dòng tài khoản báo cáo — hẹp hơn payload của chính resource
 * trường.
 *
 * <p>Rỗng KHÔNG phải là trạng thái vô hại: dưới `defaultScope = NONE`, tài
 * khoản chưa gắn trường thì không thấy dòng dữ liệu nào.
 */
/** Cơ quan quản lý rút gọn. Mang cả `type` vì loại giải thích phạm vi dữ liệu. */
export type ManagingBodySummary = {
  id: number;
  code: string;
  name: string;
  type: "so" | "ubnd" | "khac";
};

export type SchoolSummary = {
  id: number;
  code: string;
  name: string;
};

/** Mirrors `UserStatus`; these are the lower-case wire values, not the constants. */
export type UserStatus = "active" | "inactive" | "locked";

export const STATUS_LABELS: Record<UserStatus, string> = {
  active: "Đang hoạt động",
  inactive: "Đã ngưng",
  locked: "Bị khoá",
};


export const STATUS_OPTIONS: { label: string; value: UserStatus }[] = [
  { label: "Đang hoạt động", value: "active" },
  { label: "Đã ngưng", value: "inactive" },
  { label: "Bị khoá", value: "locked" },
];
