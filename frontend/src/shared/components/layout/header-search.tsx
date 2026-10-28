import { useNavigation, type TreeMenuItem } from "@refinedev/core";
import { useQuery } from "@tanstack/react-query";
import { Building2, ClipboardList, DoorOpen, FileInput, Loader2, Package, SearchIcon, School, UserRound } from "lucide-react";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useNavigate } from "react-router";

import { kyInstance } from "@/shared/api/data";
import { getAuthorities } from "@/shared/api/session";
import { useVisibleMenuItems } from "@/shared/components/layout/sidebar";
import { cn } from "@/shared/lib/utils";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/shared/ui/command";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/shared/ui/dialog";

/* eslint-disable @typescript-eslint/no-explicit-any */

/** Bỏ dấu, chữ thường — gõ "thiet bi" hay "Thiết bị" đều khớp. */
const fold = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/g, "d").replace(/Đ/g, "D").toLowerCase();

type Screen = { key: string; label: string; group: string; route: string; icon?: ReactNode };

/** Mọi màn mở được trong menu, nhóm theo mục gốc của menu (như bảng lệnh cũ). */
function flatten(items: TreeMenuItem[], group?: string): Screen[] {
  return items.flatMap((item) => {
    const label = String(item.meta?.label ?? item.label ?? item.name);
    const children = (item.children ?? []) as TreeMenuItem[];
    const g = group ?? label;
    const own: Screen[] = item.route
      ? [{ key: `${item.key ?? item.name}-${item.route}`, label, group: g, route: item.route, icon: item.meta?.icon ?? item.icon }]
      : [];
    return [...own, ...flatten(children, g)];
  });
}

/**
 * Loại dữ liệu tìm được — mỗi loại một danh sách sẵn có của API với `q` (máy chủ đã tìm không phân biệt
 * dấu). Chỉ hỏi loại tài khoản có quyền đọc, nên không có 403 và không gợi ý thứ không mở được.
 */
const SOURCES: {
  resource: string;
  /** Tài nguyên mở khi chọn, và mã quyền đọc — bảng chi tiết thiết bị đọc `equipment_items` nhưng quyền và
   *  hồ sơ là của `equipment`. */
  open?: string;
  heading: string;
  icon: ReactNode;
  title: (r: any) => string;
  sub: (r: any) => string | undefined;
  id?: (r: any) => number;
}[] = [
  { resource: "equipment_items", open: "equipment", heading: "Thiết bị", icon: <Package />, title: (r) => r.name, sub: (r) => [r.code, r.room?.name, r.school?.name].filter(Boolean).join(" · "), id: (r) => r.equipmentId },
  { resource: "schools", heading: "Trường học", icon: <School />, title: (r) => r.name, sub: (r) => [r.code, r.ward?.name ?? r.area].filter(Boolean).join(" · ") },
  { resource: "staff", heading: "Cán bộ, giáo viên", icon: <UserRound />, title: (r) => r.name, sub: (r) => [r.code, r.school?.name].filter(Boolean).join(" · ") },
  { resource: "rooms", heading: "Phòng", icon: <DoorOpen />, title: (r) => r.name, sub: (r) => [r.code, r.building?.name, r.school?.name].filter(Boolean).join(" · ") },
  { resource: "equipment_catalogs", heading: "Danh mục thiết bị", icon: <ClipboardList />, title: (r) => r.name, sub: (r) => r.code },
  { resource: "equipment_intakes", heading: "Phiếu ghi tăng", icon: <FileInput />, title: (r) => r.code ?? "Phiếu nháp", sub: (r) => [r.school?.name, r.intakeDate].filter(Boolean).join(" · ") },
  { resource: "departments_of_education", heading: "Cơ quan quản lý", icon: <Building2 />, title: (r) => r.name, sub: (r) => r.code },
];
const PER_SOURCE = 5;

function useDebounced<T>(value: T, ms: number) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setV(value), ms);
    return () => clearTimeout(id);
  }, [value, ms]);
  return v;
}

/**
 * Ô tìm kiếm trên thanh đầu trang — như bảng lệnh cũ: bấm (hoặc Ctrl+K / ⌘K) mở hộp tìm giữa màn hình,
 * chưa gõ gì thì liệt kê các màn theo nhóm của menu. Khác bảng lệnh cũ của Refine ở hai chỗ:
 *
 * - tìm KHÔNG PHÂN BIỆT DẤU ("thiet bi" ra "Thiết bị") — bảng cũ so nguyên văn nên gõ không dấu không ra gì;
 * - tìm TOÀN VĂN trong dữ liệu: thiết bị, trường, cán bộ, phòng, danh mục, phiếu ghi tăng, cơ quan quản lý —
 *   mỗi loại vài dòng đầu, qua đúng danh sách của API nên phạm vi dữ liệu của tài khoản vẫn áp dụng.
 *
 * Danh sách màn lấy từ cây menu thanh bên đang vẽ (lọc quyền, theo góc nhìn).
 */
export function HeaderSearch() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          "relative me-1 hidden h-8 w-48 items-center gap-2 rounded-lg xl:w-64",
          "border-input bg-field border ps-2.5 pe-2 text-start text-sm",
          "text-muted-foreground hover:bg-muted/70 transition-colors",
          "focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none",
          "sm:flex",
        )}
      >
        <SearchIcon className="size-4 shrink-0" />
        <span className="flex-1 truncate">Tìm kiếm…</span>
        <kbd className="border-border bg-muted pointer-events-none hidden shrink-0 rounded border px-1.5 py-0.5 font-mono text-[10px] font-medium lg:inline-block">
          Ctrl K
        </kbd>
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="top-[12vh] translate-y-0 overflow-hidden p-0 sm:max-w-2xl" showCloseButton={false}>
          <DialogTitle className="sr-only">Tìm kiếm</DialogTitle>
          <DialogDescription className="sr-only">Tìm màn hình và dữ liệu</DialogDescription>
          {open ? <SearchPanel onDone={() => setOpen(false)} /> : null}
        </DialogContent>
      </Dialog>
    </>
  );
}

function SearchPanel({ onDone }: { onDone: () => void }) {
  const navigate = useNavigate();
  const { showUrl, listUrl } = useNavigation();
  const visible = useVisibleMenuItems();
  const screens = useMemo(() => flatten(visible), [visible]);
  const [q, setQ] = useState("");
  const term = useDebounced(q.trim(), 250);
  const needle = fold(q.trim());

  const shownScreens = useMemo(() => {
    if (!needle) return screens;
    const words = needle.split(/\s+/);
    return screens
      .filter((s) => words.every((w) => fold(`${s.group} ${s.label}`).includes(w)))
      .sort((a, b) => Number(!fold(a.label).startsWith(words[0])) - Number(!fold(b.label).startsWith(words[0])))
      .slice(0, 8);
  }, [screens, needle]);

  const held = new Set(getAuthorities()?.permissions ?? []);
  const sources = SOURCES.filter((s) => held.has(`${s.open ?? s.resource}:read`));
  const { data, isFetching } = useQuery({
    queryKey: ["header-search", term, sources.map((s) => s.resource)],
    enabled: term.length >= 2,
    staleTime: 30_000,
    queryFn: async () =>
      Promise.all(
        sources.map(async (s) => {
          try {
            const rows = await kyInstance
              .get(s.resource, { searchParams: { q: term, _start: 0, _end: PER_SOURCE } })
              .json<any[]>();
            return { source: s, rows: Array.isArray(rows) ? rows : [] };
          } catch {
            return { source: s, rows: [] };
          }
        }),
      ),
  });
  const found = term.length >= 2 ? (data ?? []).filter((g) => g.rows.length > 0) : [];

  const go = (to: string) => {
    navigate(to);
    onDone();
  };

  // Nhóm màn theo mục gốc của menu khi chưa gõ — như bảng lệnh cũ.
  const byGroup = useMemo(() => {
    const m = new Map<string, Screen[]>();
    for (const s of shownScreens) m.set(s.group, [...(m.get(s.group) ?? []), s]);
    return [...m.entries()];
  }, [shownScreens]);

  return (
    <Command shouldFilter={false} className="[&_[cmdk-group-heading]]:text-muted-foreground [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-medium">
      <CommandInput value={q} onValueChange={setQ} placeholder="Tìm màn hình, thiết bị, trường, cán bộ, phòng, phiếu…" className="h-12" />
      <CommandList className="max-h-[60vh]">
        {!isFetching && shownScreens.length === 0 && found.length === 0 ? (
          <CommandEmpty>{term.length >= 2 ? "Không tìm thấy gì khớp." : "Gõ ít nhất 2 ký tự để tìm trong dữ liệu."}</CommandEmpty>
        ) : null}
        {needle ? (
          shownScreens.length ? (
            <CommandGroup heading="Màn hình">
              {shownScreens.map((s) => (
                <CommandItem key={s.key} value={s.key} onSelect={() => go(s.route)}>
                  <span className="text-muted-foreground [&_svg]:size-4">{s.icon}</span>
                  <span className="truncate">{s.label}</span>
                  <span className="text-muted-foreground ms-auto truncate text-xs">{s.group}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          ) : null
        ) : (
          byGroup.map(([group, items]) => (
            <CommandGroup key={group} heading={group}>
              {items.map((s) => (
                <CommandItem key={s.key} value={s.key} onSelect={() => go(s.route)}>
                  <span className="text-muted-foreground [&_svg]:size-4">{s.icon}</span>
                  <span className="truncate">{s.label}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          ))
        )}
        {found.map(({ source, rows }) => (
          <CommandGroup key={source.resource} heading={source.heading}>
            {rows.map((r) => {
              const id = source.id ? source.id(r) : r.id;
              const res = source.open ?? source.resource;
              const to = showUrl(res, id) || listUrl(res);
              const sub = source.sub(r);
              return (
                <CommandItem key={`${source.resource}-${r.id}`} value={`${source.resource}-${r.id}`} onSelect={() => go(to)}>
                  <span className="text-muted-foreground [&_svg]:size-4">{source.icon}</span>
                  <span className="min-w-0 truncate">{source.title(r)}</span>
                  {sub ? <span className="text-muted-foreground ms-auto max-w-[50%] shrink-0 truncate text-xs">{sub}</span> : null}
                </CommandItem>
              );
            })}
          </CommandGroup>
        ))}
        {isFetching ? (
          <div className="text-muted-foreground flex items-center justify-center gap-2 py-3 text-xs">
            <Loader2 className="size-3.5 animate-spin" /> Đang tìm trong dữ liệu…
          </div>
        ) : null}
      </CommandList>
    </Command>
  );
}
