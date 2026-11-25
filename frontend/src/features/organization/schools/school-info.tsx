import { Check, DoorOpen, LayoutGrid, Lock, Pencil, School as SchoolIcon, UserRound, Users, UsersRound, X, type LucideIcon } from "lucide-react";
import { createContext, useContext, useRef, useState } from "react";

import { SLIDE_TRANSITION, trackedStyle, useTrackedBox } from "@/shared/hooks/use-tracked-box";
import { cn } from "@/shared/lib/utils";
import { maxLengthOf, textError, type TextRule } from "@/shared/lib/field-rules";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { ORG_STATUS_VARIANTS as STATUS_VARIANTS } from "@/shared/lib/status-variants";
import type { School } from "@/domains/school/types";
import { STATUS_LABELS } from "@/domains/school/types";

/** Ô trường tự sửa được trên hồ sơ của chính mình (`/api/school_profile`, 239). */
export type OwnProfileField = "address" | "moetCode";

/** Ổ khoá nhỏ cạnh nhãn: ô do UBND / Sở cập nhật, trường không sửa. */
function LockMark() {
  return (
    <span className="text-muted-foreground/70 inline-flex" title="Do Sở cập nhật" aria-label="Do Sở cập nhật">
      <Lock className="size-3" />
    </span>
  );
}

/**
 * Sửa tại chỗ một ô của hồ sơ (phương án A, 12/11/2026): giá trị + bút chì; bấm thì thành ô nhập ngay đó, Enter
 * lưu, Esc huỷ — không mở hộp thoại. Ô còn trống hiện "Chưa khai" màu cam kèm bút chì (13/11/2026) — nhắc nhẹ tại ô, không chèn khung
 * cảnh báo. `check` trả lỗi của bản nháp theo bộ luật chuẩn (`field-rules`); máy chủ kiểm lại cùng luật.
 */
export function InlineEdit({ value, display, label, check, maxLength, inputMode, mono, onSave }: {
  /** Giá trị thô đưa vào ô nhập; rỗng / null = chưa khai. */
  value?: string | null;
  /** Cách hiện giá trị khi không sửa (vd. số đã định dạng kèm đơn vị); mặc định là `value`. */
  display?: React.ReactNode;
  label: string;
  check: (draft: string) => string | undefined;
  maxLength?: number;
  inputMode?: "decimal" | "text";
  mono?: boolean;
  onSave: (next: string) => Promise<void>;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const editing = draft !== null;
  const error = editing ? check(draft) : undefined;
  const close = () => { setDraft(null); setProblem(null); };
  async function save() {
    if (draft === null || error) return;
    if (draft.trim() === (value ?? "")) { close(); return; }
    setBusy(true);
    setProblem(null);
    try {
      await onSave(draft.trim());
      close();
    } catch (e) {
      setProblem(e instanceof Error ? e.message : "Không lưu được");
    } finally {
      setBusy(false);
    }
  }
  if (editing) {
    return (
      <div className="space-y-1">
        <div className="flex items-center gap-1">
          <Input
            autoFocus
            aria-label={label}
            value={draft}
            maxLength={maxLength}
            inputMode={inputMode}
            onChange={(e) => { setDraft(e.target.value); setProblem(null); }}
            onKeyDown={(e) => {
              if (e.key === "Enter") { e.preventDefault(); void save(); }
              if (e.key === "Escape") { e.preventDefault(); close(); }
            }}
            aria-invalid={!!error || !!problem}
            // Sửa tại chỗ: không vẽ vòng sáng xanh khi đang gõ (trưởng nhóm, 12/11); sai luật thì viền đỏ.
            className={cn(
              "bg-field h-8 text-sm focus-visible:border-input focus-visible:ring-0",
              (error || problem) && "border-destructive focus-visible:border-destructive",
              mono && "font-mono",
            )}
          />
          <Button type="button" size="icon" className="size-8 shrink-0" disabled={busy || !!error} onClick={() => void save()} aria-label="Lưu">
            <Check />
          </Button>
          <Button type="button" size="icon" variant="ghost" className="size-8 shrink-0" disabled={busy} onClick={close} aria-label="Huỷ">
            <X />
          </Button>
        </div>
        {error || problem ? <p role="alert" className="text-destructive-text text-xs font-normal">{error ?? problem}</p> : null}
      </div>
    );
  }
  if (!value) {
    return (
      <button type="button" onClick={() => setDraft("")} title="Nhập" className="text-warning-text hover:text-warning-text/80 inline-flex items-center gap-1.5 text-[0.8125rem] font-medium">
        Chưa khai
        <Pencil className="size-3.5" />
      </button>
    );
  }
  return (
    <span className="group/edit inline-flex max-w-full items-start gap-1.5">
      <span className={cn("min-w-0 break-words", mono && "font-mono")}>{display ?? value}</span>
      <button
        type="button"
        onClick={() => setDraft(value)}
        className="text-primary/70 hover:text-primary mt-0.5 shrink-0"
        aria-label={`Sửa ${label.toLowerCase()}`}
        title="Sửa"
      >
        <Pencil className="size-3.5" />
      </button>
    </span>
  );
}

/** Ô chữ sửa tại chỗ theo một luật chữ chuẩn. */
function InlineText({ rule, max, label, ...rest }: Omit<React.ComponentProps<typeof InlineEdit>, "check" | "maxLength"> & {
  rule: TextRule;
  max?: number;
}) {
  return (
    <InlineEdit {...rest} label={label} maxLength={maxLengthOf(rule, max)} check={(d) => textError(rule, label, d, max)} />
  );
}

/** Dòng nguồn nhỏ dưới một số tự tính: "sĩ số 24 lớp", "Xem chi tiết ›". */
export function SourceLink({ children, onClick }: { children: React.ReactNode; onClick?: () => void }) {
  if (!onClick) return <span className="text-muted-foreground text-[0.6875rem] leading-tight">{children}</span>;
  return (
    <button type="button" onClick={onClick} className="text-primary text-start text-[0.6875rem] leading-tight hover:underline">
      {children} ›
    </button>
  );
}

export type SchoolPerson = { id: number; name: string; phone?: string | null };

/** Người giữ một chức vụ; quá hai người thì gộp "+N người khác" — đủ danh sách ở tab Cán bộ. */
function People({ people }: { people?: SchoolPerson[] }) {
  if (!people?.length) return <span className="text-muted-foreground font-normal">Chưa khai báo</span>;
  const shown = people.slice(0, 2);
  return (
    <ul className="space-y-0.5">
      {shown.map((p) => (
        <li key={p.id}>
          {p.name}
          {p.phone ? <span className="text-muted-foreground ms-1.5 text-xs font-normal tabular-nums">{p.phone}</span> : null}
        </li>
      ))}
      {people.length > shown.length ? (
        <li className="text-muted-foreground text-xs font-normal">+{people.length - shown.length} người khác</li>
      ) : null}
    </ul>
  );
}

const count = new Intl.NumberFormat("vi-VN", { useGrouping: false });

/**
 * Một ô "nhãn — giá trị" của hồ sơ. Nhãn có dấu ":" (trưởng nhóm 13/11/2026); ô trống ghi chữ, không "—" (12/11/2026).
 */
export function Fact({ label, children, className, locked }: { label: string; children?: React.ReactNode; className?: string; locked?: boolean }) {
  return (
    <div className={cn("min-w-0", className)}>
      <dt className="text-muted-foreground flex items-center gap-1 text-xs">{label}:{locked ? <LockMark /> : null}</dt>
      <dd className="mt-0.5 text-sm font-medium break-words">
        {children ?? <span className="text-muted-foreground font-normal">Chưa có</span>}
      </dd>
    </div>
  );
}

/** Lưới ô của một phần hồ sơ — 4 cột như hộp phòng, 2 cột ở màn hẹp. */
export const PROFILE_GRID = "grid gap-x-6 gap-y-4 sm:grid-cols-2 xl:grid-cols-4";

const ActiveProfileSection = createContext<string | null>(null);

/**
 * Một phần của tab Hồ sơ trường (phương án A, trưởng nhóm chốt 13/11/2026): tiêu đề chữ đậm thường (không biểu tượng,
 * không thẻ riêng), nút phụ bên phải, thân tự do. Phần đang chọn ở cột mục trái nổi lên bằng nền xanh rất nhạt — cùng
 * cách với hộp phòng. `k` khớp với khoá mục ở cột trái.
 */
export function ProfileSection({ k, title, action, children }: {
  k: string;
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  const active = useContext(ActiveProfileSection) === k;
  return (
    <section data-profile-section={k}
      className={cn("-mx-3 scroll-mt-2 rounded-xl px-3 py-3 transition-[background-color,box-shadow] duration-300",
        active && "bg-primary/[0.06] ring-primary/40 ring-1")}>
      <div className="mb-3 flex items-center justify-between gap-2">
        <h3 className="text-[0.9375rem] font-semibold">{title}</h3>
        {action}
      </div>
      {children}
    </section>
  );
}

/** Một mục ở cột trái của tab Hồ sơ trường. `missing`: ô bắt buộc còn trống (số đỏ); `count`: số đếm xám. */
export type ProfileNavItem = { key: string; title: string; icon: LucideIcon; group: string; missing?: string[]; count?: number | null };

/**
 * Tab Hồ sơ trường — phương án A (trưởng nhóm chốt 13/11/2026), cùng dáng tab Cơ sở vật chất: cột mục bên trái (ảnh
 * trường, các mục — không chia nhóm, trưởng nhóm 13/11/2026 — vệt chọn TRƯỢT như các cột mục khác), bên phải là đầu hồ sơ (tên, nhãn,
 * bốn số quy mô, nút Sửa) rồi các phần xếp dọc, lưới 4 cột. Bấm mục là cuộn tới phần đó.
 */
export function SchoolInfoSections({
  record,
  leaders,
  scale,
  photo,
  year,
  action,
  extra,
  extraNav = [],
  own,
  onGo,
}: {
  /**
   * Người xem là chính trường đó (có `school_profile:write`, không có quyền sửa cả hồ sơ): ô trường tự sửa được
   * (địa chỉ, mã Bộ) sửa tại chỗ, các ô còn lại mang ổ khoá "Do Sở cập nhật".
   */
  own?: { save: (field: OwnProfileField, value: string) => Promise<void> };
  /** Mở tab / mục nguồn của một số tự tính ("classes", "staff", "rooms"…). */
  onGo?: (tab: string) => void;
  record?: School;
  /** Lấy từ danh sách cán bộ theo chức vụ — trường không có cột "hiệu trưởng" riêng. */
  leaders?: { principal: SchoolPerson[]; vice: SchoolPerson[]; equipment: SchoolPerson[] };
  scale?: { classes: number; students: number; staff: number; rooms: number };
  /** Ảnh trường ở đầu cột trái. */
  photo?: React.ReactNode;
  year?: string;
  /** Nút bên phải đầu hồ sơ (vd. Sửa). */
  action?: React.ReactNode;
  /** Các phần thêm (`ProfileSection`) đứng sau Ban giám hiệu — vd. Số liệu chung CSVC, Cơ sở. */
  extra?: React.ReactNode;
  /** Mục ở cột trái cho các phần thêm. */
  extraNav?: ProfileNavItem[];
}) {
  const ward = record?.ward?.name ?? record?.wardText;
  const nav: ProfileNavItem[] = [
    { key: "info", title: "Thông tin trường", icon: SchoolIcon, group: "Hồ sơ", missing: record && !record.moetCode ? ["Mã trường của Bộ"] : [] },
    ...(leaders ? [{ key: "leaders", title: "Ban giám hiệu", icon: UsersRound, group: "Hồ sơ" }] : []),
    ...extraNav,
  ];
  const groups = [...new Set(nav.map((n) => n.group))].map((g) => ({ title: g, items: nav.filter((n) => n.group === g) }));
  // Không chọn sẵn mục nào: mở tab không có nền xanh. Bấm mục là chọn (nền xanh + cuộn tới); bấm lại chính mục đó,
  // bấm chỗ trống hay Esc là BỎ chọn — mất cả vệt bên trái lẫn nền của phần (trưởng nhóm 13/11/2026).
  const [active, setActive] = useState<string | null>(null);
  const navRef = useRef<HTMLElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const pill = useTrackedBox(navRef, active ? `[data-profile-nav="${active}"]` : null);
  const pick = (key: string) => {
    if (key === active) return setActive(null);
    setActive(key);
    bodyRef.current?.querySelector(`[data-profile-section="${key}"]`)?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  };
  return (
    <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-[14rem_minmax(0,1fr)] lg:gap-5">
      <aside className="flex min-h-0 flex-col gap-4 lg:border-r lg:pr-3">
        {photo ? <div className="hidden lg:block">{photo}</div> : null}
        <nav ref={navRef} aria-label="Hồ sơ trường" className="relative hidden min-h-0 overflow-y-auto lg:block">
          {/* Vệt chọn TRƯỢT giữa các mục — cùng chuyển động với cột mục tab Cơ sở vật chất. */}
          {pill.box ? (
            <span aria-hidden className={cn("bg-primary/10 pointer-events-none absolute top-0 left-0 rounded-md", pill.animate && SLIDE_TRANSITION)}
              style={trackedStyle(pill.box)} />
          ) : null}
          {groups.map((g) => (
            <div key={g.title} className="mb-0.5">
              <ul className="grid grid-cols-[minmax(0,1fr)] gap-0.5">
                {g.items.map((i) => {
                  const on = i.key === active;
                  const gaps = i.missing ?? [];
                  return (
                    <li key={i.key}>
                      <button type="button" onClick={() => pick(i.key)} aria-current={on ? "true" : undefined} data-profile-nav={i.key}
                        title={gaps.length ? `Còn thiếu: ${gaps.join(", ")}` : undefined}
                        className={cn("relative z-[1] flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors duration-300",
                          on ? "text-primary font-medium" : "hover:bg-foreground/[0.04] text-foreground")}>
                        <i.icon className="text-primary size-4 shrink-0" />
                        <span className="min-w-0 flex-1 truncate">{i.title}</span>
                        {gaps.length ? (
                          <span className="bg-destructive text-destructive-foreground rounded-full px-1.5 text-[0.6875rem] leading-[1.125rem] tabular-nums">{gaps.length}</span>
                        ) : i.count != null ? (
                          <span className="bg-foreground/[0.06] text-muted-foreground rounded-full px-1.5 text-[0.6875rem] tabular-nums">{count.format(i.count)}</span>
                        ) : null}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>
      </aside>

      <div className="flex min-h-0 min-w-0 flex-col">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-3 border-b pb-4">
          {photo ? <div className="w-16 shrink-0 lg:hidden">{photo}</div> : null}
          <div className="min-w-0 flex-1 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-xl leading-tight font-semibold tracking-tight break-words">{record?.name ?? "…"}</h2>
              <SchoolStatusBadge record={record} />
            </div>
            <p className="text-muted-foreground text-sm">
              {[record?.educationLevel?.name, year && !/^năm học/i.test(year) ? `Năm học ${year}` : year, ward].filter(Boolean).join(" · ")}
            </p>
          </div>
          {scale ? (
            <dl className="flex flex-wrap items-center gap-x-6 gap-y-2">
              {[
                { icon: <LayoutGrid />, label: "Lớp", value: scale.classes },
                { icon: <Users />, label: "Học sinh", value: scale.students },
                { icon: <UserRound />, label: "Cán bộ, GV", value: scale.staff },
                { icon: <DoorOpen />, label: "Phòng", value: scale.rooms },
              ].map((f) => (
                <div key={f.label} className="flex items-center gap-2">
                  <span className="text-primary flex shrink-0 [&_svg]:size-5">{f.icon}</span>
                  <div>
                    <dt className="text-muted-foreground text-xs leading-tight">{f.label}:</dt>
                    <dd className="text-lg leading-tight font-bold tabular-nums">{count.format(f.value)}</dd>
                  </div>
                </div>
              ))}
            </dl>
          ) : null}
          {action ? <div className="shrink-0">{action}</div> : null}
        </div>

        <div ref={bodyRef} className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 pt-4 pb-1"
          onFocusCapture={(e) => {
            const key = (e.target as HTMLElement).closest?.("[data-profile-section]")?.getAttribute("data-profile-section");
            if (key && key !== active) setActive(key);
          }}
          // Bấm vào khoảng trống ngoài mọi phần thì bỏ chọn.
          onClick={(e) => {
            const t = e.target as HTMLElement;
            if (e.currentTarget.contains(t) && !t.closest("[data-profile-section]")) setActive(null);
          }}
          onKeyDown={(e) => {
            if (e.key === "Escape" && active) setActive(null);
          }}>
          <ActiveProfileSection.Provider value={active}>
            <ProfileSection k="info" title="Thông tin trường">
              <dl className={PROFILE_GRID}>
                <Fact label="Mã trường" locked={!!own}><span className="font-mono">{record?.code}</span></Fact>
                <Fact label="Mã trường của Bộ">
                  {own && record ? (
                    <InlineText value={record.moetCode} label="Mã trường của Bộ" rule="CODE" max={20} mono onSave={(v) => own.save("moetCode", v)} />
                  ) : record?.moetCode || null}
                </Fact>
                <Fact label="Mã hai ký tự" locked={!!own}>{record?.shortCode || null}</Fact>
                <Fact label="Phường/Xã" locked={!!own}>
                  {record?.ward ? (
                    record.ward.name
                  ) : record?.wardText ? (
                    <span className="text-warning-text">{record.wardText} · chưa chuẩn hoá</span>
                  ) : null}
                </Fact>
                <Fact label="Cơ quan quản lý" locked={!!own}>{record?.departmentOfEducation?.name}</Fact>
                <Fact label="Địa chỉ" className="sm:col-span-2">
                  {own && record ? (
                    <InlineText value={record.address} label="Địa chỉ" rule="ADDRESS" onSave={(v) => own.save("address", v)} />
                  ) : record?.address || null}
                </Fact>
              </dl>
            </ProfileSection>
            {leaders ? (
              <ProfileSection k="leaders" title="Ban giám hiệu"
                // Ban giám hiệu là chữ lấy từ chức vụ trong hồ sơ cán bộ — sửa ở tab Nhân sự.
                action={onGo ? (
                  <button type="button" onClick={() => onGo("staff")} className="text-primary text-xs font-medium hover:underline">
                    Cập nhật nhân sự ›
                  </button>
                ) : undefined}>
                <dl className={PROFILE_GRID}>
                  <Fact label="Hiệu trưởng"><People people={leaders.principal} /></Fact>
                  <Fact label="Phó hiệu trưởng"><People people={leaders.vice} /></Fact>
                  <Fact label="Cán bộ thiết bị"><People people={leaders.equipment} /></Fact>
                </dl>
              </ProfileSection>
            ) : null}
            {extra}
          </ActiveProfileSection.Provider>
        </div>
      </div>
    </div>
  );
}

/** Trạng thái của trường dạng nhãn — cho đầu hộp thoại hồ sơ. */
export function SchoolStatusBadge({ record }: { record?: School }) {
  return record ? (
    <Badge variant={STATUS_VARIANTS[record.status] ?? "secondary"}>{STATUS_LABELS[record.status] ?? record.status}</Badge>
  ) : null;
}
