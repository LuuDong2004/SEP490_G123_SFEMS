import { useCustom } from "@refinedev/core";
import { ArrowRight, Search } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router";

import { API_URL } from "@/shared/api/constants";
import { ListView, ListViewHeader } from "@/shared/components/views/list-view";
import { ASSET_STATUS_VARIANTS } from "@/shared/lib/status-variants";
import { cn } from "@/shared/lib/utils";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Card } from "@/shared/ui/card";
import { Input } from "@/shared/ui/input";
import {
  ASSET_STATUS_LABELS,
  CONDITION_LABELS,
  type Equipment,
} from "@/domains/equipment/types";

const money = new Intl.NumberFormat("vi-VN");

/** Một dòng "nhãn — giá trị" của thẻ kết quả. */
function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <div className="text-muted-foreground text-xs">{label}</div>
      <div className="truncate text-sm font-medium">{children}</div>
    </div>
  );
}

/**
 * Tra cứu thiết bị theo mã tài sản (TS-02). Gọi `GET /equipment/lookup?code=`: máy chủ trả đúng hồ sơ khớp
 * mã chuẩn hoặc mã cũ, trong phạm vi dữ liệu của người dùng. Hồ sơ ngoài phạm vi không xuất hiện, nên báo
 * "không tìm thấy" như với mã không có.
 *
 * <p>Kết quả hiện ngay trên màn; bấm "Mở hồ sơ" để xem đủ. Mã được giữ trên URL (?code=) để tải lại
 * trang hoặc gửi đường dẫn vẫn ra đúng kết quả.
 */
export const EquipmentLookup = () => {
  const [params, setParams] = useSearchParams();
  const code = (params.get("code") ?? "").trim();
  const [term, setTerm] = useState("");
  const [recent, setRecent] = useState<Equipment[]>([]);
  const [shownId, setShownId] = useState<number | null>(null);
  const input = useRef<HTMLInputElement>(null);

  const enabled = code.length > 0;
  const { result, query } = useCustom<Equipment[]>({
    url: `${API_URL}/equipment/lookup`,
    method: "get",
    config: { query: { code } },
    queryOptions: { enabled },
  });
  const rows = useMemo(
    () => (enabled && Array.isArray(result?.data) ? result.data : []),
    [enabled, result],
  );
  const loading = enabled && query.isLoading;
  // Máy chủ chỉ trả hồ sơ khớp đúng mã trong phạm vi được xem; nhiều hơn một chỉ khi trùng mã cũ.
  const hit = rows.length === 1 ? rows[0] : null;

  useEffect(() => {
    if (!hit) return;
    setShownId(hit.id);
    setRecent((prev) => [hit, ...prev.filter((r) => r.id !== hit.id)].slice(0, 12));
    setTerm("");
    input.current?.focus();
  }, [hit]);

  const shown = recent.find((r) => r.id === shownId) ?? hit;
  const choices = !hit && rows.length > 1 ? rows : [];

  return (
    <ListView>
      <ListViewHeader />
      <Card className="px-4 py-4">
        <form
          className="flex max-w-2xl gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            const next = term.trim();
            if (next) setParams({ code: next }, { replace: true });
          }}
        >
          <div className="relative flex-1">
            <Search className="text-muted-foreground absolute top-1/2 left-3 size-5 -translate-y-1/2" />
            <Input
              ref={input}
              autoFocus
              className="h-11 pl-10 font-mono text-base"
              value={term}
              onChange={(e) => setTerm(e.target.value)}
              placeholder="Gõ mã chuẩn hoặc mã cũ"
              aria-label="Mã tài sản"
            />
          </div>
          <Button type="submit" className="h-11 px-5">
            <Search />
            Tra cứu
          </Button>
        </form>
      </Card>

      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="grid min-w-0 gap-4">
          {loading ? (
            <Card className="text-muted-foreground px-4 py-10 text-center text-sm">Đang tra…</Card>
          ) : enabled && rows.length === 0 ? (
            <Card className="px-4 py-10 text-center">
              <p className="text-sm font-medium">Không tìm thấy “{code}”</p>
              <p className="text-muted-foreground mt-1 text-sm">
                Không có thiết bị nào mang mã này trong phạm vi bạn được xem.
              </p>
            </Card>
          ) : choices.length ? (
            <Card className="gap-0 py-0">
              <div className="border-b px-4 py-3 text-sm font-medium">
                {choices.length} thiết bị khớp “{code}” <span className="text-muted-foreground font-normal">— bấm một dòng để xem</span>
              </div>
              <ul className="divide-y">
                {choices.map((r) => (
                  <li key={r.id}>
                    <button
                      type="button"
                      onClick={() => setParams({ code: r.code }, { replace: true })}
                      className="hover:bg-muted flex w-full items-center gap-3 px-4 py-2.5 text-start"
                    >
                      <span className="w-44 shrink-0 font-mono text-xs">{r.code}</span>
                      <span className="min-w-0 flex-1 truncate text-sm">{r.name}</span>
                      <span className="text-muted-foreground w-40 shrink-0 truncate text-sm">{r.room?.name ?? "Kho"}</span>
                      <Badge variant={ASSET_STATUS_VARIANTS[r.status] ?? "neutral"}>
                        {ASSET_STATUS_LABELS[r.status] ?? r.status}
                      </Badge>
                    </button>
                  </li>
                ))}
              </ul>
            </Card>
          ) : shown ? (
            <Card className="gap-0 py-0">
              <div className="flex flex-wrap items-start gap-3 border-b px-5 py-4">
                <div className="min-w-0 flex-1">
                  <h2 className="truncate text-lg font-semibold" title={shown.name}>{shown.name}</h2>
                  <div className="mt-1 flex flex-wrap items-center gap-2">
                    <span className="font-mono text-sm">{shown.code}</span>
                    <Badge variant={ASSET_STATUS_VARIANTS[shown.status] ?? "neutral"}>
                      {ASSET_STATUS_LABELS[shown.status] ?? shown.status}
                    </Badge>
                    {shown.missingProfile.length > 0 ? <Badge variant="warning">Hồ sơ chưa đủ</Badge> : null}
                  </div>
                </div>
                <Button asChild>
                  <Link to={`/equipment/show/${shown.id}`}>
                    Mở hồ sơ
                    <ArrowRight />
                  </Link>
                </Button>
              </div>
              <div className="grid gap-x-6 gap-y-4 px-5 py-4 sm:grid-cols-2 xl:grid-cols-4">
                <Fact label="Vị trí">{shown.room?.name ?? "Kho"}</Fact>
                <Fact label="Tình trạng">
                  {shown.condition ? (CONDITION_LABELS[shown.condition] ?? shown.condition) : "—"}
                </Fact>
                <Fact label="Nguyên giá">
                  {shown.originalValue != null ? `${money.format(shown.originalValue)} đ` : "—"}
                </Fact>
                <Fact label="Danh mục thiết bị">{shown.catalog?.name ?? "—"}</Fact>
                <Fact label="Số serial">{shown.serialNumber ?? "—"}</Fact>
                <Fact label="Mã cũ">{shown.legacyCode ?? "—"}</Fact>
                <Fact label="Trường">{shown.school?.name ?? "—"}</Fact>
              </div>
            </Card>
          ) : (
            <Card className="text-muted-foreground px-4 py-10 text-center text-sm">
              Gõ mã chuẩn hoặc mã cũ rồi bấm Enter.
            </Card>
          )}
        </div>

        <Card className="gap-0 py-0">
          <div className="text-overline text-muted-foreground border-b px-4 py-3">
            Vừa tra{recent.length ? ` (${recent.length})` : ""}
          </div>
          {recent.length === 0 ? (
            <p className="text-muted-foreground px-4 py-6 text-sm">Chưa tra thiết bị nào.</p>
          ) : (
            <ul className="divide-y">
              {recent.map((r) => (
                <li key={r.id}>
                  <button
                    type="button"
                    onClick={() => {
                      setParams({}, { replace: true });
                      setShownId(r.id);
                    }}
                    className={cn(
                      "hover:bg-muted block w-full px-4 py-2.5 text-start",
                      r.id === shown?.id && "bg-primary/10 hover:bg-primary/10",
                    )}
                  >
                    <span className="block truncate text-sm font-medium">{r.name}</span>
                    <span className="text-muted-foreground flex items-center gap-2 text-xs">
                      <span className="font-mono">{r.code}</span>
                      <span className="truncate">· {r.room?.name ?? "Kho"}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </ListView>
  );
};
