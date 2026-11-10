import type { ReactNode } from "react";

export type PrintTable = { headers: string[]; rows: ReactNode[][]; alignRight?: number[] };

/**
 * Bản in của một chứng từ hoặc báo cáo: quốc hiệu, tên đơn vị, tên chứng từ, các thông tin, bảng, và khối chữ ký.
 *
 * <p>Chỉ hiện khi in (`hidden print:block`); phần màn hình tương ứng mang `print:hidden`. Tách hẳn hai bố cục thay vì
 * in chính màn hình, vì thứ người ta ký và đóng dấu có hình dạng riêng — quốc hiệu, "Người lập phiếu" / "Thủ trưởng
 * đơn vị" ở cuối trang — mà màn hình làm việc không có và không nên có.
 *
 * <p>"Lưu thành PDF" của hộp thoại in là đường xuất PDF: trình duyệt nhúng đúng phông tiếng Việt đang hiển thị, thứ
 * một bộ sinh PDF phía máy chủ phải tự lo.
 */
export function PrintSheet({
  unit,
  parentUnit,
  title,
  subtitle,
  facts = [],
  table,
  signers = [],
  children,
}: {
  unit?: string | null;
  parentUnit?: string | null;
  title: string;
  subtitle?: ReactNode;
  facts?: { label: string; value: ReactNode }[];
  table?: PrintTable;
  signers?: string[];
  children?: ReactNode;
}) {
  const today = new Date();
  return (
    <div className="hidden text-[11pt] leading-snug text-black print:block">
      <div className="grid grid-cols-2 gap-4 text-center">
        <div>
          {parentUnit ? <div className="uppercase">{parentUnit}</div> : null}
          <div className="font-bold uppercase">{unit ?? ""}</div>
        </div>
        <div>
          <div className="font-bold uppercase">Cộng hoà xã hội chủ nghĩa Việt Nam</div>
          <div className="font-semibold">Độc lập - Tự do - Hạnh phúc</div>
          <div className="mt-2 italic">
            ngày {today.getDate()} tháng {today.getMonth() + 1} năm {today.getFullYear()}
          </div>
        </div>
      </div>

      <h1 className="mt-6 text-center text-[15pt] font-bold uppercase">{title}</h1>
      {subtitle ? <div className="text-center italic">{subtitle}</div> : null}

      {facts.length ? (
        <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-1">
          {facts.map((f) => (
            <div key={f.label} className="flex gap-2">
              <dt className="shrink-0">{f.label}:</dt>
              <dd className="font-medium">{f.value ?? "—"}</dd>
            </div>
          ))}
        </dl>
      ) : null}

      {table ? (
        <table className="mt-4 w-full border-collapse text-[10pt]">
          <thead>
            <tr>
              {table.headers.map((h, i) => (
                <th key={i} className="border border-black px-1.5 py-1 text-center font-semibold">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {table.rows.map((row, r) => (
              <tr key={r}>
                {row.map((cell, c) => (
                  <td key={c} className={`border border-black px-1.5 py-1 align-top ${table.alignRight?.includes(c) ? "text-right tabular-nums" : ""}`}>
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      ) : null}

      {children}

      {signers.length ? (
        <div className="mt-8 grid gap-4 text-center" style={{ gridTemplateColumns: `repeat(${signers.length}, minmax(0, 1fr))` }}>
          {signers.map((s) => (
            <div key={s}>
              <div className="font-bold">{s}</div>
              <div className="italic">(Ký, ghi rõ họ tên)</div>
              <div className="h-20" />
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
