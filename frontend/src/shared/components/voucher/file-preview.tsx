import { ChevronDown, ChevronUp, Download, FileQuestion, Loader2, Search } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import { Button } from "@/shared/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/shared/ui/dialog";
import { Input } from "@/shared/ui/input";

export type PreviewSource = { name: string; type?: string | null; blob: Blob };

type Kind = "image" | "pdf" | "text" | "docx" | "none";

function kindOf(name: string, type?: string | null): Kind {
  const t = type ?? "";
  if (t.startsWith("image/")) return "image";
  if (t === "application/pdf" || /\.pdf$/i.test(name)) return "pdf";
  if (/\.docx$/i.test(name) || t === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") return "docx";
  if (t.startsWith("text/") || /\.(txt|csv|json|md|log)$/i.test(name)) return "text";
  return "none";
}

/** Tệp này xem ngay trong ứng dụng được không (ảnh, PDF, Word .docx, văn bản thuần). */
// eslint-disable-next-line react-refresh/only-export-components
export function previewable(name: string, type?: string | null) {
  return kindOf(name, type) !== "none";
}

/**
 * Gỡ những gì trong một tệp Word có thể chạy mã trong trang: tệp đính kèm do người khác tải lên, và trang
 * đang giữ token đăng nhập. `renderAltChunks: false` đã chặn khối HTML nhúng (docx-preview dựng nó thành
 * `<iframe srcdoc>` cùng origin); đây là lớp thứ hai cho liên kết `javascript:` và thuộc tính `on*`.
 */
function sanitizeDocx(root: HTMLElement) {
  root.querySelectorAll("script, iframe, object, embed, form").forEach((el) => el.remove());
  root.querySelectorAll<HTMLElement>("*").forEach((el) => {
    for (const attr of [...el.attributes]) {
      if (attr.name.toLowerCase().startsWith("on")) el.removeAttribute(attr.name);
    }
  });
  root.querySelectorAll("a[href]").forEach((a) => {
    const href = (a.getAttribute("href") ?? "").trim();
    if (!/^(https?:|mailto:|#)/i.test(href)) a.removeAttribute("href");
    else if (!href.startsWith("#")) {
      a.setAttribute("target", "_blank");
      a.setAttribute("rel", "noopener noreferrer");
    }
  });
}

/** Cao ngoài của một phần tử, tính cả lề trên / dưới (lề âm của header / footer làm nó gần 0). */
function outerHeight(el: Element | null) {
  if (!(el instanceof HTMLElement)) return 0;
  const s = getComputedStyle(el);
  return Math.max(0, el.offsetHeight + parseFloat(s.marginTop) + parseFloat(s.marginBottom));
}

type Unit = { el: HTMLElement; table?: HTMLTableElement; top: number; bottom: number };

/**
 * `docx-preview` chỉ ngắt trang ở chỗ tệp Word ghi ngắt trang — tệp do máy sinh ra (không có
 * `lastRenderedPageBreak`) thành MỘT trang dài vô tận. Ở đây chia lại theo chiều cao giấy: đo từng
 * khối của trang, khối nào tràn thì dời sang trang mới (mang theo header / footer của trang gốc).
 * Bảng dài được cắt theo DÒNG, phần sau là một bảng tiếp nối cùng định dạng. Đo bằng `offset*`, không
 * `getBoundingClientRect`, vì hộp thoại đang phóng to khi mở (transform làm sai số đo).
 */
function paginateDocx(root: HTMLElement) {
  for (const page of [...root.querySelectorAll<HTMLElement>(":scope > section.docx")]) {
    const articles = page.querySelectorAll<HTMLElement>(":scope > article");
    // Trang ghép nhiều phần (nhiều cột / nhiều section) hiếm gặp — để nguyên.
    if (articles.length !== 1) continue;
    const article = articles[0];
    const s = getComputedStyle(page);
    const pageHeight = parseFloat(s.minHeight);
    if (!pageHeight || page.scrollHeight <= pageHeight + 1) continue;
    const header = page.querySelector(":scope > header");
    const footer = page.querySelector(":scope > footer");
    const avail = pageHeight - parseFloat(s.paddingTop) - parseFloat(s.paddingBottom) - outerHeight(header) - outerHeight(footer);
    if (avail <= 0) continue;

    // Đơn vị để xếp: mỗi khối con của trang, riêng bảng thì từng dòng.
    const units: Unit[] = [];
    for (const child of [...article.children] as HTMLElement[]) {
      if (child instanceof HTMLTableElement && child.rows.length > 1) {
        for (const tr of [...child.rows]) {
          const top = child.offsetTop + tr.offsetTop;
          units.push({ el: tr, table: child, top, bottom: top + tr.offsetHeight });
        }
      } else {
        units.push({ el: child, top: child.offsetTop, bottom: child.offsetTop + child.offsetHeight });
      }
    }
    const pages: Unit[][] = [[]];
    let start = units[0]?.top ?? 0;
    for (const u of units) {
      const current = pages[pages.length - 1];
      if (current.length && u.bottom - start > avail) {
        pages.push([u]);
        start = u.top;
      } else current.push(u);
    }
    if (pages.length < 2) continue;

    let anchor: HTMLElement = page;
    for (const units of pages.slice(1)) {
      const next = page.cloneNode(false) as HTMLElement;
      const body = article.cloneNode(false) as HTMLElement;
      if (header) next.appendChild(header.cloneNode(true));
      next.appendChild(body);
      if (footer) next.appendChild(footer.cloneNode(true));
      // Bảng tiếp nối đang mở trên trang này, theo bảng gốc.
      let open = null as { source: HTMLTableElement; body: HTMLElement } | null;
      for (const u of units) {
        if (!u.table) {
          open = null;
          body.appendChild(u.el);
          continue;
        }
        if (open?.source !== u.table) {
          const table = u.table.cloneNode(false) as HTMLTableElement;
          const cols = u.table.querySelector(":scope > colgroup");
          if (cols) table.appendChild(cols.cloneNode(true));
          const section = (u.el.parentElement ?? u.table).cloneNode(false) as HTMLElement;
          table.appendChild(section);
          body.appendChild(table);
          open = { source: u.table, body: section };
        }
        open.body.appendChild(u.el);
      }
      anchor.after(next);
      anchor = next;
    }
  }
}

/** Thân bản xem trước của tệp Word: `docx-preview` chỉ tải về khi thật sự có người mở một tệp .docx. */
function DocxBody({ blob, onReady }: { blob: Blob; onReady: () => void }) {
  const host = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  useEffect(() => {
    let alive = true;
    setState("loading");
    void (async () => {
      try {
        const { renderAsync } = await import("docx-preview");
        if (!alive || !host.current) return;
        host.current.innerHTML = "";
        // Không dùng lớp bọc của docx-preview: CSS của nó không nằm trong layer nên đè mọi class
        // Tailwind (nền xám, lề 30px). Trang tự trình bày ở lớp `host` bên dưới.
        await renderAsync(blob, host.current, undefined, {
          inWrapper: false,
          ignoreLastRenderedPageBreak: false,
          renderAltChunks: false,
        });
        await document.fonts.ready;
        if (!alive || !host.current) return;
        paginateDocx(host.current);
        sanitizeDocx(host.current);
        if (alive) {
          setState("ready");
          onReady();
        }
      } catch {
        if (alive) setState("error");
      }
    })();
    return () => {
      alive = false;
    };
  }, [blob, onReady]);
  return (
    <>
      {state === "loading" ? <p className="text-muted-foreground flex items-center gap-2 p-6 text-sm"><Loader2 className="size-4 animate-spin" />Đang mở tệp…</p> : null}
      {state === "error" ? <p className="text-muted-foreground p-6 text-sm">Không đọc được tệp Word này. Tải về để xem.</p> : null}
      {/* Trang Word luôn nền trắng chữ đen, kể cả khi giao diện đang ở chế độ tối. */}
      {/* Nền xám quanh trang là của khung cuộn bên ngoài (`FilePreviewDialog`); ở đây chỉ xếp các trang giấy cách nhau như trình xem tài liệu. */}
      <div
        ref={host}
        className="flex w-max min-w-full flex-col items-center gap-5 px-4 py-6 text-black [&>section.docx]:shrink-0 [&>section.docx]:rounded-xs [&>section.docx]:bg-white [&>section.docx]:shadow-e2"
      />
    </>
  );
}

/** Tên hai lớp tô của ô tìm — khai màu ở `styles/index.css` (`::highlight(...)`). */
const HIT = "preview-hit";
const HIT_ACTIVE = "preview-hit-active";
/** Trình duyệt có CSS Custom Highlight API thì mới có ô tìm; không thì vẫn còn Ctrl+F của trình duyệt. */
const canHighlight = typeof CSS !== "undefined" && "highlights" in CSS && typeof Highlight !== "undefined";
const MAX_HITS = 2000;

/** Bỏ dấu, viết thường TỪNG KÝ TỰ (giữ nguyên độ dài, để vị trí khớp trong chuỗi gập vẫn là vị trí trong tài liệu). */
const foldChar = (c: string) => (c === "đ" || c === "Đ" ? "d" : c.normalize("NFD")[0].toLowerCase());
const fold = (text: string) => Array.from({ length: text.length }, (_, i) => foldChar(text[i])).join("");

/**
 * Tìm `term` trong chữ của `root`, không phân biệt hoa thường và dấu ("thiet bi" ra "thiết bị"). Word
 * cắt một câu thành nhiều đoạn chữ liền nhau, nên ghép chữ của mọi nút lại rồi mới tìm — một chỗ khớp
 * có thể bắt đầu ở nút này và kết thúc ở nút sau. Giữa hai đoạn văn chèn dấu xuống dòng để chữ cuối
 * đoạn trên không dính vào chữ đầu đoạn dưới.
 */
function findRanges(root: HTMLElement, term: string): Range[] {
  const needle = fold(term.trim());
  if (!needle) return [];
  const nodes: { node: Text; start: number }[] = [];
  let hay = "";
  let block: Element | null = null;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    const text = n as Text;
    if (!text.data || text.parentElement?.closest("style")) continue;
    const owner = text.parentElement?.closest("p, td, th, li, pre") ?? null;
    if (owner !== block && hay) hay += "\n";
    block = owner;
    nodes.push({ node: text, start: hay.length });
    hay += fold(text.data);
  }
  const at = (pos: number) => {
    let lo = 0;
    let hi = nodes.length - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (nodes[mid].start <= pos) lo = mid;
      else hi = mid - 1;
    }
    return nodes[lo];
  };
  const out: Range[] = [];
  for (let i = hay.indexOf(needle); i !== -1 && out.length < MAX_HITS; i = hay.indexOf(needle, i + needle.length)) {
    const from = at(i);
    const to = at(i + needle.length - 1);
    const range = document.createRange();
    range.setStart(from.node, Math.min(i - from.start, from.node.length));
    range.setEnd(to.node, Math.min(i + needle.length - to.start, to.node.length));
    out.push(range);
  }
  return out;
}

/**
 * Xem trước một tệp NGAY trong ứng dụng — ảnh, PDF, Word (.docx), văn bản thuần — cho cả tệp vừa chọn
 * trên form (chưa tải lên) lẫn tệp đã lưu. Loại khác (Excel, nén…) không xem được ở đây: nói thẳng
 * và cho tải về. Word và văn bản thuần có ô TÌM trên thanh tiêu đề; PDF dùng ô tìm của chính khung xem.
 */
export function FilePreviewDialog({ source, onClose }: { source: PreviewSource | null; onClose: () => void }) {
  const [url, setUrl] = useState<string | null>(null);
  const [text, setText] = useState<string | null>(null);
  const kind = source ? kindOf(source.name, source.type) : "none";

  useEffect(() => {
    if (!source) return;
    setText(null);
    const type = kind === "pdf" ? "application/pdf" : source.blob.type || source.type || "";
    const u = URL.createObjectURL(type ? new Blob([source.blob], { type }) : source.blob);
    setUrl(u);
    if (kind === "text") void source.blob.text().then((t) => setText(t.slice(0, 200_000)));
    return () => URL.revokeObjectURL(u);
  }, [source, kind]);

  // --- Tìm trong tài liệu (Word, văn bản thuần): tô mọi chỗ khớp, Enter / mũi tên đi tới chỗ kế tiếp.
  const searchable = canHighlight && (kind === "docx" || kind === "text");
  const body = useRef<HTMLDivElement>(null);
  const searchBox = useRef<HTMLInputElement>(null);
  const [term, setTerm] = useState("");
  const [hits, setHits] = useState<Range[]>([]);
  const [active, setActive] = useState(0);
  // Tăng mỗi khi nội dung dựng xong (Word dựng bất đồng bộ) — để tìm lại trên nội dung mới.
  const [rendered, setRendered] = useState(0);
  const onReady = useCallback(() => setRendered((n) => n + 1), []);

  useEffect(() => {
    setTerm("");
  }, [source]);

  useEffect(() => {
    if (!searchable || !body.current || !term.trim()) {
      setHits([]);
      return;
    }
    const root = body.current;
    // Chờ ngừng gõ: tài liệu vài trăm trang thì mỗi phím một lượt quét là giật.
    const t = setTimeout(() => {
      setHits(findRanges(root, term));
      setActive(0);
    }, 200);
    return () => clearTimeout(t);
  }, [searchable, term, rendered, text]);

  useEffect(() => {
    if (!canHighlight) return;
    CSS.highlights.delete(HIT);
    CSS.highlights.delete(HIT_ACTIVE);
    if (!hits.length) return;
    const current = hits[Math.min(active, hits.length - 1)];
    CSS.highlights.set(HIT, new Highlight(...hits));
    CSS.highlights.set(HIT_ACTIVE, new Highlight(current));
    current.startContainer.parentElement?.scrollIntoView({ block: "center", behavior: "smooth" });
    return () => {
      CSS.highlights.delete(HIT);
      CSS.highlights.delete(HIT_ACTIVE);
    };
  }, [hits, active]);

  const step = (by: number) => {
    if (hits.length) setActive((i) => (i + by + hits.length) % hits.length);
  };

  const download = () => {
    if (!url || !source) return;
    Object.assign(document.createElement("a"), { href: url, download: source.name }).click();
  };

  return (
    <Dialog open={source !== null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent size="auto"
        className="flex h-[88dvh] max-w-[calc(100%-2rem)] flex-col gap-0 p-0 sm:max-w-5xl"
        // Ctrl+F trong hộp này đưa con trỏ vào ô tìm của tài liệu thay vì mở ô tìm của trình duyệt.
        onKeyDown={(e) => {
          if (searchable && (e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "f") {
            e.preventDefault();
            searchBox.current?.focus();
            searchBox.current?.select();
          }
        }}
      >
        <DialogHeader className="flex-row items-center gap-3 border-b py-3 ps-4 pe-12">
          <DialogTitle className="min-w-0 flex-1 truncate text-base">{source?.name}</DialogTitle>
          <DialogDescription className="sr-only">Xem trước tệp đính kèm</DialogDescription>
          {searchable ? (
            <div className="flex shrink-0 items-center gap-1">
              <div className="relative w-56">
                <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2" />
                <Input
                  ref={searchBox}
                  value={term}
                  onChange={(e) => setTerm(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      step(e.shiftKey ? -1 : 1);
                    }
                  }}
                  placeholder="Tìm trong tài liệu…"
                  aria-label="Tìm trong tài liệu"
                  className="h-8 ps-8 pe-14"
                />
                {term.trim() ? (
                  <span className={`absolute top-1/2 right-2.5 -translate-y-1/2 text-xs tabular-nums ${hits.length ? "text-muted-foreground" : "text-destructive-text"}`}>
                    {hits.length ? `${Math.min(active, hits.length - 1) + 1}/${hits.length}${hits.length >= MAX_HITS ? "+" : ""}` : "0"}
                  </span>
                ) : null}
              </div>
              <Button type="button" variant="ghost" size="icon-sm" disabled={!hits.length} onClick={() => step(-1)} aria-label="Chỗ khớp trước">
                <ChevronUp />
              </Button>
              <Button type="button" variant="ghost" size="icon-sm" disabled={!hits.length} onClick={() => step(1)} aria-label="Chỗ khớp kế tiếp">
                <ChevronDown />
              </Button>
            </div>
          ) : null}
          <Button type="button" variant="outline" size="sm" onClick={download}>
            <Download />
            Tải về
          </Button>
        </DialogHeader>
        {/* Nền XÁM rõ như trình xem tài liệu: `bg-muted` gần như trắng, trang giấy trắng chìm vào nó. */}
        <div ref={body} className="scrollbar-fade bg-foreground/15 min-h-0 flex-1 overflow-auto">
          {!source || !url ? null : kind === "image" ? (
            <div className="flex min-h-full items-center justify-center p-4">
              <img src={url} alt={source.name} className="max-h-full max-w-full rounded-md object-contain" />
            </div>
          ) : kind === "pdf" ? (
            <iframe src={url} title={source.name} className="size-full border-0" />
          ) : kind === "docx" ? (
            <DocxBody blob={source.blob} onReady={onReady} />
          ) : kind === "text" ? (
            // Văn bản thuần trình bày như một trang giấy giữa nền xám (cùng kiểu trang Word), không phải một ô trắng sát mép.
            <div className="px-4 py-6 sm:px-8">
              <pre className="bg-card text-foreground shadow-e2 mx-auto min-h-[calc(88dvh-9rem)] max-w-3xl rounded-sm px-8 py-10 font-mono text-[0.8125rem] leading-6 break-words whitespace-pre-wrap sm:px-14">
                {text ?? <span className="text-muted-foreground font-sans">Đang mở tệp…</span>}
              </pre>
            </div>
          ) : (
            <div className="text-muted-foreground flex min-h-full flex-col items-center justify-center gap-3 p-6 text-center text-sm">
              <FileQuestion className="size-8" />
              <p>Loại tệp này không xem trước được trong trình duyệt. Tải về để mở.</p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
