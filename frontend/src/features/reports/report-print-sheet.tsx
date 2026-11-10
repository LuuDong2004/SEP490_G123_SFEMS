import type { ReportExportColumn } from "./report-export-menu";

const numberFormat = new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 2 });

function formatCell(value: string | number | null | undefined, column: ReportExportColumn) {
  if (value == null || value === "") return "—";
  if (typeof value === "number" && (column.type === "number" || column.type === "money")) {
    return numberFormat.format(value) + (column.type === "money" ? " ₫" : "");
  }
  if (column.type === "date" && typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [year, month, day] = value.split("-");
    return `${day}/${month}/${year}`;
  }
  return String(value);
}

export function ReportPrintSheet({ title, scope, subtitle, columns, rows }: {
  title: string;
  scope: string;
  subtitle: string;
  columns: ReportExportColumn[];
  rows: (string | number | null | undefined)[][];
}) {
  const date = new Intl.DateTimeFormat("vi-VN", { day: "numeric", month: "long", year: "numeric" }).format(new Date());

  return (
    <article className="report-print-sheet hidden text-[9pt] leading-snug text-black print:block">
      <header className="grid grid-cols-2 gap-4 text-center">
        <div className="pt-2 font-semibold uppercase">Sở Giáo dục và Đào tạo<br />Thành phố Hồ Chí Minh</div>
        <div>
          <p className="font-bold uppercase">Cộng hòa xã hội chủ nghĩa Việt Nam</p>
          <p className="font-semibold">Độc lập - Tự do - Hạnh phúc</p>
          <p className="mt-2 italic">ngày {date}</p>
        </div>
      </header>
      <h1 className="mt-6 text-center text-[15pt] font-bold uppercase">{title}</h1>
      <p className="text-center italic">{scope}</p>
      <p className="mt-2 text-center text-[9pt]">{subtitle}</p>
      <table className="report-print-table mt-4 w-full border-collapse text-[8.5pt]">
        <thead><tr>{columns.map((column, index) => <th key={index} className="border border-black px-1.5 py-1 text-center font-semibold">{column.label}</th>)}</tr></thead>
        <tbody>{rows.map((row, rowIndex) => <tr key={rowIndex}>{columns.map((column, cellIndex) => <td key={cellIndex} className={`border border-black px-1.5 py-1 align-top ${column.type === "number" || column.type === "money" ? "text-right tabular-nums" : ""}`}>{formatCell(row[cellIndex], column)}</td>)}</tr>)}</tbody>
      </table>
      <footer className="report-print-signatures mt-8 grid grid-cols-2 gap-8 text-center">
        <div><p className="font-bold">Người lập biểu</p><p className="italic">(Ký, ghi rõ họ tên)</p><div className="h-20" /></div>
        <div><p className="font-bold">Thủ trưởng đơn vị</p><p className="italic">(Ký, ghi rõ họ tên)</p><div className="h-20" /></div>
      </footer>
    </article>
  );
}
