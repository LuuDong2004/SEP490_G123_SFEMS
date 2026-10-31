/**
 * Resource `departments_of_education` theo đúng hình dạng API trả về —
 * `DepartmentOfEducationResponse` ở backend.
 *
 * Không có gì sinh file này ra từ Java record, nên hai bên giữ khớp bằng tay.
 */
export type DepartmentOfEducation = {
  id: number;
  code: string;
  name: string;
  province: string | null;
  address: string | null;
  type: ManagingBodyType;
  status: OrgStatus;
  createdAt: string;
  updatedAt: string | null;
};

/**
 * Loại cơ quan quản lý — soi gương `ManagingBodyType` ở backend.
 *
 * Không phải mọi trường đều do Sở quản lý: Sở quản lý trực tiếp THPT, còn
 * Tiểu học và THCS do UBND phường/xã quản lý. Loại là thứ quyết định phạm vi
 * dữ liệu của mọi tài khoản thuộc cơ quan này, nên nó không phải nhãn hiển
 * thị mà là dữ liệu phân quyền.
 */
export type ManagingBodyType = "so" | "ubnd" | "khac";

export const MANAGING_BODY_TYPE_LABELS: Record<ManagingBodyType, string> = {
  so: "Sở Giáo dục và Đào tạo",
  ubnd: "UBND phường/xã",
  khac: "Cơ quan quản lý khác",
};

/** Nhãn ngắn cho cột lưới và chip, nơi tên đầy đủ không vừa. */
export const MANAGING_BODY_TYPE_SHORT_LABELS: Record<ManagingBodyType, string> = {
  so: "Sở",
  ubnd: "UBND",
  khac: "Khác",
};

export const MANAGING_BODY_TYPE_OPTIONS: { label: string; value: ManagingBodyType }[] = [
  { label: "Sở Giáo dục và Đào tạo", value: "so" },
  { label: "UBND phường/xã", value: "ubnd" },
  { label: "Cơ quan quản lý khác", value: "khac" },
];

/** Soi gương `OrgStatus`; đây là giá trị chữ thường trên đường truyền. */
export type OrgStatus = "active" | "inactive";

export const STATUS_LABELS: Record<OrgStatus, string> = {
  active: "Đang hoạt động",
  inactive: "Đã ngưng",
};



export const STATUS_OPTIONS: { label: string; value: OrgStatus }[] = [
  { label: "Đang hoạt động", value: "active" },
  { label: "Đã ngưng", value: "inactive" },
];
