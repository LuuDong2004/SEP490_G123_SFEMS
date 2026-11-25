import { useResourceParams } from "@refinedev/core";
import { Printer } from "lucide-react";
import { useEffect, useRef, type ReactNode } from "react";

import { logExport } from "@/shared/api/export-log";
import { Button } from "@/shared/ui/button";

export type PrintTable = { headers: string[]; rows: ReactNode[][]; alignRight?: number[] };

/**
 * Bản in của một chứng từ hoặc báo cáo: quốc hiệu, tên đơn vị, tên chứng từ,
 * các thông tin, bảng, và khối chữ ký.
 *
 * <p>Chỉ hiện khi in (`hidden print:block`); phần màn hình tương ứng mang
 * `print:hidden`. Tách hẳn hai bố cục thay vì in chính màn hình, vì thứ người ta
 * ký và đóng dấu có hình dạng riêng — quốc hiệu, "Người lập phiếu" / "Thủ trưởng
 * đơn vị" ở cuối trang — mà màn hình làm việc không có và không nên có.
 *
 * <p>"Lưu thành PDF" của hộp thoại in là đường xuất PDF: trình duyệt nhúng đúng
 * phông tiếng Việt đang hiển thị, thứ một bộ sinh PDF phía máy chủ phải tự lo.
 *
 * <p>Mỗi lần mở hộp thoại in (nút In, menu, hay Ctrl+P) khi bản in đang có trên trang thì ghi một dòng
 * nhật ký hoạt động "xuất PDF" — tên bản in, phụ đề (phạm vi, bộ lọc), số dòng bảng. Trình duyệt không cho biết
 * người dùng in thật hay bấm Huỷ, nên dòng nhật ký là "đã mở bản in".
 */
export type PrintSheetProps = {
  unit?: string | null;
  parentUnit?: string | null;
  title: string;
  subtitle?: ReactNode;
  facts?: { label: string; value: ReactNode }[];
  table?: PrintTable;
  signers?: string[];
  children?: ReactNode;
  /** Tài nguyên ghi vào nhật ký khi in; mặc định là resource của trang. */
  logResource?: string;
};

export function PrintSheet(props: PrintSheetProps) {
  const { title, subtitle, table, logResource } = props;
  const { resource, identifier } = useResourceParams();
  const latest = useRef({ resource: "", detail: "", rows: undefined as number | undefined });
  latest.current = {
    resource: logResource ?? identifier ?? resource?.name ?? window.location.pathname.split("/")[1] ?? "",
    detail: [title, typeof subtitle === "string" ? subtitle : null].filter(Boolean).join(" · "),
    rows: table?.rows.length,
  };
  useEffect(() => {
    const onPrint = () => logExport({ ...latest.current, format: "PDF" });
    window.addEventListener("beforeprint", onPrint);
    return () => window.removeEventListener("beforeprint", onPrint);
  }, []);
  return (
    <div className="hidden print:block">
      <PrintSheetBody {...props} />
    </div>
  );
}

/**
 * Thân bản in (quốc hiệu, tên, bảng, chữ ký) — dùng cho {@link PrintSheet} khi in và cho hộp "Xem báo cáo"
 * ({@link ReportPreviewDialog}) trên màn hình: người xem thấy đúng tờ sẽ in / tải, không phải tải về mới biết.
 */
export function PrintSheetBody({ unit, parentUnit, title, subtitle, facts = [], table, signers = [], children }: PrintSheetProps) {
  const today = new Date();
  return (
    <div className="text-[11pt] leading-snug text-black">
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

/** Nút in — mở hộp thoại in của trình duyệt (in giấy hoặc lưu PDF). */
export function PrintButton({ label = "In / Xuất PDF" }: { label?: string }) {
  return (
    <Button type="button" variant="outline" onClick={() => window.print()}>
      <Printer />
      {label}
    </Button>
  );
}
