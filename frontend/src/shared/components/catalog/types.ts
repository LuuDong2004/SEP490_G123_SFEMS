import type { ColumnDef } from "@tanstack/react-table";
import type { ComponentType, ReactNode } from "react";
import type { Control } from "react-hook-form";

/**
 * Một mục danh mục dùng chung theo đúng hình dạng API trả về —
 * `CatalogResponse` ở backend, chung cho mọi danh mục cùng hình dạng
 * `CatalogEntity`.
 */
export type CatalogItem = {
  id: number;
  code: string;
  name: string;
  sortOrder: number | null;
  active: boolean;
  note: string | null;
  createdAt: string;
  updatedAt: string | null;
};

export const ACTIVE_LABELS: Record<"true" | "false", string> = {
  true: "Đang hoạt động",
  false: "Ngừng hoạt động",
};

/**
 * Mô tả một danh mục cho bộ màn dùng chung.
 *
 * <p>`resource` dùng gạch dưới vì nó đi vào mã quyền và đường dẫn API
 * (`/api/units`, `units:read`); `path` dùng gạch nối vì nó là URL người dùng
 * nhìn thấy. Hai thứ không được lẫn.
 */
export type CatalogConfig = {
  resource: string;
  path: string;
  /**
   * Nhóm con trên menu — tên một resource nhóm khai trong `routes.tsx`, theo
   * đúng cách bản Jmix gom danh mục (`menu.catalog.group.*`).
   */
  group: string;
  /** Icon trên menu. Chọn theo đúng icon Lucide mà bản Jmix đã dùng. */
  icon: import("lucide-react").LucideIcon;
  /** Tên danh mục, dạng số ít, ví dụ "Đơn vị tính". */
  label: string;
  /** Một câu dưới tiêu đề màn danh sách. */
  description: string;
  /** Ví dụ gợi ý cho ô mã và ô tên. */
  codeExample: string;
  /**
   * Mã do hệ thống cấp, người dùng không gõ — câu giải thích hiện dưới ô Mã (chỉ đọc).
   * Vd. thiết bị: mã chuẩn TT.TR.MH.LT.ST.NC do bộ đếm của Sở cấp.
   */
  codeReadOnly?: string;
  /** Mã do form tự điền theo quy tắc mã của trường — vẫn sửa được; để nguyên thì máy chủ chốt mã gợi ý. */
  codeAuto?: boolean;
  /** Luật riêng cho ô Mã khi nó không phải một mã ASCII — vd. tên lớp ("Mầm 1") có dấu và khoảng trắng. */
  codePattern?: { value: RegExp; message: string };
  nameExample: string;
  /** Nhãn của ô/cột Tên nếu khác "Tên", ví dụ "Họ tên" cho cán bộ. */
  nameLabel?: string;
  /** Kiểu chuẩn của ô Tên khi không phải tên một thứ — cán bộ: `PERSON_NAME` (họ tên người, tối đa 100). */
  nameRule?: import("@/shared/lib/field-rules").TextRule;
  /**
   * Trần độ dài riêng, hẹp hơn trần chung của kiểu ô (mã 64, tên 255, ghi chú 500) — phòng: mã 20, tên 100, ghi chú
   * 255 (chốt 12/11/2026). Máy chủ kiểm cùng số.
   */
  codeMax?: number;
  nameMax?: number;
  noteMax?: number;
  /** Nhãn của ô/cột Mã nếu khác "Mã", ví dụ "Tên lớp" cho lớp học (6A1). */
  codeLabel?: string;
  /**
   * Ẩn ô Mã trên form — mã danh mục không phải thứ người nhập gõ (môn học: `code` là
   * bản sao của `teaching_code`, máy chủ tự gán). Cột MÃ và chi tiết vẫn hiển thị.
   */
  hideCode?: boolean;
  /**
   * Bỏ cột STT của bảng. Mã môn (08, 11, 12…) cũng là số, nên hai cột số đứng cạnh nhau làm người
   * dùng đọc nhầm cột nọ sang cột kia (góp ý của tester). STT chỉ là số đếm hàng, bỏ đi không mất gì.
   */
  hideIndex?: boolean;
  /**
   * Thứ tự mặc định của bảng, khi danh mục cần khác thứ tự chung của máy chủ (thứ tự hiển thị → tên).
   * Môn học xếp theo mã môn tăng dần (góp ý của tester): người dùng dò môn theo mã, không theo thứ tự nhập.
   */
  defaultSort?: { field: string; order: "asc" | "desc" };
  /** Nhãn ô Mã trên màn XEM chi tiết nếu khác `codeLabel` — vd. cột "Mã môn", chi tiết "Mã môn dạy học". */
  codeShowLabel?: string;
  /**
   * Ẩn ô Tên trên form — tên do phần riêng của danh mục tự điền từ mã (lớp học: "6A1" → "Lớp 6A1").
   * Hai ô cùng nói một thứ thì người nhập không biết phải gõ ô nào.
   */
  hideName?: boolean;
  /** Ẩn ô Thứ tự trên form — máy chủ tự xếp (lớp học: theo khối rồi theo số lớp). */
  hideSortOrder?: boolean;
  /**
   * Form thêm/sửa mở TRANG riêng thay vì hộp thoại — cho danh mục nhiều trường
   * (môn học, tổ chuyên môn, thiết bị...). Mặc định: hộp thoại.
   */
  pageForm?: boolean;
  /**
   * Đi cùng `pageForm`: màn chi tiết vẫn là TRANG (hồ sơ dài, có bảng), nhưng Thêm mới và Sửa từ danh sách
   * mở HỘP THOẠI — danh sách ở lại phía sau, lưu xong là thấy dòng mới. Hộp thoại vẽ `extra.FormBody`.
   */
  formDialog?: boolean;
  /** Bề rộng ô mã khi giá trị rất ngắn (tên lớp "6A1"), thay cho 14rem chuẩn của `form-flow`. */
  codeWidth?: string;
  /** Phần RIÊNG của danh mục (trường, cột, ô chi tiết) — vắng là danh mục thuần năm trường chung. */
  extra?: CatalogExtra;
  /** Ẩn khỏi menu — dữ liệu trường vào qua màn Tổng quan, không qua menu rời. */
  hidden?: boolean;

  /**
   * Số đếm cạnh tên trên cột trái của Danh mục dùng chung đọc resource khác — bộ tiêu chuẩn đếm
   * THIẾT BỊ trong các bộ (`equipment_norms`), không đếm ba bộ theo cấp học.
   */
  countResource?: string;
  /** Lọc thêm khi đếm `countResource` — vd. chỉ thiết bị thuộc danh mục tối thiểu. */
  countFilters?: { field: string; value: string }[];
};

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Phần RIÊNG của một danh mục, gắn thêm vào bộ màn dùng chung.
 *
 * <p>Mỗi feature gắn nó vào `CatalogConfig.extra` trong registry của mình — bộ
 * màn dùng chung (shared) không tra ngược lên feature nào.
 */
export type CatalogExtra = {
  /** Tiêu đề và gợi ý của nhóm ô riêng trên form. */
  section: { title: string; /** Đứng luôn trong khối Thông tin cơ bản, không thành nhóm riêng. */ inline?: boolean };
  /** Giá trị mặc định của các trường riêng khi tạo mới. */
  defaults: Record<string, unknown>;
  /** Các ô nhập riêng. `record` chỉ có ở màn sửa — để ghép giá trị vào ô chọn. */
  Fields: (props: { control: Control<any>; record?: any }) => ReactNode;
  /** Các cột riêng, chèn sau cột Tên. */
  columns: ColumnDef<any, any>[];
  /** Các ô riêng trên màn chi tiết. */
  show: (record: any) => CatalogShowField[];
  /** Các khối dưới thẻ chi tiết (lịch sử, tệp đính kèm...). */
  ShowBelow?: (props: { record: any }) => ReactNode;
  /**
   * Hộp thoại XEM chia tab: "Thông tin" (cùng các ô, cùng thứ tự với form sửa) rồi từng tab này — hồ sơ có
   * nhiều khối (thiết bị, lịch sử, tệp) vẫn gọn một màn thay vì một cột dài phải cuộn. Trang chi tiết vẫn dùng
   * `ShowBelow`.
   */
  ShowTabs?: { key: string; label: string; Content: (props: { record: any }) => ReactNode }[];
  /**
   * Thân RIÊNG của tab "Thông tin" trong hộp xem (thay lưới ô chung) — phòng: dải ảnh + QR trên đầu rồi form chỉ đọc
   * cùng nhóm, cùng lưới với form Sửa (trưởng nhóm chọn cách 2, 12/11/2026). Dải tab vẫn là Thông tin + `ShowTabs`.
   */
  ShowInfo?: (props: { record: any }) => ReactNode;
  /**
   * Đầu hộp Thêm / Sửa vẽ riêng (cán bộ: ảnh đại diện + họ tên + loại, mockup D1 12/11/2026). `record` là bản ghi
   * đang sửa (vắng khi thêm mới hoặc đang tải).
   */
  FormHeading?: (props: { record?: any; creating: boolean }) => ReactNode;
  /** Đầu hộp XEM vẽ riêng — đi cùng `FormHeading` để bấm Sửa đầu hộp không đổi (cán bộ). */
  ShowHeading?: (props: { record?: any }) => ReactNode;
  /** Thân hộp XEM vẽ riêng, thay lưới ô chung; hộp cùng cỡ với hộp Thêm / Sửa (`dialogSize`). */
  ShowBody?: (props: { record: any; /** Thân tự chuyển phần (phòng: cột trái mở Thiết bị / Hồ sơ): nút Sửa chỉ hiện khi phần là `"info"`. */ onTab?: (key: string) => void }) => ReactNode;
  /** Dòng nhắc ở chân hộp XEM, bên trái nút Đóng (phòng: "Còn N ô bắt buộc chưa khai: …"). */
  ShowFooterNote?: (props: { record: any }) => ReactNode;
  /** Dòng nhắc ở chân hộp Thêm / Sửa, bên trái nút Huỷ (phòng: "Còn N ô bắt buộc chưa điền"). */
  FormFooterNote?: (props: { control: any }) => ReactNode;
  /**
   * Hộp thoại XEM kiểu thẻ tóm tắt (phòng): khối này (chip trạng thái, ô số, các nhóm thông tin) đứng TRÊN dải tab
   * và thay cho tab "Thông tin" — dải tab chỉ còn `ShowTabs`. Vắng: hộp xem như cũ.
   */
  ShowSummary?: (props: { record: any }) => ReactNode;
  /**
   * Thân màn chi tiết RIÊNG (thay cho lưới trường chung) ở trang chi tiết — bản ghi có hồ sơ
   * dày (thiết bị: ảnh, nhóm trường, lịch sử). Hộp thoại xem nhanh vẫn dùng lưới chung.
   */
  Detail?: (props: { record: any }) => ReactNode;
  /** Trang sửa (`FormBody`) đặt Huỷ / Lưu ở đầu trang thay cho thanh lưu dính đáy — form ngắn, thanh đáy chỉ để trống. */
  saveInHeader?: boolean;
  /** Các khối dưới form SỬA (vd. tệp đính kèm — thêm, xoá tệp là việc của lúc sửa). */
  EditBelow?: (props: { record: any }) => ReactNode;
  /**
   * Thân form Thêm/Sửa RIÊNG, thay cho khung chung (Thông tin cơ bản · phần riêng · Hiển thị) —
   * để màn Sửa cùng bố cục với màn chi tiết (`Detail`). Nút Lưu / Huỷ vẫn do trang vẽ.
   */
  FormBody?: (props: {
    control: any;
    record?: any;
    suggestedCode?: string | null;
    config: CatalogConfig;
    /** Đang nằm trong hộp thoại: thân form không tự vẽ khung thẻ nữa (hộp thoại đã là khung). */
    inDialog?: boolean;
  }) => ReactNode;
  /**
   * Cỡ hộp thoại thêm / sửa khi có `FormBody` — mặc định `wide`; form ít ô (lớp học) dùng `form`, form nhiều
   * ô mà muốn thấy hết không cuộn (phòng) dùng `formFit`.
   */
  dialogSize?: "form" | "formFit" | "formWide" | "wide";
  /** Đầu hộp thoại thêm / sửa hiện biểu tượng và mô tả của danh mục (`icon`, `description`) dưới tiêu đề. */
  dialogHeader?: boolean;
  /**
   * Cột phải của trang Thêm / Sửa (đi cùng `FormBody`): thẻ tóm tắt dính khi cuộn như form phiếu — thông tin,
   * "Cần hoàn thiện", nút Lưu · Huỷ — thay cho thanh lưu dưới đáy. Nút lưu là `type="submit"`: thẻ nằm trong form.
   */
  FormSide?: (props: {
    control: any;
    record?: any;
    config: CatalogConfig;
    mode: "create" | "edit";
    submitting: boolean;
    onCancel: () => void;
  }) => ReactNode;
  /** Nút "⋯" trên đầu trang chi tiết (thao tác phụ) — xem `ShowViewHeader.more`. */
  ShowMore?: (props: { record: any }) => ReactNode;
  /** Nút riêng ở đầu màn danh sách, trước nút Thêm mới (thiết bị: tra cứu, in tem). */
  ListActions?: () => ReactNode;
  /** Lối PHỤ của màn danh sách, là các `DropdownMenuItem` — nằm trong menu bánh răng của bảng. */
  ListMenu?: () => ReactNode;
  /**
   * Cột bên trái bảng (thiết bị: cây nhóm và cây đơn vị). Nó báo bộ lọc của mình qua
   * `onFiltersChange`; danh sách gộp chúng vào lọc cố định, nên không lẫn với ô lọc
   * nâng cao và không lên chip lọc.
   */
  ListAside?: (props: {
    onFiltersChange: (filters: import("@refinedev/core").CrudFilter[]) => void;
  }) => ReactNode;
  /**
   * Các CHẾ ĐỘ XEM khác của màn danh sách, đứng trước bảng từng bản ghi (vd. thiết bị:
   * tổng hợp theo mặt hàng, theo kho/phòng). Dùng chung bộ lọc của `ListAside`; `drill`
   * mở bảng từng bản ghi với bộ lọc thêm (bấm một dòng tổng hợp → các tài sản của nó).
   */
  ListViews?: {
    key: string;
    label: string;
    /** Rê chuột lên nút chọn chế độ xem: một câu nói chế độ này cho xem gì. */
    hint?: string;
    render: (ctx: {
      filters: import("@refinedev/core").CrudFilter[];
      drill: (filters: import("@refinedev/core").CrudFilter[], label: string) => void;
    }) => ReactNode;
  }[];
  /**
   * Cột Tên của bảng: tiêu đề khác "Tên", và dòng phụ dưới tên thay cho ghi chú — vd.
   * thiết bị: dòng phụ là mặt hàng, để không phải có hai cột Tên và Thiết bị cạnh nhau.
   */
  nameColumn?: { header?: string; subline?: (record: any) => ReactNode };
  /**
   * Ẩn cột "Trạng thái" (cờ đang dùng / ngừng dùng của bản ghi danh mục) — với bản ghi có
   * trạng thái nghiệp vụ riêng (thiết bị: trong kho, đang dùng...) hai cột cùng tên chỉ gây nhầm.
   */
  hideActiveColumn?: boolean;
  /**
   * Bỏ hẳn cờ hoạt động chung (ô trên form, dòng ở màn xem, cột ở bảng) — bản ghi đã có trạng thái
   * nghiệp vụ riêng và máy chủ suy cờ ấy từ đó (phòng: Tình trạng sử dụng = Ngừng sử dụng).
   */
  hideActive?: boolean;
  /** Bản ghi này còn sửa được không (luật nghiệp vụ, ngoài quyền) — vd. tài sản đã ra khỏi sổ thì không. */
  canEdit?: (record: any) => boolean;
  /**
   * Không vẽ nút "Thêm mới" mặc định — bản ghi này KHÔNG được tạo thẳng trong luồng thường
   * (thiết bị vào sổ qua phiếu nhập); `ListActions` tự đưa lối đúng.
   */
  hideCreate?: boolean;
  /**
   * Thay CẢ màn danh sách bằng màn riêng của feature — khi bản ghi của danh mục chỉ là khung cho
   * một thứ khác (bộ tiêu chuẩn: ba bộ theo cấp học, thứ người ta làm việc là các dòng thiết bị
   * bên trong). Thêm / sửa / xem của chính danh mục vẫn đi qua các màn chung.
   */
  ListPage?: import("react").ComponentType<{ config: CatalogConfig }>;
  /** Độ rộng cột Mã (px) khi mã dài hơn mặc định — vd. mã tài sản 79.T6.00.TB.007.26. */
  codeSize?: number;
  /** Cột mã là MÃ TÀI SẢN chuẩn: tô nổi số thứ tự (`AssetCode`). */
  assetCode?: boolean;
  /**
   * Bản ghi này có được xoá không (theo TRẠNG THÁI, ngoài quyền) — vd. thiết bị chỉ xoá được
   * khi đã thanh lý / ghi giảm. Vắng = luôn cho (quyền quyết). Máy chủ kiểm lại lần nữa.
   */
  canDelete?: (record: any) => boolean;
  /** Nhãn của chế độ xem bảng từng bản ghi khi có `ListViews` — vd. "Chi tiết". */
  itemsLabel?: string;
  /** Lời giải thích của chế độ xem bảng từng bản ghi (cạnh `itemsLabel`). */
  itemsHint?: string;
  /**
   * Thay bảng từng bản ghi mặc định bằng bảng riêng của feature (vd. thiết bị: tài sản từng
   * cái VÀ lô hàng trong một bảng, đọc `/api/equipment_items`). Nhận bộ lọc đã gộp của cột
   * trái và chip "Đang xem"; bảng mặc định khi đó không tải.
   */
  ItemsView?: import("react").ComponentType<{
    filters: import("@refinedev/core").CrudFilter[];
    fill: boolean;
    externallyFiltered: boolean;
  }>;
};

/** Một ô trên màn / hộp xem chi tiết. */
export type CatalogShowField = {
  label: string;
  value: ReactNode;
  /** Số cột (lưới 4) — khớp ô nhập trên form. */
  span?: 2 | 3 | 4;
  /** Bắt đầu hàng mới ở hộp xem — như form xuống hàng ở ô này. */
  newRow?: boolean;
  /**
   * Nhóm của ô — khai khi form sửa chia nhóm (Thông tin phòng · Vị trí · Tình trạng…): hộp xem vẽ đúng các nhóm đó,
   * cùng biểu tượng, cùng thứ tự, nên bấm Sửa thì mỗi ô nằm nguyên chỗ. Mã, Tên vào nhóm đầu; Ghi chú vào nhóm cuối.
   */
  group?: string;
  /** Biểu tượng của nhóm (khai ở ô đầu của nhóm). */
  groupIcon?: ComponentType<{ className?: string }>;
};
