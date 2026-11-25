import { useCustom } from "@refinedev/core";

import { customResult } from "@/shared/hooks/use-custom-result";
import { API_URL } from "@/shared/api/constants";
import { Badge } from "@/shared/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/shared/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/shared/ui/table";
import { cn } from "@/shared/lib/utils";
import { ACTIONS, actionLabel, type CoverageResponse } from "@/domains/row-level-policy/types";
import { LIFT_ROW } from "@/shared/lib/row-lift";

/**
 * The coverage grid: which roles have a scope on which resource, per action.
 *
 * It exists to make one specific thing impossible to miss. A resource whose
 * default is `FULL` and a role with no scope means that role is **not narrowed
 * at all** — which is the price of being able to switch a running resource on
 * without anybody losing a row on the day it ships. Left implicit, that price
 * is a default somebody guessed at months ago; shown here, it is a red cell
 * with a name on it.
 *
 * A resource on `NONE` with no scope is the opposite and is fine: the role sees
 * nothing, which is loud, immediate and safe. It is marked, not coloured.
 */
export function CoverageMatrix() {
  const { result, query } = useCustom<CoverageResponse>({
    url: `${API_URL}/row_level_policies/coverage`,
    method: "get",
  });

  // Same trap as in `policy-form`: a query with no data yet reports a frozen
  // empty object, which is truthy and has no `resources` to read a length off.
  const coverage = customResult(result?.data, "resources");

  if (query.isLoading) {
    return null;
  }

  if (!coverage || coverage.resources.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Độ phủ</CardTitle>
          <CardDescription>
            Chưa có tài nguyên nào được giới hạn theo phạm vi dữ liệu.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const roles = [...new Set(coverage.resources.flatMap((resource) =>
    resource.cells.map((cell) => cell.role)))];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Độ phủ</CardTitle>
        <CardDescription>
          Vai trò chưa có phạm vi thì theo mặc định của từng tài nguyên. Ô đỏ
          là vai trò đang không bị giới hạn gì.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {coverage.resources.map((resource) => (
          <div key={resource.resource} className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-medium">{resource.resource}</span>
              <Badge
                variant={resource.defaultScope === "FULL" ? "secondary" : "outline"}
              >
                mặc định: {resource.defaultScope === "FULL"
                  ? "thấy tất cả"
                  : "không thấy gì"}
              </Badge>
            </div>

            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[11.25rem]">Vai trò</TableHead>
                    {ACTIONS.map((action) => (
                      <TableHead key={action}>{actionLabel(action)}</TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {roles.map((role) => (
                    <TableRow key={role} className={cn("group/row", LIFT_ROW)}>
                      <TableCell className="font-mono text-xs">{role}</TableCell>
                      {ACTIONS.map((action) => {
                        const cell = resource.cells.find(
                          (candidate) =>
                            candidate.role === role && candidate.action === action
                        );
                        return (
                          <TableCell key={action}>
                            <RiskBadge risk={cell?.risk} />
                          </TableCell>
                        );
                      })}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function RiskBadge({ risk }: { risk: string | undefined }) {
  if (risk === "OK") {
    return <Badge variant="outline">có phạm vi</Badge>;
  }
  if (risk === "CLOSED") {
    // Fail-closed, which is the destination for every resource. Worth naming so
    // nobody "fixes" it by writing a scope that grants everything.
    return (
      <Badge variant="outline" className="text-muted-foreground">
        không dòng nào
      </Badge>
    );
  }
  return (
    <Badge
      className={cn(
        "bg-destructive/10 text-destructive border-destructive/30",
        "border"
      )}
      variant="outline"
    >
      không giới hạn
    </Badge>
  );
}
