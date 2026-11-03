/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Base URL of the REST API. See `src/providers/constants.ts`. */
  readonly VITE_API_URL?: string;
  /** "true" thì màn đăng nhập có khung vào nhanh bằng tài khoản demo (dev server, UAT). */
  readonly VITE_DEMO_LOGIN?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

/** Gắn lúc build ở `vite.config.ts`: phiên bản trong package.json, mã commit ngắn, ngày build. */
declare const __APP_VERSION__: string;
declare const __APP_COMMIT__: string;
declare const __APP_BUILT__: string;
