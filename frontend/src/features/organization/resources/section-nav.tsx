import type { LucideIcon } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import { useFormState, type Control } from "react-hook-form";

import { SLIDE_TRANSITION as SLIDE, trackedStyle, useTrackedBox as useTracked } from "@/shared/hooks/use-tracked-box";
import { cn } from "@/shared/lib/utils";

/* eslint-disable @typescript-eslint/no-explicit-any */

export type NavSection = {
  key: string;
  title: string;
  icon: LucideIcon;
  /** Ô bắt buộc còn trống của phần này — số đỏ cạnh tên mục, rê chuột xem tên ô. */
  missing?: string[];
};

const keyOf = (el: Element | null | undefined) => el?.closest("[data-nav-section]")?.getAttribute("data-nav-section");

/** Bấm Lưu còn lỗi: khung chuyển tới phần có ô lỗi đầu tiên. Tách riêng vì hộp XEM không có form. */
function JumpToError({ control, box, onJump }: { control: Control<any>; box: RefObject<HTMLDivElement | null>; onJump: (k: string) => void }) {
  const { submitCount } = useFormState({ control });
  useEffect(() => {
    if (!submitCount) return;
    const t = setTimeout(() => {
      const key = keyOf(box.current?.querySelector("[aria-invalid=true]"));
      if (key) onJump(key);
    }, 0);
    return () => clearTimeout(t);
  }, [submitCount, box, onJump]);
  return null;
}

/**
 * Hộp Thêm / Sửa / Xem có cột mục bên trái (kiểu form phòng, mockup A / D1 — trưởng nhóm 12/11/2026): mọi phần cùng
 * hiện; phần đang chọn có MỘT khung xanh mờ TRƯỢT tới nó (đổi cả chiều cao), vệt chọn ở cột trái cũng trượt theo.
 * Bấm mục là cuộn tới phần đó, bấm / Tab vào một ô thì mục tự chuyển theo; bấm Lưu còn lỗi thì khung chuyển tới phần
 * có ô lỗi đầu tiên. Mỗi phần bọc trong `NavSectionBox` cùng `key`. `control` vắng = hộp XEM (chỉ đọc).
 */
export function SectionFormNav({ control, sections, pages, children }: {
  control?: Control<any>;
  sections: NavSection[];
  /**
   * Trang riêng ở cuối cột mục (lịch sử — trưởng nhóm 13/11/2026): chọn thì khung phải chỉ còn nội dung của trang đó
   * (hộp giữ nguyên cỡ), chọn lại một phần là về hồ sơ.
   */
  pages?: { key: string; title: string; icon: LucideIcon; content: ReactNode }[];
  children: ReactNode;
}) {
  // Không chọn sẵn mục nào; bấm lại mục đang chọn / bấm chỗ trống là bỏ chọn (trưởng nhóm 13/11/2026).
  const [active, setActive] = useState("");
  const page = pages?.find((p) => p.key === active);
  const boxRef = useRef<HTMLDivElement>(null);
  const navRef = useRef<HTMLElement>(null);
  const paneRef = useRef<HTMLDivElement>(null);
  const pill = useTracked(navRef, active ? `[data-nav-item="${active}"]` : null);
  const frame = useTracked(paneRef, page || !active ? null : `[data-nav-section="${active}"]`);

  const item = (key: string, icon: LucideIcon, title: string, onClick: () => void, extra?: ReactNode, hint?: string) => {
    const Icon = icon;
    return (
      <button key={key} type="button" data-nav-item={key} aria-current={active === key ? "true" : undefined}
        onClick={onClick} title={hint}
        className={cn("relative z-[1] flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-left text-sm font-medium transition-colors duration-300",
          active === key ? "text-primary" : "hover:bg-foreground/[0.04]")}>
        <Icon className="size-4 shrink-0" />
        <span className="min-w-0 flex-1">{title}</span>
        {extra}
      </button>
    );
  };

  return (
    <>
      {control ? <JumpToError control={control} box={boxRef} onJump={setActive} /> : null}
      {/* Tràn sát mép thân hộp (thân có px-6 py-5): cột mục là một dải nền liền từ trên xuống dưới. */}
      <div ref={boxRef} className="-mx-6 -mb-5 grid min-h-full first:-mt-5 md:grid-cols-[13rem_minmax(0,1fr)]"
        onFocusCapture={(e) => {
          const key = keyOf(e.target as HTMLElement);
          if (key && key !== active) setActive(key);
        }}>
        <aside className="bg-muted/40 border-b md:border-r md:border-b-0">
          <nav ref={navRef} aria-label="Các mục" className="relative flex flex-col gap-1 p-3 md:sticky md:top-0">
            {/* Vệt chọn trượt giữa các mục. */}
            {pill.box ? (
              <span aria-hidden className={cn("bg-primary/10 pointer-events-none absolute top-0 left-0 rounded-lg", pill.animate && SLIDE)}
                style={trackedStyle(pill.box)} />
            ) : null}
            {sections.map((s) => {
              const gaps = s.missing ?? [];
              return item(s.key, s.icon, s.title, () => {
                if (s.key === active) return setActive("");
                const wasPage = !!page;
                setActive(s.key);
                // Đang ở trang riêng: đổi về hồ sơ trước, cuộn sau khi các phần đã hiện lại.
                setTimeout(() => boxRef.current?.querySelector(`[data-nav-section="${s.key}"]`)
                  ?.scrollIntoView({ behavior: wasPage ? "auto" : "smooth", block: "nearest" }), 0);
              }, gaps.length ? (
                <span className="bg-destructive text-destructive-foreground rounded-full px-1.5 text-[0.6875rem] leading-[1.125rem] tabular-nums">
                  {gaps.length}
                </span>
              ) : null, gaps.length ? `Còn thiếu: ${gaps.join(", ")}` : undefined);
            })}
            {pages?.map((p) => item(p.key, p.icon, p.title, () => setActive(p.key === active ? "" : p.key)))}
          </nav>
        </aside>
        {/* Hồ sơ GIỮ CHỖ (ẩn bằng `invisible`) và quyết định chiều cao; trang riêng phủ lên đúng khung đó, dài thì cuộn
            bên trong — chuyển sang Lịch sử hộp không co lại, hồ sơ cũng không thừa khoảng trắng (trưởng nhóm 13/11/2026). */}
        <div ref={paneRef} className="relative min-w-0"
          onClick={(e) => {
            // Bấm khoảng trống ngoài mọi phần thì BỎ chọn (trưởng nhóm 13/11/2026). Chỉ tính bấm trong chính khung — bấm
            // trong ô chọn (portal) không tính.
            const t = e.target as HTMLElement;
            if (e.currentTarget.contains(t) && !t.closest("[data-nav-section]")) setActive("");
          }}>
          {/* Khung xanh mờ trượt tới phần đang chọn, đổi cả chiều cao theo phần đó. */}
          {frame.box ? (
            <span aria-hidden
              className={cn("bg-primary/[0.06] ring-primary/40 pointer-events-none absolute top-0 left-0 rounded-xl ring-1", frame.animate && SLIDE)}
              style={trackedStyle(frame.box)} />
          ) : null}
          <div aria-hidden={page ? true : undefined} className={cn("relative min-w-0 space-y-3 px-6 py-5", page && "invisible")}>
            {children}
          </div>
          {page ? (
            <div className="absolute inset-0 min-w-0 overflow-y-auto px-6 py-5">
              <h3 className="mb-4 text-[0.9375rem] font-semibold">{page.title}</h3>
              {page.content}
            </div>
          ) : null}
        </div>
      </div>
    </>
  );
}

/** Một phần của form trong `SectionFormNav`: tiêu đề + lưới ô. Khung xanh của phần đang chọn do `SectionFormNav` vẽ. */
export function NavSectionBox({ k, title, children, cols = 2 }: { k: string; title: string; children: ReactNode; cols?: 2 | 3 }) {
  return (
    <section data-nav-section={k} className="-mx-3 scroll-mt-3 rounded-xl px-3 py-3">
      <h3 className="mb-3 text-[0.9375rem] font-semibold">{title}</h3>
      <div className={cn("grid items-start gap-x-4 gap-y-5 sm:grid-cols-2", cols === 3 && "lg:grid-cols-3")}>{children}</div>
    </section>
  );
}

/** Ô bắt buộc còn trống: chỉ viền đỏ trên chính ô nhập / ô chọn, không tô nền (như form phòng). */
export function NeedBox({ on, className, children }: { on: boolean; className?: string; children: ReactNode }) {
  return (
    <div className={cn("min-w-0", className, on && [
      "[&_input:not([type=checkbox])]:border-destructive",
      "[&_[data-slot=select-trigger]]:border-destructive",
      "[&_button[role=combobox]]:border-destructive",
    ])}>
      {children}
    </div>
  );
}
