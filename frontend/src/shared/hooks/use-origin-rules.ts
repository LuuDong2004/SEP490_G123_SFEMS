import { useList } from "@refinedev/core";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";

import { kyInstance } from "@/shared/api/data";
import type { OriginRule } from "@/domains/equipment/types";

export type OriginOption = { id: number; code: string; name: string };

/**
 * Sáu nguồn hình thành (danh mục cố định) và luật của từng nguồn. Hai lần đọc, đều giữ lâu trong bộ
 * đệm: danh mục gần như không đổi, luật thì chỉ đổi khi máy chủ được triển khai lại.
 *
 * `ruleOf(id)` nhận ID của dòng danh mục (thứ form và bản ghi mang), trả luật theo mã của dòng đó.
 */
export function useOriginRules(enabled = true) {
  const { result } = useList<OriginOption>({
    resource: "origin_sources",
    pagination: { pageSize: 50 },
    sorters: [{ field: "sortOrder", order: "asc" }],
    queryOptions: { enabled, staleTime: 5 * 60_000 },
  });
  const { data } = useQuery({
    queryKey: ["origin_sources", "rules"],
    queryFn: () => kyInstance.get("origin_sources/rules").json<OriginRule[]>(),
    enabled,
    staleTime: 30 * 60_000,
  });
  return useMemo(() => {
    const origins = (result?.data ?? []) as OriginOption[];
    const rules = Array.isArray(data) ? data : [];
    const byCode = new Map(rules.map((r) => [r.code, r]));
    const ruleOf = (id: unknown): OriginRule | undefined => {
      const origin = origins.find((o) => String(o.id) === String(id ?? ""));
      return origin ? byCode.get(origin.code) : undefined;
    };
    return { origins, rules, ruleOf };
  }, [result, data]);
}
