import { Refine, type I18nProvider, type ResourceProps } from "@refinedev/core";
import { portalBase } from "@/shared/api/portal";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { BrowserRouter } from "react-router";
import routerProvider from "@refinedev/react-router";
import { AppDocumentTitle } from "@/app/providers/document-title";
import { dataProvider } from "@/shared/api/data";
import { queryClient } from "@/shared/api/query-client";
import { authProvider } from "@/app/providers/auth";
import { accessControlProvider } from "@/app/providers/access-control";
import { AuthoritiesSync } from "@/app/providers/authorities-sync";
import { useNotificationProvider } from "@/shared/components/notification/use-notification-provider";
import { Toaster } from "@/shared/components/notification/toaster";
import { ThemeProvider } from "@/shared/components/theme/theme-provider";
// Refine ships an `UnsavedChangesNotifier` too, but it asks with
// `window.confirm`. This one asks with the application's own dialog, and wraps
// the routes so a screen that dismisses itself can ask the same question.
import { UnsavedChangesGuard } from "@/shared/components/form/unsaved-changes-guard";
import { AppRoutes } from "@/app/router/routes";
// Khởi tạo i18next. Import vì hiệu ứng phụ và phải đứng trước mọi component
// gọi `useTranslation`, nếu không lần vẽ đầu tiên chạy trên một instance chưa
// có gói ngôn ngữ nào.
import "@/app/providers/i18n";
import "@/styles/index.css";

/**
 * `resources` kéo theo registry danh mục (cấu hình + phần riêng của từng màn), nên được tải SAU, song song
 * với màn đầu tiên — màn đăng nhập không cần chúng. Bắt đầu ngay khi gói chính chạy, không chờ mount.
 */
const resourcesModule = import("@/app/resources");

function App() {
  const { t, i18n } = useTranslation();
  const [resources, setResources] = useState<ResourceProps[] | null>(null);
  useEffect(() => {
    let alive = true;
    void resourcesModule.then((m) => alive && setResources(m.resources));
    return () => {
      alive = false;
    };
  }, []);

  /**
   * Refine gọi `translate` theo HAI chữ ký, và cả hai đều có thật trong nền
   * này: `translate(key, defaultMessage)` ở phần lớn chỗ, và
   * `translate(key, options, defaultMessage)` ở `pages.error.info`
   * (`layout/error-component.tsx`). Nhận nhầm `defaultMessage` vào chỗ
   * `options` thì i18next coi chuỗi đó là tuỳ chọn, bỏ qua nó, và khoá thiếu
   * hiện ra màn hình dưới dạng chính cái khoá.
   *
   * Không bọc trong `useMemo`: `t` đổi định danh mỗi lần ngôn ngữ đổi, và đó
   * chính là thứ phải làm cây component vẽ lại.
   *
   * `as string`: i18next khai `t` trả `string | object`, vì một khoá trỏ vào
   * NHÁNH (`table.filter`) trả về cả nhánh đó. Refine chỉ hỏi khoá lá, và
   * `defaultValue` luôn là chuỗi, nên nhánh object không bao giờ xảy ra ở đây.
   */
  const i18nProvider: I18nProvider = {
    translate: (key, options?, defaultMessage?) => {
      if (typeof options === "string") {
        return t(key, { defaultValue: options }) as string;
      }
      return t(key, {
        ...(options ?? {}),
        defaultValue: defaultMessage ?? key,
      }) as string;
    },
    changeLocale: (lang: string) => i18n.changeLanguage(lang),
    getLocale: () => i18n.language,
  };

  return (
    // Gốc router là cổng của tài khoản (`/school`, `/so`, `/ubnd`, `/admin` — docs/kien-truc/11): mọi liên kết
    // sẵn có trong ứng dụng tự nằm dưới cổng, không phải sửa từng đường dẫn.
    <BrowserRouter basename={portalBase() || undefined}>
        <ThemeProvider>
          <Refine
            dataProvider={dataProvider}
            // Signing in, renewing and identifying the current user. Its
            // presence is also what makes the header and sidebar render their
            // account blocks -- both check for `getIdentity` before doing so.
            authProvider={authProvider}
            // Answers every `can` from the permissions the token carries, so
            // the menu and the action buttons only offer what this account
            // can actually do. The API re-checks all of it.
            accessControlProvider={accessControlProvider}
            notificationProvider={useNotificationProvider()}
            // Nhãn menu, breadcrumb, nút và thông báo đều đi qua đây. Thiếu
            // nó thì mọi `translate(...)` rơi về `defaultMessage` tiếng Anh
            // mà không có lỗi nào — nền này chạy như vậy cho tới giờ.
            i18nProvider={i18nProvider}
            routerProvider={routerProvider}
            resources={resources ?? []}
            options={{
              syncWithLocation: true,
              warnWhenUnsavedChanges: true,
              projectId: "OjKL83-Rc63sQ-E2vtK1",
              // Refine mặc định gửi một ảnh tới telemetry.refine.dev mỗi lần mở ứng dụng.
              disableTelemetry: true,
              // Mặc định truy vấn (đệm, thử lại) — xem `shared/api/query-client.ts`.
              reactQuery: { clientConfig: queryClient },
              // Drives the sidebar brand block and the document title.
              title: {
                icon: <img src="/logo-so-gddt-hcm.png" alt="Sở GD&ĐT TP.HCM" />,
                text: "Quản lý cơ sở vật chất và thiết bị trường học",
              },
            }}
          >
            <UnsavedChangesGuard>
              <AppRoutes ready={resources !== null} />
            </UnsavedChangesGuard>

            <Toaster />
            <AuthoritiesSync />
            {/* Dựng lại khi `resources` về: tiêu đề chỉ tính theo lần đổi địa chỉ, mà lần tải trang đầu thì
                địa chỉ đã đứng yên trước khi biết nó thuộc resource nào. */}
            <AppDocumentTitle key={resources ? "ready" : "loading"} />
          </Refine>
        </ThemeProvider>
    </BrowserRouter>
  );
}

export default App;
