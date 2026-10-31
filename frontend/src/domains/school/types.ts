/**
 * Resource `schools` theo đúng hình dạng API trả về — `SchoolResponse` ở
 * backend. Hai tham chiếu về dưới dạng đối tượng rút gọn, không phải id trần.
 */
export type School = {
  id: number;
  code: string;
  /**
   * Mã định danh cơ sở giáo dục của Bộ GD&ĐT — 20 ký tự, duy nhất toàn quốc,
   * bất biến. Khoá để liên thông CSDL ngành. Rỗng nghĩa là chưa liên thông được.
   */
  moetCode: string | null;

  /**
   * Mã hai ký tự của trường, là thành phần TR khi sinh mã tài sản.
   * KHÔNG phải mã của Bộ — trước đây bị gọi nhầm là `emisCode`.
   */
  shortCode: string | null;
  name: string;
  departmentOfEducation: {
    id: number;
    code: string;
    name: string;
  } | null;
  /**
   * Cơ quan quản lý được xác định bằng cách nào. CHỈ ĐỌC — form không ghi vào
   * đây, nó nói về xuất xứ của dữ liệu chứ không phải thuộc tính của trường.
   *
   * Rỗng nghĩa là người dùng tự chọn, hoặc chưa có cơ quan quản lý.
   */
  departmentSource: DepartmentSource | null;
  educationLevel: {
    id: number;
    code: string;
    name: string;
    shortName: string | null;
  } | null;
  /**
   * Phường/xã, giờ là tham chiếu tới danh mục chứ không còn là chữ tự do.
   *
   * Đổi vì Chương V mục 3.5.2 và 3.5.8 yêu cầu tổng hợp số liệu THEO ĐỊA BÀN:
   * "Phường Sài Gòn" và "P. Sài Gòn" là hai nhóm khác nhau khi gộp, nên báo
   * cáo vẫn ra số mà ra nhầm. Nó cũng là khoá phân quyền — UBND quản lý
   * trường trên địa bàn mình.
   */
  ward: WardSummary | null;

  /**
   * Địa bàn người dùng từng gõ tay, còn lại từ trước khi có danh mục.
   *
   * Chỉ đọc. Khác rỗng trong khi `ward` rỗng nghĩa là dòng này CHƯA CHUẨN HOÁ
   * — màn hình nên nói vậy thay vì hiển thị một ô trống.
   */
  wardText: string | null;
  address: string | null;
  primaryColor: string | null;
  classCount: number | null;
  studentCount: number | null;
  status: SchoolStatus;
  createdAt: string;
  updatedAt: string | null;
};

/** Phường/xã rút gọn, đúng hình dạng `SchoolResponse.WardSummary`. */
export type WardSummary = {
  id: number;
  code: string;
  name: string;
};

/** Soi gương `OrgStatus` ở backend — dùng chung cho cả Sở lẫn trường. */
export type SchoolStatus = "active" | "inactive";

/**
 * Cách xác định cơ quan quản lý, tin cậy giảm dần.
 *
 * Tồn tại vì phần lớn 946 trường được gán bằng SUY LUẬN từ địa chỉ, chứ không
 * phải theo phân công quản lý do Sở công bố. Không ghi lại cách gán thì sau đó
 * không ai phân biệt nổi đâu là sự thật, đâu là phỏng đoán — cả hai trông y hệt
 * nhau trong bảng.
 */
export type DepartmentSource =
  | "phan_cap"
  | "nguon"
  | "nq_1685"
  | "nhieu_chang"
  | "phuong_chia"
  | "quan_cu";

export const DEPARTMENT_SOURCE_LABELS: Record<DepartmentSource, string> = {
  phan_cap: "Theo phân cấp quản lý",
  nguon: "Theo dữ liệu nguồn",
  nq_1685: "Suy từ địa chỉ (NQ 1685)",
  nhieu_chang: "Suy từ địa chỉ, qua nhiều đợt sắp xếp",
  phuong_chia: "Phường cũ bị chia, đã chọn một",
  quan_cu: "Chỉ biết quận cũ, gán tạm",
};

/**
 * Những cách gán CẦN ĐỐI SOÁT lại với Sở.
 *
 * Hai nhóm này là phỏng đoán thật sự: một nhóm chọn đại một trong nhiều phường,
 * nhóm kia chỉ biết tới cấp quận cũ. Màn hình đánh dấu chúng để người đọc biết
 * số liệu nào chưa nên tin, và để lần đối soát sau có mục tiêu.
 */
export const DEPARTMENT_SOURCE_UNCERTAIN: DepartmentSource[] = ["phuong_chia", "quan_cu"];

export const STATUS_LABELS: Record<SchoolStatus, string> = {
  active: "Đang hoạt động",
  inactive: "Đã ngưng",
};



export const STATUS_OPTIONS: { label: string; value: SchoolStatus }[] = [
  { label: "Đang hoạt động", value: "active" },
  { label: "Đã ngưng", value: "inactive" },
];
