import type { LucideIcon } from "lucide-react";
import { QrCode } from "lucide-react";
import { useRef, type ReactNode } from "react";

import { EquipmentPhoto } from "@/features/organization/resources/equipment-photo";
import { FacilityQr } from "@/features/organization/resources/facility-qr";
import { SLIDE_TRANSITION, trackedStyle, useTrackedBox } from "@/shared/hooks/use-tracked-box";
import { cn } from "@/shared/lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from "@/shared/ui/popover";

/* eslint-disable @typescript-eslint/no-explicit-any */

export type RailSection = { key: string; title: string; icon: LucideIcon; missing?: string[] };
export type RailPanel = { key: string; label: string; icon: LucideIcon };

const ITEM = "relative z-[1] flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm font-medium transition-colors duration-300";

/**
 * Cột trái DÙNG CHUNG của hộp phòng Xem · Sửa · Thêm (mockup "Hộp phòng", trưởng nhóm chốt 13/11/2026): ảnh phòng
 * (đổi ảnh ngay tại đây), mục lục ba nhóm ô (số đỏ = ô bắt buộc còn trống), rồi Thiết bị · Lịch sử sửa chữa · Hồ sơ.
 * Ở Sửa / Thêm (`onPanel` vắng) ba mục dưới mờ đi — chúng là phần xem, không phải ô của form. Bấm Sửa từ hộp Xem thì
 * cột này đứng yên, chỉ thân bên phải thành ô nhập.
 */
export function RoomRail({ recordId, canWrite, sections, active, onSection, panels, panel, onPanel }: {
  recordId?: number;
  canWrite: boolean;
  sections: RailSection[];
  active: string;
  onSection: (key: string) => void;
  panels: RailPanel[];
  /** Mục dưới đang mở (hộp Xem); `"info"` = đang ở các nhóm ô. */
  panel?: string;
  onPanel?: (key: string) => void;
}) {
  // Vệt chọn TRƯỢT giữa các mục kiểu iOS (trưởng nhóm 13/11/2026), cùng chuyển động với hộp hồ sơ cán bộ.
  const navRef = useRef<HTMLElement>(null);
  const current = (panel ?? "info") === "info" ? active : panel;
  const pill = useTrackedBox(navRef, current ? `[data-nav-item="${current}"]` : null);
  return (
    <aside className="bg-muted/40 border-b md:border-r md:border-b-0">
      <div className="flex flex-col gap-4 p-3 md:sticky md:top-0">
        <EquipmentPhoto resource="rooms" noun="phòng" recordId={recordId} canWrite={canWrite} editable={canWrite} rail />
        <nav ref={navRef} aria-label="Các mục của phòng" className="relative flex flex-col gap-1">
          {pill.box ? (
            <span aria-hidden className={cn("bg-primary/10 pointer-events-none absolute top-0 left-0 rounded-lg", pill.animate && SLIDE_TRANSITION)}
              style={trackedStyle(pill.box)} />
          ) : null}
          {sections.map((s) => {
            const gaps = s.missing ?? [];
            const on = (panel ?? "info") === "info" && active === s.key;
            return (
              <button key={s.key} type="button" data-nav-item={s.key} aria-current={on ? "true" : undefined}
                onClick={() => onSection(s.key)}
                title={gaps.length ? `Còn thiếu: ${gaps.join(", ")}` : undefined}
                className={cn(ITEM, on ? "text-primary" : "hover:bg-foreground/[0.04]")}>
                <s.icon className="size-4 shrink-0" />
                <span className="min-w-0 flex-1">{s.title}</span>
                {gaps.length ? (
                  <span className="bg-destructive text-destructive-foreground rounded-full px-1.5 text-[0.6875rem] leading-[1.125rem] tabular-nums">
                    {gaps.length}
                  </span>
                ) : null}
              </button>
            );
          })}
          {panels.map((p) => {
            const on = panel === p.key;
            return (
              <button key={p.key} type="button" data-nav-item={p.key} disabled={!onPanel} aria-current={on ? "true" : undefined}
                onClick={() => onPanel?.(p.key)}
                title={onPanel ? undefined : "Xem ở hộp chi tiết phòng"}
                className={cn(ITEM, on ? "text-primary" : "hover:bg-foreground/[0.04]",
                  "disabled:text-muted-foreground/60 disabled:pointer-events-none")}>
                <p.icon className="size-4 shrink-0" />
                <span className="min-w-0 flex-1">{p.label}</span>
              </button>
            );
          })}
        </nav>
      </div>
    </aside>
  );
}

/** Khung hai cột của hộp phòng: tràn sát mép thân hộp (thân có px-6 py-5) để cột trái là một dải nền liền. */
export function RoomFrame({ rail, children, active, boxRef, onFocusCapture, onClear }: {
  rail: ReactNode;
  children: ReactNode;
  /** Nhóm ô đang chọn — `data-active` cho khung xanh của nhóm (`ROOM_SEC_CLASS`). */
  active: string;
  boxRef?: React.Ref<HTMLDivElement>;
  onFocusCapture?: React.FocusEventHandler<HTMLDivElement>;
  /** Bấm khoảng trống ngoài mọi nhóm ô: bỏ chọn (không còn khung xanh, không còn vệt bên trái). */
  onClear?: () => void;
}) {
  // Khung xanh mờ TRƯỢT tới nhóm ô đang chọn (đổi cả chiều cao), kiểu iOS — thay cho tô nền tĩnh từng nhóm. Đang mở
  // Thiết bị / Lịch sử / Hồ sơ thì không có nhóm ô nào, khung ẩn.
  const paneRef = useRef<HTMLDivElement>(null);
  const frame = useTrackedBox(paneRef, active ? `#room-sec-${active}` : null);
  return (
    <div ref={boxRef} data-active={active} onFocusCapture={onFocusCapture}
      className="group/roomform -mx-6 -mb-5 grid min-h-full first:-mt-5 md:grid-cols-[14rem_minmax(0,1fr)]">
      {rail}
      <div ref={paneRef} className="relative flex min-w-0 flex-col px-6 py-5"
        onClick={(e) => {
          // Bấm khoảng trống ngoài mọi phần thì BỎ chọn (trưởng nhóm 13/11/2026). Chỉ tính bấm trong chính khung — bấm
          // trong ô chọn (portal) không tính.
          const t = e.target as HTMLElement;
          if (e.currentTarget.contains(t) && !t.closest("[id^=room-sec-]")) onClear?.();
        }}>
        {frame.box ? (
          <span aria-hidden
            className={cn("bg-primary/[0.06] ring-primary/40 pointer-events-none absolute top-0 left-0 rounded-xl ring-1", frame.animate && SLIDE_TRANSITION)}
            style={trackedStyle(frame.box)} />
        ) : null}
        {/* Cao kín khung: trang Thiết bị / Lịch sử / Hồ sơ giãn theo, chữ "chưa có" đứng giữa. */}
        <div className="relative flex flex-1 flex-col">{children}</div>
      </div>
    </div>
  );
}

/** Tem QR thu thành một biểu tượng cạnh tên phòng: bấm thì hiện mã QR và nút In tem. */
export function RoomQrButton({ record }: { record: any }) {
  if (!record?.id || !record?.code) return null;
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button type="button" aria-label="Tem QR của phòng" title="Tem QR"
          className="text-muted-foreground hover:text-primary hover:bg-muted flex size-7 items-center justify-center rounded-md transition-colors">
          <QrCode className="size-4" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-auto p-4">
        <FacilityQr record={record} />
      </PopoverContent>
    </Popover>
  );
}
