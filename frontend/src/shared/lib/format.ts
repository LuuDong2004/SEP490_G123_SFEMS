/**
 * How a date is written, everywhere.
 *
 * There were two shapes on screen at once and both were right on their own:
 * `toLocaleDateString(…, { month: "short" })` gave "Aug 23, 2026" and a bare
 * `toLocaleString()` gave "8/31/2026, 4:00:24 PM". A detail card showing both,
 * two rows apart, makes the reader work out that they are the same kind of
 * value — and the seconds are noise on a record nobody is timing.
 *
 * Both formatters pin `vi-VN` rather than the browser's locale: the whole UI
 * is Vietnamese, so a date that renders "Aug 23, 2026" on an en-US browser
 * would be the one English string left on the screen. The *shape* is the
 * application's decision; the language is fixed with it.
 */

const DATE: Intl.DateTimeFormatOptions = {
  year: "numeric",
  month: "short",
  day: "numeric",
};

const DATE_TIME: Intl.DateTimeFormatOptions = {
  ...DATE,
  hour: "2-digit",
  minute: "2-digit",
};

/** The em dash, not an empty cell — a blank reads as a rendering failure. */
export const EMPTY = "—";

export function formatDate(value?: string | null): string {
  if (!value) return EMPTY;
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? EMPTY
    : date.toLocaleDateString("vi-VN", DATE);
}

export function formatDateTime(value?: string | null): string {
  if (!value) return EMPTY;
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? EMPTY
    : date.toLocaleString("vi-VN", DATE_TIME);
}

/** Ngày lịch thuần ("2025-09-05") -> "05/09/2025", không qua `new Date` (múi giờ). */
export function formatPlainDate(value?: string | null): string {
  if (!value) return "—";
  const [y, m, d] = value.split("-");
  return y && m && d ? `${d}/${m}/${y}` : value;
}

/**
 * Số dòng mỗi trang mặc định của các màn nghiệp vụ (thiết bị, danh mục, phiếu). 20 chứ không
 * phải 10 của Refine: bảng cuộn trong khung nên nhiều dòng hơn không làm trang dài ra.
 */
export const DEFAULT_PAGE_SIZE = 20;

/**
 * Lúc bản ghi được SỬA lần cuối — `undefined` khi nó chưa từng được sửa.
 *
 * Máy chủ đóng `updatedAt` ngay lúc tạo (bằng `createdAt`, lệch nhau vài mili giây), nên chỉ kiểm
 * "có `updatedAt` không" thì bản ghi nào cũng mang dòng "Sửa lần cuối" trùng giờ tạo — đọc như đã có
 * người sửa. Lệch dưới hai giây thì coi là cùng một lần ghi.
 */
export function editedAt(record: { createdAt?: string | null; updatedAt?: string | null } | null | undefined) {
  if (!record?.updatedAt) return undefined;
  if (!record.createdAt) return record.updatedAt;
  const gap = new Date(record.updatedAt).getTime() - new Date(record.createdAt).getTime();
  return Number.isFinite(gap) && Math.abs(gap) < 2000 ? undefined : record.updatedAt;
}

/** Chữ cho dòng "Sửa lần cuối": giờ sửa, hoặc "chưa sửa". */
export function formatEditedAt(record: Parameters<typeof editedAt>[0]) {
  const at = editedAt(record);
  return at ? formatDateTime(at) : "chưa sửa";
}

/**
 * Hai chữ cái đầu của một tên người, cho ô ảnh tài khoản: chữ đầu của từ đầu và từ cuối. Bỏ phần trong ngoặc
 * và các từ không bắt đầu bằng chữ — "Cán bộ thiết bị THCS Bình An (demo)" ra "CA", không phải "C(".
 */
export function initialsOf(name = ""): string {
  const parts = name.replace(/\([^)]*\)/g, " ").trim().split(/\s+/).filter((w) => /^\p{L}/u.test(w));
  if (parts.length === 0) return "?";
  return (parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase();
}

/** Đơn vị nhỏ → đơn vị lớn gấp nghìn lần. Khoá là tên đơn vị viết thường, như danh mục Đơn vị tính. */
const THOUSANDFOLD: Record<string, string> = { gam: "Kg", g: "Kg", "mililít": "Lít", ml: "Lít" };

/**
 * Hệ số đọc một lượng cho dễ: hoá chất ghi theo gam / mililít (đúng đơn vị của phụ lục thông tư) mà từ
 * 1.000 trở lên thì đọc theo kg / lít — 15.750 gam là 15,75 kg. Chỉ đổi cách HIỆN; số lưu và phép so với
 * định mức vẫn theo gam. `basis` là con số quyết định (vd. cột Tổng), để mọi cột của một dòng cùng một đơn vị.
 */
export function readableUnit(basis: number, unit: string | null | undefined): { factor: number; unit: string | null } {
  const big = unit ? THOUSANDFOLD[unit.trim().toLowerCase()] : undefined;
  return big && Math.abs(basis) >= 1000 ? { factor: 1000, unit: big } : { factor: 1, unit: unit ?? null };
}

/** Số lượng để hiện: ngăn hàng nghìn, phần lẻ tối đa hai chữ số. */
export const quantityFormat = new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 2 });


const DIGITS = ["không", "một", "hai", "ba", "bốn", "năm", "sáu", "bảy", "tám", "chín"];
const GROUPS = ["", "nghìn", "triệu", "tỷ", "nghìn tỷ", "triệu tỷ"];

/** Đọc một nhóm ba chữ số; `full` = không phải nhóm cao nhất, nên "0 trăm" vẫn phải đọc ("một triệu không trăm năm"). */
function readTriple(n: number, full: boolean): string {
  const hundred = Math.floor(n / 100);
  const ten = Math.floor((n % 100) / 10);
  const unit = n % 10;
  const out: string[] = [];
  if (hundred > 0 || full) out.push(`${DIGITS[hundred]} trăm`);
  if (ten > 1) {
    out.push(`${DIGITS[ten]} mươi`);
    if (unit === 1) out.push("mốt");
    else if (unit === 5) out.push("lăm");
    else if (unit === 4) out.push("tư");
    else if (unit > 0) out.push(DIGITS[unit]);
  } else if (ten === 1) {
    out.push("mười");
    if (unit === 5) out.push("lăm");
    else if (unit > 0) out.push(DIGITS[unit]);
  } else if (unit > 0) {
    if (hundred > 0 || full) out.push("lẻ");
    out.push(DIGITS[unit]);
  }
  return out.join(" ");
}

/**
 * Số tiền bằng chữ cho chứng từ: 297000000 → "Hai trăm chín mươi bảy triệu đồng chẵn". Chỉ phần nguyên; số âm
 * hay không phải số thì trả chuỗi rỗng.
 */
export function moneyInWords(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value) || value < 0) return "";
  let n = Math.floor(value);
  if (n === 0) return "Không đồng";
  const groups: number[] = [];
  while (n > 0) {
    groups.push(n % 1000);
    n = Math.floor(n / 1000);
  }
  const parts: string[] = [];
  for (let i = groups.length - 1; i >= 0; i--) {
    if (groups[i] === 0) continue;
    parts.push(`${readTriple(groups[i], i < groups.length - 1)} ${GROUPS[i]}`.trim());
  }
  const text = parts.join(" ");
  const exact = Math.floor(value) % 1000 === 0 ? " chẵn" : "";
  return `${text.charAt(0).toUpperCase()}${text.slice(1)} đồng${exact}`;
}
