import {
  ASSET_STATUS_LABELS,
  EQUIPMENT_HISTORY_ACTION_LABELS,
  historyEntryTitle,
  type EquipmentHistoryRow,
} from "@/domains/equipment/types";

/**
 * Gộp lịch sử tài sản thành các mục của dòng thời gian — phần thuần dữ liệu của `equipment-history.tsx`:
 * cùng một phiếu thành một mục; mỗi mục có một dòng kết quả ngắn và phần "Chi tiết" (giá trị cũ → mới, các bước).
 */

/**
 * Một mục trên dòng thời gian. `repeat = false`: các dòng của CÙNG MỘT PHIẾU (mới trước). `repeat = true`: nhiều
 * lần giống hệt nhau liền nhau, mỗi dòng một phiếu khác — vd. mười lần "Kiểm kê: khớp sổ" — hiện "N lần".
 */
export type HistoryEntryData = { rows: EquipmentHistoryRow[]; repeat: boolean };

/**
 * Gộp lịch sử (đã xếp mới trước) thành các mục:
 * 1. Mọi dòng của cùng một phiếu thành MỘT mục, kể cả khi không liền nhau (mượn hôm 1, trả hôm 10) — mục đứng ở
 *    mốc mới nhất của phiếu. Dòng không gắn phiếu (hệ thống tự cập nhật) đứng riêng.
 * 2. Các mục một dòng giống hệt nhau và liền nhau gộp tiếp thành "N lần", như trước.
 */
export function buildEntries(rows: EquipmentHistoryRow[]): HistoryEntryData[] {
  const byVoucher = new Map<string, EquipmentHistoryRow[]>();
  const groups: EquipmentHistoryRow[][] = [];
  for (const r of rows) {
    const key = r.voucherResource && r.voucherId != null ? `${r.voucherResource}:${r.voucherId}` : null;
    const existing = key ? byVoucher.get(key) : undefined;
    if (existing) {
      existing.push(r);
      continue;
    }
    const group = [r];
    if (key) byVoucher.set(key, group);
    groups.push(group);
  }

  const same = (a: EquipmentHistoryRow, b: EquipmentHistoryRow) =>
    [a.action, a.field, a.fromValue, a.toValue, a.note].join("|") === [b.action, b.field, b.fromValue, b.toValue, b.note].join("|");
  const out: HistoryEntryData[] = [];
  for (const group of groups) {
    const last = out[out.length - 1];
    if (group.length === 1 && last && (last.repeat || last.rows.length === 1) && same(last.rows[0], group[0])) {
      last.rows.push(group[0]);
      last.repeat = true;
    } else {
      out.push({ rows: group, repeat: false });
    }
  }
  return out;
}

/** Trường nào đứng trước trong một mục; trường không có tên ở đây xếp sau cùng. */
const FIELD_ORDER = ["status", "condition", "room", "manager", "school", "code"];

/**
 * Mỗi trường đã đổi trong phiếu thành một chuỗi giá trị theo thời gian: "Hỏng → Đang sửa chữa → Hỏng".
 * `asc` là các dòng cũ trước. Giá trị đầu "—" = trước đó trống (lúc ghi tăng).
 */
export function fieldChains(asc: EquipmentHistoryRow[]): { field: string; values: string[] }[] {
  const chains = new Map<string, string[]>();
  for (const r of asc) {
    if (!r.field) continue;
    let values = chains.get(r.field);
    if (!values) {
      values = [r.fromValue ?? "—"];
      chains.set(r.field, values);
    }
    const next = r.toValue ?? "—";
    if (values[values.length - 1] !== next) values.push(next);
  }
  // Thứ tự cố định để mắt luôn gặp trạng thái đầu tiên, dù trường nào được ghi trước trong cùng một lần bấm.
  const rank = (field: string) => {
    const i = FIELD_ORDER.indexOf(field);
    return i < 0 ? FIELD_ORDER.length : i;
  };
  return [...chains].map(([field, values]) => ({ field, values })).sort((a, b) => rank(a.field) - rank(b.field));
}

/**
 * Một bước của phiếu (trình, duyệt, mượn, trả…): các dòng cùng việc, cùng người làm, cách nhau dưới một phút —
 * một lần bấm ghi nhiều trường (trạng thái + tình trạng, trạng thái + phòng). Khác việc là khác bước dù sát giờ:
 * mượn rồi trả ngay vẫn là hai bước.
 */
export type Step = { at: string; actor: string; action: string; notes: string[] };

export function stepsOf(asc: EquipmentHistoryRow[]): Step[] {
  const steps: Step[] = [];
  let startedAt = 0;
  for (const r of asc) {
    const at = new Date(r.createdAt).getTime();
    const actor = r.actorName ?? "Hệ thống";
    const last = steps[steps.length - 1];
    if (last && last.actor === actor && last.action === r.action && at - startedAt < 60_000) {
      last.at = r.createdAt;
      if (r.note && !last.notes.includes(r.note)) last.notes.push(r.note);
    } else {
      steps.push({ at: r.createdAt, actor, action: r.action, notes: r.note ? [r.note] : [] });
      startedAt = at;
    }
  }
  return steps;
}

/** Tên một bước: vế đầu của ghi chú ("Đưa đi bảo dưỡng"), không có thì tên việc. */
function stepLabel(step: Step): string {
  const note = step.notes[0];
  return note ? note.split(/ — |; /)[0] : (EQUIPMENT_HISTORY_ACTION_LABELS[step.action] ?? step.action);
}

/** Nhóm của nút lọc nhanh, theo việc của mục. */
export type HistoryGroupKey = "use" | "fix" | "book";

export const HISTORY_GROUP_LABELS: Record<HistoryGroupKey, string> = {
  use: "Cấp phát, mượn trả",
  fix: "Hỏng, sửa chữa, bảo hành",
  book: "Ghi tăng, ghi giảm",
};

const GROUP_OF_ACTION: Record<string, HistoryGroupKey> = {
  CAP_PHAT: "use", THU_HOI: "use", DIEU_CHUYEN: "use", MUON: "use", TRA: "use", DAT_PHONG: "use", LUU_KHO: "use",
  XUAT_KHO: "use",
  BAO_HONG: "fix", SUA_CHUA: "fix", BAO_HANH: "fix", BAO_TRI: "fix",
  GHI_TANG: "book", CHO_THANH_LY: "book", THANH_LY: "book", CHO_TIEU_HUY: "book", TIEU_HUY: "book", MAT: "book",
  TIEU_HAO: "book",
};

/**
 * Mục thuộc nhóm nào — theo việc của dòng mới nhất. Kiểm kê, cập nhật hồ sơ, tính hao mòn không thuộc nhóm nào:
 * chỉ thấy ở "Tất cả".
 */
export function entryGroup(entry: HistoryEntryData): HistoryGroupKey | null {
  return GROUP_OF_ACTION[entry.rows[0].action] ?? null;
}

/** Khoá và nhãn tháng của một mốc: các mục gom dưới "Tháng 10 / 2026". */
export function monthOf(iso: string): { key: string; label: string } {
  const d = new Date(iso);
  return { key: `${d.getFullYear()}-${d.getMonth()}`, label: `Tháng ${d.getMonth() + 1} / ${d.getFullYear()}` };
}

const two = (n: number) => String(n).padStart(2, "0");
const hhmm = (d: Date) => `${two(d.getHours())}:${two(d.getMinutes())}`;

/** Thời điểm của một mục, đủ ngày giờ: "27/10/2026 16:40". */
export function fullDateTime(iso: string): string {
  const d = new Date(iso);
  return `${two(d.getDate())}/${two(d.getMonth() + 1)}/${d.getFullYear()} ${hhmm(d)}`;
}

/** Giờ của một lần trong mục "N lần", gọn: "28/10 22:05" (năm khác thì "28/10/2025 22:05"). */
export function shortDateTime(iso: string, now = new Date()): string {
  const d = new Date(iso);
  const day = `${two(d.getDate())}/${two(d.getMonth() + 1)}${d.getFullYear() === now.getFullYear() ? "" : `/${d.getFullYear()}`}`;
  return `${day} ${hhmm(d)}`;
}

/** Đuôi tên trường trong tên tài khoản kiểu "Cán bộ thiết bị THCS Bình An" — từ chữ chỉ cấp học trở đi. */
const SCHOOL_SUFFIX = /\s+(THPT|THCS|TH|Tiểu học|Trường)\s.*$/;

/**
 * Tên người làm cho gọn: bỏ đuôi "(demo)" và tên trường — "Cán bộ thiết bị THCS Bình An (demo)" → "Cán bộ thiết
 * bị". Tên trường vẫn bị bỏ kể cả khi tài sản đã chuyển sang trường khác: tên người thật không mang chữ "THCS",
 * "Trường"…, nên chỉ tài khoản đặt theo vai bị cắt.
 */
export function shortActor(name: string, schoolName?: string | null): string {
  let out = name.replace(/\s*\(demo\)\s*$/i, "");
  if (schoolName && out.endsWith(" " + schoolName)) out = out.slice(0, -schoolName.length - 1);
  out = out.replace(SCHOOL_SUFFIX, "");
  return out.trim() || name;
}

/**
 * Ghi chú của một mục, bỏ phần lặp tiêu đề: "Ghi giảm do mất" dưới tiêu đề "Ghi giảm do mất", "Ghi tăng theo
 * phiếu, dòng 1" dưới "Ghi tăng". Ghi chú dạng "Tiêu đề: nội dung" giữ phần nội dung — và khi mục không đổi
 * trường nào (kiểm kê khớp sổ) thì nội dung đó ghép thẳng vào tiêu đề: "Kiểm kê — khớp sổ".
 */
export function tidyNotes(title: string, notes: string[], hasChanges: boolean): { title: string; notes: string[] } {
  const norm = (s: string) => s.trim().toLowerCase();
  const t = norm(title);
  let outTitle = title;
  const kept: string[] = [];
  for (const raw of notes) {
    const n = norm(raw);
    if (n === t || n.startsWith(t + " theo")) continue;
    if (n.startsWith(t + ":")) {
      const rest = raw.trim().slice(title.length + 1).trim();
      if (!rest) continue;
      if (!hasChanges && outTitle === title) outTitle = `${title} — ${rest}`;
      else kept.push(rest);
      continue;
    }
    kept.push(raw.trim());
  }
  return { title: outTitle, notes: kept };
}

/** Trạng thái cuối mà dòng kết quả phải tô đỏ: sửa không được, hỏng lại, mất. */
const BAD_STATUSES = new Set(["BROKEN", "UNREPAIRABLE", "MISSING", "LOST", "NOT_DELIVERED"].map((code) => ASSET_STATUS_LABELS[code]));

/** Một mục đã đọc xong: tên việc, dòng kết quả ngắn, và phần "Chi tiết". */
export type EntrySummary = {
  title: string;
  /** Một dòng kết quả ngắn dưới tên việc — chỉ khi cần (báo hỏng, thanh lý không có). */
  result: string | null;
  /** Kết quả xấu (vd. sửa chữa xong vẫn hỏng) — tô đỏ. */
  bad: boolean;
  /** Chi tiết: mỗi trường một chuỗi giá trị cũ → mới. */
  changes: { field: string; values: string[] }[];
  /** Chi tiết: thông tin thêm có nhãn — "Hạn trả", "Mô tả hỏng". */
  facts: { label: string; value: string }[];
  /** Chi tiết: các bước của phiếu hoặc ghi chú không lên dòng kết quả, nối bằng "; ". */
  steps: string | null;
};

/** "Kho thiết bị → Phòng học 101": đầu → cuối; trước đó trống thì chỉ giá trị cuối. */
const fromTo = (values: string[]) => {
  const first = values[0];
  const last = values[values.length - 1];
  return first === "—" || first === last ? last : `${first} → ${last}`;
};

/**
 * Đọc một phiếu (các dòng cũ trước) thành dòng kết quả + chi tiết, như mockup lịch sử tài sản:
 * - mượn – trả: "Người mượn · mượn 09:15, trả 11:30 (đúng hạn)"; hạn trả vào chi tiết;
 * - đổi chỗ / người giữ (cấp phát, thu hồi, điều chuyển, ghi tăng): "Kho → Phòng 101 · Người quản lý: …";
 * - báo hỏng: không có dòng kết quả, mô tả hỏng vào chi tiết;
 * - còn lại (sửa chữa, bảo hành…): ghi chú của bước cuối — "Sửa xong, đưa vào sử dụng lại".
 * Ghi chú chỉ nhắc lại số phiếu ("Cấp phát theo phiếu CP-…") bị bỏ: số phiếu đã nằm ngay dưới.
 */
export function summarize(asc: EquipmentHistoryRow[]): EntrySummary {
  const changes = fieldChains(asc);
  const steps = stepsOf(asc);
  const actions = asc.map((r) => r.action);
  const code = asc[asc.length - 1].voucherCode;
  const tidied = tidyNotes(historyEntryTitle(actions), steps[steps.length - 1].notes, changes.length > 0);
  // Một lần bấm ghi nhiều trường thường kèm ghi chú lồng nhau ("Sửa xong" và "Sửa xong, đưa vào sử dụng lại"):
  // giữ câu đầy đủ.
  const notes = tidied.notes
    .filter((n) => !code || !n.includes(code))
    .filter((n, _, all) => !all.some((o) => o !== n && o.startsWith(n)));
  const status = changes.find((c) => c.field === "status");
  const bad = !!status && BAD_STATUSES.has(status.values[status.values.length - 1]);
  const stepLine = steps.length > 1 ? steps.map(stepLabel).join("; ") : null;
  const base = { title: tidied.title, bad, changes };

  if (actions.includes("MUON") || actions.includes("TRA")) {
    const lent = steps.find((s) => s.action === "MUON");
    const back = [...steps].reverse().find((s) => s.action === "TRA");
    const lentNote = lent?.notes.find((n) => n.startsWith("Cho ")) ?? "";
    const borrower = /^Cho (.+?) mượn/.exec(lentNote)?.[1];
    const due = /hạn trả (\d{2})\/(\d{2})\/(\d{4})/.exec(lentNote);
    const dueText = due ? `${due[1]}/${due[2]}/${due[3]}` : null;
    const time = (iso: string) => {
      const d = new Date(iso);
      // Mượn và trả khác ngày thì giờ thôi không đủ.
      return lent && back && new Date(lent.at).toDateString() !== new Date(back.at).toDateString() ? shortDateTime(iso) : hhmm(d);
    };
    let onTime = "";
    if (back && due) {
      const dueEnd = new Date(+due[3], +due[2] - 1, +due[1], 23, 59, 59);
      onTime = new Date(back.at) <= dueEnd ? " (đúng hạn)" : " (quá hạn)";
    }
    const when = [lent ? `mượn ${time(lent.at)}` : null, back ? `trả ${time(back.at)}${onTime}` : null].filter(Boolean).join(", ");
    return {
      ...base,
      result: [borrower, when].filter(Boolean).join(" · ") || null,
      facts: dueText ? [{ label: "Hạn trả", value: dueText }] : [],
      steps: null,
    };
  }

  if (actions.includes("BAO_HONG") && actions.every((a) => a === "BAO_HONG")) {
    return { ...base, result: null, facts: notes.length ? [{ label: "Mô tả hỏng", value: notes.join("; ") }] : [], steps: stepLine };
  }

  const place = ["school", "room", "manager"]
    .map((field) => changes.find((c) => c.field === field))
    .filter((c): c is { field: string; values: string[] } => !!c && c.values[c.values.length - 1] !== "—")
    .map((c) => (c.field === "manager" ? `Người quản lý: ${c.values[c.values.length - 1]}` : fromTo(c.values)));
  if (place.length) {
    return { ...base, result: place.join(" · "), facts: [], steps: stepLine ?? (notes.join("; ") || null) };
  }

  return { ...base, result: notes.join(" · ") || null, facts: [], steps: stepLine };
}
