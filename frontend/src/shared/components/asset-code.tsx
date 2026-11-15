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
