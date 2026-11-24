import {
  DoorOpen,
  Landmark,
  PackageSearch,
  School as SchoolIcon,
} from "lucide-react";
import type { ReactNode } from "react";
import { Link } from "react-router";

import { cn } from "@/shared/lib/utils";

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Kiểu của một thẻ trong lưới.
 *
 * <p>Viết thẳng thay vì dùng `Card` vì thẻ ở đây thường PHẢI là một thẻ liên
 * kết: `Card` dựng một `div` và không nhận `asChild`, nên bọc một `Link` bên
 * trong sẽ mất vùng bấm ở phần đệm, còn bọc `Card` trong `Link` thì lồng khối
 * vào dòng.
 */
/*
 * `min-h` chứ không phải chiều cao tự do: nội dung một thẻ chỉ có hai dòng
 * chữ, nên không có trần dưới thì thẻ dẹt như một dòng danh sách và cả lưới
 * đọc ra vẫn là một danh sách. Thẻ phải có KHỐI thì mắt mới lướt theo hàng
 * ngang được, mà đó là điều duy nhất dạng khối làm tốt hơn dạng bảng.
 */
const CARD =
  "bg-card text-card-foreground flex min-h-28 min-w-0 flex-col gap-2 " +
  "rounded-lg border border-border p-4 text-left shadow-e1";
const CARD_LINK = "hover:border-primary/40 hover:shadow-e2 transition-colors";

const num = new Intl.NumberFormat("vi-VN", { useGrouping: false });

/** Một số liệu trên thẻ. Ẩn khi bằng 0 — số 0 lặp lại bốn lần chỉ là nhiễu. */
function Stat({
  icon: Icon,
  value,
  label,
  tone,
}: {
  icon: typeof SchoolIcon;
  value: number;
  label: string;
  tone?: string;
}) {
  if (!value) return null;
  return (
    <span className={cn("flex items-center gap-1", tone)} title={label}>
      <Icon className="size-3.5" />
      <span className="tabular-nums">{num.format(value)}</span>
    </span>
  );
}

export type BodyStats = {
  /** Rỗng ở đúng một dòng: nhóm trường chưa xác định cơ quan quản lý. */
  id: number | null;
  code: string;
  name: string;
  type: string;
  schools: number;
  staff: number;
  rooms: number;
  equipment: number;
};

/** Cùng bảng màu với cây — đổi cách nhìn không được làm đổi ý nghĩa của màu. */
export function bodyTone(type: string) {
  return type === "SO"
    ? "text-destructive"
    : type === "UNASSIGNED"
      ? "text-warning"
      : "text-info";
}

/** Nền nhạt của thẻ, cùng sắc với biểu tượng — thẻ đọc được loại từ xa mà không đổi bố cục. */
function bodyBackground(type: string) {
  return type === "SO"
    ? "bg-destructive-subtle border-destructive/20"
    : type === "UNASSIGNED"
      ? "bg-warning-subtle border-warning/25"
      : "bg-info-subtle border-info/20";
}

/**
 * Dạng KHỐI của màn Tổng quan — mỗi cơ quan quản lý một thẻ.
 *
 * <p>Cây trả lời "cái này nằm dưới cái kia", khối trả lời "có những gì và cái
 * nào lớn". Với 103 cơ quan thì câu thứ hai hay được hỏi hơn, và một cây dọc
 * không trả lời nổi: muốn so số trường giữa hai phường thì phải cuộn qua ba
 * mươi dòng ở giữa.
 *
 * <p>Bấm một thẻ thì MỞ RA TRONG LƯỚI chứ không rời màn hình: khối là để đi
 * xuống từng tầng, và nhảy thẳng sang một danh sách dài là bỏ mất đúng cái
 * tầng người ta vừa mở.
 */
export function BodyGrid({
  bodies,
  onOpen,
  emptyText,
}: {
  bodies: BodyStats[];
  onOpen: (b: BodyStats) => void;
  emptyText: string;
}) {
  if (bodies.length === 0) {
    return <p className="text-muted-foreground p-10 text-center text-sm">{emptyText}</p>;
  }
  return (
    <Grid>
      {bodies.map((b) => (
        <button
          key={b.code}
          type="button"
          onClick={() => onOpen(b)}
          className={cn(CARD, CARD_LINK, bodyBackground(b.type), "cursor-pointer")}
        >
          <div className="flex items-start gap-2">
            <Landmark className={cn("mt-0.5 size-4 shrink-0", bodyTone(b.type))} />
            <span className="min-w-0 flex-1 text-sm leading-snug font-medium">{b.name}</span>
          </div>
          <div className="text-muted-foreground mt-auto flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
            <span className="flex items-center gap-1">
              <SchoolIcon className="size-3.5" />
              <span className="tabular-nums font-medium">{num.format(b.schools)}</span>
              trường
            </span>
            <Stat icon={DoorOpen} value={b.rooms} label="Phòng" />
            <Stat icon={PackageSearch} value={b.equipment} label="Thiết bị" />
          </div>
        </button>
      ))}
    </Grid>
  );
}

/** Dạng khối của các TRƯỜNG — tầng dưới của lưới, và cũng là dạng của kết quả tìm. */
export function SchoolGrid({ schools, emptyText }: { schools: any[]; emptyText: string }) {
  if (schools.length === 0) {
    return <p className="text-muted-foreground p-10 text-center text-sm">{emptyText}</p>;
  }
  // Mọi trường cùng một phường (UBND phường xem trường của mình): dòng phường lặp y nguyên ở mọi thẻ.
  const oneWard = new Set(schools.map((s) => s.ward ?? "")).size <= 1;
  return (
    <Grid>
      {schools.map((s) => (
        // Thẻ trắng như mọi thẻ khác: tên, phường / xã, rồi ba con số người quản lý hay hỏi. Mã nội bộ của trường
        // (THCSBINHANQ2) không nói gì với người đọc nên không hiện.
        <Link key={s.id} to={`/schools/show/${s.id}`} className={cn(CARD, CARD_LINK)}>
          <div className="flex items-start gap-2">
            <SchoolIcon className="text-gold-600 mt-0.5 size-4 shrink-0" />
            <span className="min-w-0 flex-1">
              <span className="block text-sm leading-snug font-medium">{s.name}</span>
              {s.ward && !oneWard ? <span className="text-muted-foreground block truncate text-xs">{s.ward}</span> : null}
            </span>
          </div>
          <div className="text-muted-foreground mt-auto flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
            <Stat icon={DoorOpen} value={s.rooms ?? 0} label="Phòng" />
            <Stat icon={PackageSearch} value={s.equipment ?? 0} label="Thiết bị" />
            {!s.rooms && !s.equipment ? <span className="text-destructive italic">Chưa nhập cơ sở vật chất, thiết bị</span> : null}
          </div>
        </Link>
      ))}
    </Grid>
  );
}

function Grid({ children }: { children: ReactNode }) {
  return (
    <div className="grid gap-3 p-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">{children}</div>
  );
}
