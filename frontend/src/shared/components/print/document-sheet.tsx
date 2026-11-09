import { useLayoutEffect, useRef, useState, type ReactNode } from "react";

import { cn } from "@/shared/lib/utils";

export type DocumentTable = {
  headers: ReactNode[];
  rows: ReactNode[][];
  /** Dòng cuối in đậm (tổng cộng) — cùng số ô với `headers`. */
  footer?: ReactNode[];
  /** Chỉ số các cột canh phải (số lượng, tiền). */
  alignRight?: number[];
  /** Chỉ số các cột canh giữa (STT, đơn vị tính). */
  alignCenter?: number[];
  /** Chỉ số cột CHỮ DÀI (tên) — nhận nhiều bề ngang nhất. */
  grow?: number;
};

/**
 * Phông của văn bản hành chính. Phải là Times New Roman chứ không phải `font-serif` của Tailwind: chồng
 * phông mặc định rơi về Georgia, phông đó thiếu chữ Việt có dấu tổ hợp nên "Phiếu" vỡ thành "Phiê´u".
 */
const DOCUMENT_FONT = '"Times New Roman", Times, "Liberation Serif", "Nimbus Roman", serif';

/** 1 mm theo px của CSS (96 px / inch). */
const MM = 96 / 25.4;
/** Chiều cao phần chữ của một tờ A4: cao tờ trừ lề trên, dưới 20 mm, chừa 8 mm cho dòng "Trang x / y". */
const pageBody = (landscape: boolean) => ((landscape ? 210 : 297) - 40 - 8) * MM;

/** Tờ A4 đứng trên màn hình, lề theo thể thức văn bản hành chính (trái 30, phải 15, trên dưới 20 mm). */
const SHEET = "box-border w-[210mm] bg-white pt-[20mm] pr-[15mm] pb-[20mm] pl-[30mm] text-[13pt] leading-[1.5] text-black";
/** Tờ A4 nằm ngang — cho văn bản có bảng nhiều cột (biên bản kiểm kê, QLTB-572). */
const SHEET_LANDSCAPE = "box-border w-[297mm] bg-white pt-[20mm] pr-[15mm] pb-[20mm] pl-[25mm] text-[13pt] leading-[1.5] text-black";

type Signer = {
  title: string;
  name?: string | null;
  /** Dòng dưới chức danh. Vắng thì "(Ký, ghi rõ họ tên)" — người ký tay trên giấy. */
  hint?: string;
  /** Dấu vết trên HỆ THỐNG thay cho chữ ký tay: "Đã duyệt lúc 16:25 07/10/2026". */
  stamp?: string | null;
};

/** Một tờ khi chia trang: có phần đầu không, dòng bảng nào, và các khối cuối nào nằm trên tờ này. */
type Page = { intro: boolean; rows: [number, number] | null; tfoot: boolean; extra: boolean; signers: boolean };

/**
 * Một chứng từ trình bày như VĂN BẢN ngay trên màn hình, theo thể thức văn bản hành chính: tờ giấy trắng
 * ĐÚNG khổ A4 (210 × 297 mm, cỡ chữ tính bằng pt) trên nền xám; góc trái là tên đơn vị và số chứng từ, góc phải là
 * quốc hiệu và ngày tháng; tên chứng từ ở giữa; các dòng thông tin; bảng kẻ; khối chữ ký. Là "dạng xem thứ hai" của
 * một phiếu — thứ người ta ký, đóng dấu và lưu hồ sơ — bên cạnh dạng làm việc (bảng, thẻ, nút).
 *
 * <p><b>Chia trang.</b> Trên màn hình văn bản dài được xếp thành nhiều tờ A4 rời: đo chiều cao từng phần (đầu văn
 * bản, từng dòng bảng, khối chữ ký) ở một bản ẩn rồi xếp vào tờ. Bảng sang tờ mới thì lặp lại dòng tiêu đề, độ rộng
 * cột giữ nguyên giữa các tờ; khối chữ ký không bị cắt đôi; cuối tờ có "Trang x / y". Khi IN thì dùng một bản liền
 * và để trình duyệt tự ngắt trang theo khổ giấy của máy in (dòng tiêu đề bảng tự lặp lại) — lề máy in mỗi nơi một
 * khác, chia sẵn theo màn hình sẽ lệch.
 *
 * <p>Giấy luôn trắng chữ đen, kể cả khi giao diện ở chế độ tối: đây là hình của văn bản, không phải của ứng dụng.
 */
export function DocumentSheet({
  unit,
  parentUnit,
  title,
  number,
  date,
  place,
  facts = [],
  table,
  signers = [],
  children,
  className,
  landscape = false,
}: {
  /** Đơn vị lập chứng từ (tên trường). */
  unit?: string | null;
  /** Cơ quan chủ quản, in trên tên đơn vị. */
  parentUnit?: string | null;
  title: string;
  /** Số chứng từ; chưa có thì để chấm cho người ta thấy là chưa cấp. */
  number?: string | null;
  /** Ngày của chứng từ, dạng ISO `yyyy-mm-dd`. */
  date?: string | null;
  /** Địa danh đứng trước ngày tháng ("TP. Hồ Chí Minh, ngày…"); vắng thì chỉ có ngày. */
  place?: string | null;
  /** Các dòng "Nhãn: giá trị" dưới tiêu đề; dòng không có giá trị thì bỏ. `wide` chiếm cả hàng. */
  facts?: { label: string; value: ReactNode; wide?: boolean }[];
  table?: DocumentTable;
  /** Khối chữ ký cuối trang: chức danh và (nếu biết) họ tên người ký. */
  signers?: Signer[];
  children?: ReactNode;
  className?: string;
  /** In khổ A4 nằm ngang: bảng nhiều cột đủ chỗ, không phải bóp cột. */
  landscape?: boolean;
}) {
  const sheet = landscape ? SHEET_LANDSCAPE : SHEET;
  const PAGE_BODY = pageBody(landscape);
  const day = date ? new Date(`${date}T00:00:00`) : null;
  const dateText = day
    ? `ngày ${String(day.getDate()).padStart(2, "0")} tháng ${String(day.getMonth() + 1).padStart(2, "0")} năm ${day.getFullYear()}`
    : "ngày …… tháng …… năm ………";
  const shown = facts.filter((f) => f.value != null && f.value !== "");
  const measureRef = useRef<HTMLDivElement>(null);
  // Ba mức gọn của bảng, chọn bằng cách đo ở bản ẩn (không đoán theo số cột):
  //   0 — cỡ chữ thường, cột ngắn (mã, số, tiền) một dòng;
  //   1 — cột tên bị ép hẹp hơn 35% bề ngang, hoặc bảng tràn: chữ 11pt, ô gọn, cột ngắn vẫn một dòng;
  //   2 — mức 1 vẫn tràn (biên bản kiểm kê: phòng sổ ghi, phòng thực tế, kết quả…): mọi cột được xuống dòng.
  const [density, setDensity] = useState<0 | 1 | 2>(0);
  const dense = density > 0;
  const [layout, setLayout] = useState<{ pages: Page[]; cols: number[] } | null>(null);

  // Đo ở bản ẩn rồi xếp tờ. Chạy lại mỗi lần dựng (nội dung đổi), và sau khi phông Times tải xong (chữ đổi cao).
  useLayoutEffect(() => {
    const run = () => {
      const root = measureRef.current;
      if (!root) return;
      const h = (sel: string) => (root.querySelector(sel) as HTMLElement | null)?.getBoundingClientRect().height ?? 0;
      const intro = h("[data-part=intro]");
      const tablePad = h("[data-part=table-pad]");
      const thead = h("thead");
      const tfoot = h("tfoot");
      const extra = h("[data-part=extra]");
      const sign = h("[data-part=signers]");
      const rows = [...root.querySelectorAll("tbody > tr")].map((r) => r.getBoundingClientRect().height);
      const cols = [...root.querySelectorAll("thead th")].map((c) => c.getBoundingClientRect().width);
      const dataRows = table?.rows.length ?? 0;
      const tableEl = root.querySelector("table");
      const sheetEl = root.firstElementChild as HTMLElement | null;
      if (density < 2 && tableEl && sheetEl && table) {
        // Bề ngang chữ = tờ trừ lề trái, phải (khổ ngang lề trái 25 mm thay vì 30 mm).
        const room = sheetEl.clientWidth - ((landscape ? 25 : 30) + 15) * MM;
        const overflow = tableEl.getBoundingClientRect().width > room + 1;
        const squeezed = table.grow != null && (cols[table.grow] ?? room) < room * 0.35;
        if (overflow || (density === 0 && squeezed)) {
          setDensity(density === 0 ? 1 : 2);
          return;
        }
      }

      const pages: Page[] = [];
      let cur: Page = { intro: true, rows: null, tfoot: false, extra: false, signers: false };
      let used = intro;
      const next = () => {
        pages.push(cur);
        cur = { intro: false, rows: null, tfoot: false, extra: false, signers: false };
        used = 0;
      };
      if (table) {
        // Dòng bảng: hết chỗ thì sang tờ mới, tờ mới lặp lại dòng tiêu đề. "Chưa có dòng nào" là một dòng như mọi dòng.
        const count = Math.max(dataRows, 1);
        if (used + tablePad + thead + (rows[0] ?? 0) > PAGE_BODY) next();
        used += tablePad + thead;
        for (let i = 0; i < count; i++) {
          const rh = rows[i] ?? 0;
          if (cur.rows && used + rh > PAGE_BODY) {
            next();
            used = thead;
          }
          cur.rows = cur.rows ? [cur.rows[0], i + 1] : [i, i + 1];
          used += rh;
        }
        if (table.footer) {
          if (used + tfoot > PAGE_BODY) {
            next();
            used = thead;
          }
          cur.tfoot = true;
          used += tfoot;
        }
      }
      if (children) {
        if (used > 0 && used + extra > PAGE_BODY) next();
        cur.extra = true;
        used += extra;
      }
      if (signers.length) {
        // Khối chữ ký đi nguyên khối: không đủ chỗ thì sang tờ mới, không để chức danh một tờ, họ tên tờ sau.
        if (used > 0 && used + sign > PAGE_BODY) next();
        cur.signers = true;
        used += sign;
      }
      pages.push(cur);
      setLayout((old) => (old && JSON.stringify(old) === JSON.stringify({ pages, cols }) ? old : { pages, cols }));
    };
    run();
    let alive = true;
    document.fonts?.ready.then(() => alive && run());
    return () => {
      alive = false;
    };
  });

  const align = (t: DocumentTable, c: number) =>
    t.alignRight?.includes(c) ? "text-right tabular-nums" : t.alignCenter?.includes(c) ? "text-center" : "text-left";
  const cell = cn("border border-black align-middle break-words", dense ? "px-1.5 py-1.5" : "px-2.5 py-2");
  // Cột chữ dài (tên) xuống dòng; cột ngắn (mã, số, tiền) giữ một dòng — trừ bảng nhiều cột, ở đó mọi cột phải được
  // xuống dòng thì bảng mới vừa bề ngang tờ.
  const wrap = (t: DocumentTable, c: number) => (density === 2 || t.grow === c ? undefined : "whitespace-nowrap");

  const introBlock = (
    <div data-part="intro">
      {/* Thể thức: trái là đơn vị + số chứng từ, phải là quốc hiệu + ngày tháng — hai cột cân nhau. */}
      <header className="grid grid-cols-[minmax(0,5fr)_minmax(0,7fr)] items-start gap-6 text-center leading-snug">
        <div>
          {parentUnit ? <div className="text-[12pt] uppercase">{parentUnit}</div> : null}
          <div className="text-[12pt] font-bold uppercase">{unit ?? ""}</div>
          <div className="mx-auto mt-1.5 h-px w-20 bg-black" />
          <div className="mt-3 text-[12pt]">
            Số: <span className="font-bold">{number || "………………"}</span>
          </div>
        </div>
        <div>
          <div className="text-[12pt] font-bold whitespace-nowrap uppercase">Cộng hoà xã hội chủ nghĩa Việt Nam</div>
          <div className="text-[13pt] font-bold">Độc lập - Tự do - Hạnh phúc</div>
          <div className="mx-auto mt-1.5 h-px w-44 bg-black" />
          <div className="mt-3 text-[13pt] italic first-letter:uppercase">{place ? `${place}, ${dateText}` : dateText}</div>
        </div>
      </header>

      <h2 className="mt-10 text-center text-[15pt] leading-tight font-bold tracking-wide uppercase">{title}</h2>

      {shown.length ? (
        <dl className="mt-7 grid grid-cols-2 gap-x-10 gap-y-1.5">
          {shown.map((f) => (
            <div key={f.label} className={cn("flex items-baseline gap-2", f.wide && "col-span-2")}>
              <dt className="shrink-0">{f.label}:</dt>
              <dd className="min-w-0 font-bold">{f.value}</dd>
            </div>
          ))}
        </dl>
      ) : null}
    </div>
  );

  /** Bảng của một tờ: các dòng [from, to); `cols` = độ rộng cột đã đo, để mọi tờ thẳng cột với nhau. */
  const tableBlock = (t: DocumentTable, range: [number, number] | null, withFoot: boolean, cols?: number[]) => (
    <table
      className={cn("w-full border-collapse leading-snug", dense ? "text-[11pt]" : "text-[12pt]", cols && "table-fixed")}
    >
      {cols ? (
        <colgroup>
          {cols.map((w, i) => <col key={i} style={{ width: w }} />)}
        </colgroup>
      ) : null}
      <thead>
        <tr>
          {t.headers.map((hd, i) => (
            <th key={i} className={cn(cell, "text-center font-bold", wrap(t, i), i === t.grow && !cols ? "w-full" : undefined)}>{hd}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {(range ? t.rows.slice(range[0], range[1]) : t.rows).map((row, r) => (
          <tr key={r}>
            {row.map((v, c) => (
              <td key={c} className={cn(cell, align(t, c), wrap(t, c))}>{v}</td>
            ))}
          </tr>
        ))}
        {t.rows.length === 0 && (!range || range[0] === 0) ? (
          <tr>
            <td colSpan={t.headers.length} className={cn(cell, "py-4 text-center italic")}>Chưa có dòng nào</td>
          </tr>
        ) : null}
      </tbody>
      {t.footer && withFoot ? (
        <tfoot>
          <tr>
            {t.footer.map((v, c) => (
              <td key={c} className={cn(cell, "font-bold", align(t, c), wrap(t, c))}>{v}</td>
            ))}
          </tr>
        </tfoot>
      ) : null}
    </table>
  );

  const signersBlock = signers.length ? (
    // Ba hàng thẳng nhau ở mọi cột: chức danh · chỗ ký · họ tên. Lưới theo HÀNG nên chức danh dài
    // ("Thủ trưởng đơn vị") không đẩy lệch dòng "(Ký, ghi rõ họ tên)" và họ tên của các cột bên cạnh.
    <div data-part="signers" className="pt-12 break-inside-avoid">
      <footer
        className="grid grid-flow-col gap-x-3 text-center"
        style={{ gridTemplateColumns: `repeat(${signers.length}, minmax(0, 1fr))`, gridTemplateRows: "auto auto 5rem auto" }}
      >
        {signers.map((s) => (
          <div key={s.title} className="contents">
            {/* Chức danh một dòng: cỡ nhỏ hơn thân văn bản và không xuống dòng, các cột vẫn thẳng hàng. */}
            <div className="text-[11pt] leading-snug font-bold tracking-tight whitespace-nowrap uppercase">{s.title}</div>
            <div className="text-[10.5pt] italic">{s.hint ?? "(Ký, ghi rõ họ tên)"}</div>
            {/* Người đã làm việc đó TRÊN HỆ THỐNG không ký tay: chỗ ký là dấu xác nhận kèm thời điểm. */}
            <div className="flex items-center justify-center">
              {s.stamp ? (
                <span className="rounded-sm border border-black/70 px-2 py-1 text-[9.5pt] leading-tight">{s.stamp}</span>
              ) : null}
            </div>
            <div className="leading-snug font-bold">{s.name ?? ""}</div>
          </div>
        ))}
      </footer>
    </div>
  ) : null;

  const pages = layout?.pages;
  const total = pages?.length ?? 1;

  return (
    // Nền xám cuộn ngang khi màn hẹp hơn tờ giấy — tờ A4 giữ đúng khổ chứ không co lại theo cột.
    <div className={cn("bg-foreground/10 overflow-x-auto rounded-lg p-4 sm:p-6 print:overflow-visible print:bg-transparent print:p-0", className)}>
      {/* Bản đo: liền một khối, ẩn, đúng bề ngang chữ của tờ — chỉ để lấy chiều cao từng phần. */}
      <div ref={measureRef} aria-hidden className="pointer-events-none invisible absolute top-0 left-[-10000px] print:hidden">
        <div style={{ fontFamily: DOCUMENT_FONT }} className={sheet}>
          {introBlock}
          {table ? (
            <>
              <div data-part="table-pad" className="h-6" />
              {tableBlock(table, null, true)}
            </>
          ) : null}
          {children ? <div data-part="extra">{children}</div> : null}
          {signersBlock}
        </div>
      </div>

      {/* Màn hình: các tờ A4 rời, mỗi tờ cao đúng 297 mm. */}
      <div className="flex flex-col items-center gap-6 print:hidden">
        {(pages ?? [{ intro: true, rows: null, tfoot: true, extra: true, signers: true }]).map((p, i) => (
          <article
            key={i}
            style={{ fontFamily: DOCUMENT_FONT }}
            className={cn(sheet, "shadow-e2 relative overflow-hidden", landscape ? "h-[210mm]" : "h-[297mm]")}
          >
            {p.intro ? introBlock : null}
            {table && p.rows ? (
              <div className={p.intro ? "mt-6" : undefined}>{tableBlock(table, p.rows, p.tfoot, layout?.cols)}</div>
            ) : null}
            {p.extra ? children : null}
            {p.signers ? signersBlock : null}
            {total > 1 ? (
              <div className="absolute inset-x-0 bottom-[10mm] text-center text-[10.5pt] italic">
                Trang {i + 1} / {total}
              </div>
            ) : null}
          </article>
        ))}
      </div>

      {/* In: một bản liền, trình duyệt tự ngắt trang theo khổ giấy (dòng tiêu đề bảng tự lặp lại). */}
      {/* Khổ ngang khi in: chỉ đè `@page` lúc văn bản này đang mở. */}
      {landscape ? <style>{"@media print { @page { size: A4 landscape; } }"}</style> : null}
      <article style={{ fontFamily: DOCUMENT_FONT }} className="hidden text-[13pt] leading-[1.5] text-black print:block">
        {introBlock}
        {table ? <div className="mt-6">{tableBlock(table, null, true)}</div> : null}
        {children}
        {signersBlock}
      </article>
    </div>
  );
}
