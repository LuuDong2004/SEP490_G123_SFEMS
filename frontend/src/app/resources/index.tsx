/**
 * Mảng `resources` truyền cho `<Refine>`. Cây `<Route>` ở `app/router/routes.tsx`
 * phải khớp đường dẫn với mảng này — thêm resource là sửa CẢ HAI file.
 *
 * Tên resource là đoạn đường dẫn API (`/api/{name}`) và nửa đầu mã quyền
 * (`{name}:read`), nên dùng gạch dưới; đường dẫn màn hình dùng gạch nối.
 */
import type { ResourceProps } from "@refinedev/core";
import { Settings2, Users } from "lucide-react";

export const resources: ResourceProps[] = [
  // Quản trị hệ thống. Cả nhóm ẩn với người không có quyền nào bên trong — sidebar lọc theo quyền.
  {
    name: "administration",
    meta: { group: true, icon: <Settings2 className="h-4 w-4" /> },
  },
  {
    name: "users",
    list: "/users",
    show: "/users/show/:id",
    meta: { icon: <Users className="h-4 w-4" />, parent: "administration" },
  },
];
