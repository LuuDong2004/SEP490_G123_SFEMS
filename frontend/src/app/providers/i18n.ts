import i18n from "i18next";
import { initReactI18next } from "react-i18next";

import vi from "@/app/locales/vi.json";

/**
 * Một ngôn ngữ, gói thẳng vào bundle.
 *
 * Không dùng `i18next-http-backend`: gói tiếng Việt là tài sản duy nhất của
 * ứng dụng này và nó phải có mặt trước lần vẽ đầu tiên. Nạp qua HTTP đổi lấy
 * một nhịp nhấp nháy tiếng Anh trên mọi màn, để tiết kiệm vài chục KB mà
 * người dùng nào cũng phải tải.
 *
 * Không dùng `languagedetector` vì cùng lý do: không có ngôn ngữ thứ hai để
 * dò. Thêm ngôn ngữ sau là thêm một file vào `locales/` và một entry vào
 * `resources` dưới đây.
 *
 * `keySeparator` là dấu chấm — đó là điều làm khoá `tasks.fields.title` tìm
 * đúng nhánh lồng nhau trong `vi.json`, và là quy ước Refine dùng cho
 * `{resource}.fields.{field}`. `nsSeparator: false` vì khoá của chúng ta
 * không có dấu hai chấm và để i18next không cắt nhầm một chuỗi có `:`.
 */
i18n.use(initReactI18next).init({
  lng: "vi",
  fallbackLng: "vi",
  supportedLngs: ["vi"],
  resources: {
    vi: { translation: vi },
  },
  nsSeparator: false,
  interpolation: {
    // React đã chống XSS ở tầng render; escape lần nữa biến "Thiết bị & vật tư"
    // thành "Thiết bị &amp; vật tư" trên màn hình.
    escapeValue: false,
  },
  // Một khoá thiếu phải rơi về `defaultMessage` mà Refine truyền vào, chứ
  // không phải hiện chính cái khoá ra màn hình.
  returnEmptyString: false,
});

export default i18n;
