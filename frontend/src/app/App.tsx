import { Refine, type I18nProvider } from "@refinedev/core";
import { useTranslation } from "react-i18next";

import { BrowserRouter } from "react-router";
import routerProvider from "@refinedev/react-router";
import { AppDocumentTitle } from "@/app/providers/document-title";
import { dataProvider } from "@/shared/api/data";
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
import { resources } from "@/app/resources";
import { AppRoutes } from "@/app/router/routes";
// Khởi tạo i18next. Import vì hiệu ứng phụ và phải đứng trước mọi component
// gọi `useTranslation`, nếu không lần vẽ đầu tiên chạy trên một instance chưa
// có gói ngôn ngữ nào.
import "@/app/providers/i18n";
import "@/styles/index.css";

function App() {
  const { t, i18n } = useTranslation();

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
    <BrowserRouter>
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
            resources={resources}
            options={{
              syncWithLocation: true,
              warnWhenUnsavedChanges: true,
              projectId: "OjKL83-Rc63sQ-E2vtK1",
              // Drives the sidebar brand block and the document title.
              title: {
                icon: <img src="/favicon.ico" alt="SFEMS" />,
                text: "SFEMS",
              },
            }}
          >
            <UnsavedChangesGuard>
              <AppRoutes />
            </UnsavedChangesGuard>

            <Toaster />
            <AuthoritiesSync />
            <AppDocumentTitle />
          </Refine>
        </ThemeProvider>
    </BrowserRouter>
  );
}

export default App;
