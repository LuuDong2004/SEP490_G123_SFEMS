import { useMemo, useState } from "react";
import { useCan, useShow } from "@refinedev/core";

import { FormPanel } from "@/shared/components/form/form-panel";
import { FormSection } from "@/shared/components/form/form-section";
import { ReadField } from "@/shared/components/form/read-field";
import { LoadingOverlay } from "@/shared/components/layout/loading-overlay";
import {
  ShowView,
  ShowViewHeader,
} from "@/shared/components/views/show-view";
import { isRecordMissing, RecordNotFound } from "@/shared/components/views/record-not-found";
import { Badge } from "@/shared/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/shared/ui/card";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/shared/components/tabs/tabs";
import { RoleDataScopes } from "@/features/administration/roles/data-scopes";
import {
  humanizeResource,
  splitPermissionCode,
  type PermissionSummary,
  type Role,
} from "@/domains/role/types";
import { USER_TYPE_LABELS } from "@/domains/user/types";

export const RoleShow = () => {
  const { result: record, query } = useShow<Role>({});
  const { isLoading } = query;

  // Grouped the same way the picker groups them, so what you read here and what
  // you edit there line up.
  const groups = useMemo(() => {
    const byResource = new Map<string, PermissionSummary[]>();
    for (const permission of record?.permissions ?? []) {
      const { resource } = splitPermissionCode(permission.code);
      const bucket = byResource.get(resource);
      if (bucket) bucket.push(permission);
      else byResource.set(resource, [permission]);
    }
    return [...byResource.entries()];
  }, [record?.permissions]);

  // `row_level_policies:*` is seeded to ADMIN alone. Somebody who may read a
  // role is not necessarily somebody who may read its data scopes, so the tab
  // is not offered rather than offered and then refused.
  const { data: canReadScopes } = useCan({
    resource: "row_level_policies",
    action: "list",
  });
  const mayReadScopes = canReadScopes?.can ?? false;

  const [tab, setTab] = useState("permissions");

  // Mở thẳng một id không có (gõ tay, liên kết cũ, ngoài phạm vi): báo "Không tìm thấy", không vẽ trang trống.
  if (isRecordMissing(query)) {
    return (
      <ShowView>
        <ShowViewHeader canEdit={false} canDelete={false} />
        <RecordNotFound what="vai trò" />
      </ShowView>
    );
  }

  return (
    <ShowView>
      <ShowViewHeader />
      <LoadingOverlay loading={isLoading}>
        <FormPanel contentClassName="@container space-y-6">
          <FormSection title="Thông tin vai trò" compact>
            <div className="grid items-start gap-5 @md:grid-cols-2 @3xl:grid-cols-4">
              <ReadField label="Mã">
                <span className="font-mono">{record?.code}</span>
              </ReadField>
              <ReadField label="Tên">{record?.name}</ReadField>
              <ReadField label="Dùng cho">{record?.roleType ? USER_TYPE_LABELS[record.roleType] : null}</ReadField>
              <ReadField label="Loại">
                {record ? (
                  record.systemRole ? <Badge variant="secondary">Hệ thống</Badge> : <Badge variant="outline">Tuỳ biến</Badge>
                ) : null}
              </ReadField>
              <ReadField label="Mô tả" className="@md:col-span-2 @3xl:col-span-4">{record?.description || null}</ReadField>
            </div>
          </FormSection>
        </FormPanel>
      </LoadingOverlay>

      {/*
        The same two tabs as the edit screen, in the same order, so that reading
        a role and changing one are the same shape. Both halves of what a role
        grants are here: what it may do, and which rows it may do it to.
      */}
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="permissions">
            Quyền
            <Badge variant="secondary" className="ml-2 tabular-nums">
              {record?.permissions?.length ?? 0}
            </Badge>
          </TabsTrigger>
          {mayReadScopes && (
            <TabsTrigger value="scopes">Phạm vi dữ liệu</TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="permissions">
          <Card>
            <CardHeader>
              <CardTitle>Vai trò này được làm gì</CardTitle>
              <CardDescription>
                Các quyền đã cấp, xếp theo từng chức năng.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <LoadingOverlay loading={isLoading}>
                {groups.length === 0 ? (
                  <p className="text-muted-foreground text-sm">
                    Vai trò này chưa được cấp quyền nào.
                  </p>
                ) : (
                  <div className="flex flex-col gap-3">
                    {groups.map(([resource, permissions]) => (
                      <div key={resource} className="flex flex-col gap-2">
                        <span className="text-sm font-semibold">
                          {humanizeResource(resource)}
                        </span>
                        <div className="flex flex-wrap gap-1">
                          {permissions.map((permission) => (
                            <Badge
                              key={permission.id}
                              variant="outline"
                              className="font-mono text-[0.6875rem]"
                            >
                              {permission.code}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </LoadingOverlay>
            </CardContent>
          </Card>
        </TabsContent>

        {mayReadScopes && (
          <TabsContent value="scopes">
            <Card>
              <CardHeader>
                <CardTitle>Dữ liệu vai trò này được xem / sửa</CardTitle>
                <CardDescription>
                  Ở đây chỉ xem. Muốn thêm hoặc đổi thì mở màn sửa vai trò.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <RoleDataScopes
                  roleId={record?.id}
                  roleCode={record?.code}
                  readOnly
                />
              </CardContent>
            </Card>
          </TabsContent>
        )}
      </Tabs>
    </ShowView>
  );
};
