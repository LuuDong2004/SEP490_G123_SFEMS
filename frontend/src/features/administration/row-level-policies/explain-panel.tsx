import { useCustom, useCustomMutation } from "@refinedev/core";
import { useState } from "react";

import { AsyncCombobox } from "@/shared/components/form/async-combobox";
import { customResult } from "@/shared/hooks/use-custom-result";
import { API_URL } from "@/shared/api/constants";
import { Alert, AlertDescription } from "@/shared/ui/alert";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/shared/ui/card";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/ui/select";
import { Separator } from "@/shared/ui/separator";
import { ACTIONS, actionLabel, type ExplainResponse } from "@/domains/row-level-policy/types";

type SimulateResult = {
  allowed: boolean;
  evaluatedAs: "TRUE" | "FALSE" | "UNKNOWN";
  failedAt: string | null;
  because: string | null;
};

/**
 * The two operational tools, on the page where somebody already has the policy
 * in front of them.
 *
 * `Explain` answers "which rule is doing this". `Simulate` answers "why can
 * this person not see that record", and it answers in three values rather than
 * two — because `UNKNOWN` is both the commonest answer and the one nobody
 * guesses. It almost always means a null foreign key turning a whole branch
 * unknown, and unknown refuses the row.
 *
 * Both need `users:read` on top of the policy permission: simulating somebody
 * else's access is reading about somebody else. The panel simply does not
 * render for an account without it, because the endpoints would 403.
 */
export function ExplainPanel({
  resource,
  action: initialAction,
}: {
  resource: string;
  action: string;
}) {
  const [userId, setUserId] = useState<string>("");
  const [action, setAction] = useState<string>(initialAction);
  const [recordId, setRecordId] = useState<string>("");
  const [simulation, setSimulation] = useState<SimulateResult | null>(null);

  const { result: explainResult, query: explainQuery } = useCustom<ExplainResponse>({
    url: `${API_URL}/row_level_policies/explain`,
    method: "get",
    config: { query: { resource, action, userId } },
    queryOptions: { enabled: Boolean(userId) },
  });

  const { mutate: simulate, mutation } = useCustomMutation<SimulateResult>();

  // Disabled until an account is chosen, so this is the empty-object sentinel
  // far more often than not.
  const explanation = customResult(explainResult?.data, "principal");

  function runSimulation() {
    if (!userId || !recordId) return;
    simulate(
      {
        url: `${API_URL}/row_level_policies/simulate`,
        method: "post",
        values: {
          resource,
          action,
          userId: Number(userId),
          recordId: Number(recordId),
        },
      },
      {
        onSuccess: (response) => setSimulation(response.data as SimulateResult),
      }
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Vì sao một người thấy những gì họ thấy</CardTitle>
        <CardDescription>
          Chọn một tài khoản để xem họ được thấy gì trên{" "}
          <span className="font-mono">{resource}</span>. Nhập thêm mã số để kiểm
          tra một dòng dữ liệu cụ thể.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1.5">
            <Label>Tài khoản</Label>
            {/* Hàng nghìn tài khoản: tìm và tải theo trang ở máy chủ. */}
            <div className="w-[13.75rem]">
              <AsyncCombobox<{ id: number; username: string }>
                resource="users"
                value={userId ? Number(userId) : null}
                onChange={(id) => setUserId(id == null ? "" : String(id))}
                labelOf={(u) => u.username}
                sortField="username"
                clearable={false}
                placeholder="Vui lòng chọn tài khoản"
                searchPlaceholder="Tìm tài khoản…"
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>Hành động</Label>
            <Select value={action} onValueChange={setAction}>
              <SelectTrigger className="w-[8.75rem]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ACTIONS.map((candidate) => (
                  <SelectItem key={candidate} value={candidate}>
                    {actionLabel(candidate)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>Mã số</Label>
            <Input
              className="w-[8.75rem]"
              type="number"
              value={recordId}
              placeholder="tuỳ chọn"
              onChange={(e) => setRecordId(e.target.value)}
            />
          </div>

          <Button
            type="button"
            variant="outline"
            disabled={!userId || !recordId || mutation.isPending}
            onClick={runSimulation}
          >
            {mutation.isPending ? "Đang kiểm tra..." : "Kiểm tra mục này"}
          </Button>
        </div>

        {simulation && (
          <Alert variant={simulation.allowed ? "default" : "destructive"}>
            <AlertDescription className="flex flex-col gap-1">
              <span className="font-medium">
                {simulation.allowed ? "Được phép" : "Bị từ chối"}, kết quả{" "}
                {simulation.evaluatedAs}
              </span>
              {simulation.failedAt && (
                <span className="font-mono text-xs">{simulation.failedAt}</span>
              )}
              {simulation.because && <span>{simulation.because}</span>}
              {simulation.evaluatedAs === "UNKNOWN" && (
                <span className="text-xs">
                  Điều kiện dựa vào một ô đang để trống nên không xét được.
                  Trường hợp này tính là bị từ chối.
                </span>
              )}
            </AlertDescription>
          </Alert>
        )}

        {userId && !explainQuery.isLoading && explanation && (
          <>
            <Separator />

            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span className="text-muted-foreground">Vai trò:</span>
              {explanation.principal.roleCodes.map((role) => (
                <Badge key={role} variant="secondary" className="font-mono text-[0.6875rem]">
                  {role}
                </Badge>
              ))}
              <span className="text-muted-foreground">Phòng ban:</span>
              <span className="font-mono text-xs">
                {explanation.principal.departmentId ?? "—"}
              </span>
            </div>

            <div className="flex flex-col gap-2">
              <span className="text-muted-foreground text-xs">
                Phạm vi hiệu lực
              </span>
              <code className="bg-muted rounded-md p-3 text-xs break-words">
                {explanation.effective}
              </code>
            </div>

            <RuleList
              title="Phạm vi"
              hint="Phạm vi của các vai trò cộng lại với nhau. Thêm vai trò thì thêm dữ liệu."
              rules={explanation.scopes}
            />
            <RuleList
              title="Bộ lọc"
              hint="Bộ lọc áp dụng cho mọi người, giữ vai trò nào cũng vậy."
              rules={explanation.filters}
            />

            {explanation.warnings.length > 0 && (
              <Alert variant="destructive">
                <AlertDescription className="flex flex-col gap-1">
                  {explanation.warnings.map((warning, index) => (
                    <span key={index}>{warning}</span>
                  ))}
                </AlertDescription>
              </Alert>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

function RuleList({
  title,
  hint,
  rules,
}: {
  title: string;
  hint: string;
  rules: ExplainResponse["scopes"];
}) {
  return (
    <div className="flex flex-col gap-2">
      <span className="text-muted-foreground text-xs">
        {title}
      </span>
      {rules.length === 0 ? (
        <p className="text-muted-foreground text-sm">Không có.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {rules.map((rule) => (
            <div
              key={rule.source}
              className="flex flex-col gap-1 rounded-md border p-2"
            >
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant={rule.applies ? "default" : "outline"}>
                  {rule.applies ? "áp dụng" : "không nắm giữ"}
                </Badge>
                <span className="text-sm font-medium">{rule.name}</span>
                <span className="text-muted-foreground font-mono text-[0.6875rem]">
                  {rule.source}
                </span>
              </div>
              {/*
                The compiled form, not the JSON that was typed. Normalisation is
                the part most likely to surprise whoever wrote the rule, so
                showing the authored version here would be showing the wrong
                thing.
              */}
              <code className="text-xs break-words">{rule.reads}</code>
              {/*
                Only when the two clauses differ. Repeating an identical
                condition twice reads like a mistake in the rule rather than a
                property of it.
              */}
              {rule.checks && (
                <code className="text-muted-foreground text-xs break-words">
                  sau khi lưu: {rule.checks}
                </code>
              )}
            </div>
          ))}
        </div>
      )}
      <p className="text-muted-foreground text-xs">{hint}</p>
    </div>
  );
}
