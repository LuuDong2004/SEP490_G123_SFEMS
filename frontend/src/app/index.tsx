import React from "react";
import { createRoot } from "react-dom/client";

import App from "@/app/App";
import { reloadForStaleChunk } from "@/shared/lib/stale-chunk";
import { normalizePortalPath } from "@/shared/api/portal";

// Vite báo khi tải trước một chunk lỗi (tab cũ sau một lần triển khai): tải lại trang thay vì trắng.
window.addEventListener("vite:preloadError", (event) => {
  if (reloadForStaleChunk()) event.preventDefault();
});

// Địa chỉ vào đúng cổng của tài khoản trước khi dựng router (gốc router = cổng, docs/kien-truc/11).
normalizePortalPath();

const container = document.getElementById("root") as HTMLElement;
const root = createRoot(container);

root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
