import { HelpHint } from "@/shared/components/form/help-hint";

/** Sáu phần của mã thiết bị, theo quy tắc sinh mã ở máy chủ (`EquipmentCodeService`). */
const CODE_PARTS: [string, string][] = [
  ["TT", "Mã tỉnh, thành phố (79 là TP. Hồ Chí Minh)"],
  ["TR", "Mã trường, 2 ký tự"],
  ["MH", "Mã môn học của thiết bị. Thiết bị dùng chung là 00"],
  ["LT", "Loại: TB thiết bị vật lý, PM thiết bị số hoặc phần mềm, HL hệ thống hỗ trợ học tập"],
  ["ST", "Số thứ tự, 4 chữ số, đếm riêng cho từng bộ mã trong trường"],
  ["NC", "2 số cuối năm cấp phát (năm tiếp nhận, không có thì năm mua)"],
];

/** Nội dung giải thích mã gồm sáu phần nào, mỗi phần một gạch đầu dòng (đặt vào `meta.hint` của cột, hoặc `EquipmentCodeHint`). */
export function EquipmentCodeExplain() {
  return (
    <>
      <span className="block font-semibold">Mã thiết bị gồm 6 phần TT.TR.MH.LT.ST.NC</span>
      <ul className="mt-1 list-disc space-y-0.5 ps-4 text-start">
        {CODE_PARTS.map(([k, v]) => (
          <li key={k}><span className="font-mono font-semibold">{k}</span>: {v}</li>
        ))}
      </ul>
      <span className="mt-1 block">Ví dụ: <span className="font-mono">79.A1.08.PM.0002.25</span></span>
    </>
  );
}

/** Dấu "?" giải thích cấu tạo mã thiết bị, cho chỗ không phải tiêu đề cột bảng. */
export function EquipmentCodeHint({ className }: { className?: string }) {
  return (
    <HelpHint className={className} label="Cấu tạo mã thiết bị">
      <EquipmentCodeExplain />
    </HelpHint>
  );
}

/**
 * Mã tài sản `TT.TR.MH.LT.ST.NC` với SỐ THỨ TỰ (ST) tô đậm, màu chính (trưởng nhóm 15/11/2026): cả danh sách chung phần
 * đầu "79.T6.27.TB." và đuôi năm ".26", chỉ số thứ tự là thứ mắt cần dò. Mã không theo chuẩn thì in nguyên.
 */
export function AssetCode({ code }: { code: string | null | undefined }) {
  const m = /^(.*\.)(\d{2,4})(\.\d{2})$/.exec(code ?? "");
  if (!m) return <span className="font-mono text-[0.8125rem] font-medium tabular-nums">{code}</span>;
  return (
    <span className="font-mono text-[0.8125rem] tabular-nums" title={code ?? undefined}>
      <span className="text-muted-foreground">{m[1]}</span>
      <span className="text-primary font-semibold">{m[2]}</span>
      <span className="text-muted-foreground">{m[3]}</span>
    </span>
  );
}
