import type { DataProvider } from "@refinedev/core";
import { createSimpleRestDataProvider } from "@refinedev/rest/simple-rest";
import { toast } from "sonner";

import { API_URL } from "@/shared/api/constants";
import { withPortal } from "@/shared/api/portal";
import {
  AUTH_VERSION_HEADER,
  clearSession,
  getAccessToken,
  getIdentity,
  reconcileAuthVersion,
  refreshSession,
  saveIdentity,
} from "@/shared/api/session";

/**
 * The REST data provider, with the bearer token attached to every request.
 *
 * The two ky hooks below are the whole of the authentication story for data
 * requests: no page, resource or hook ever sees a token.
 */
const SIGNAL_HEADER = "X-Client-Signal";
const signals = new Map<string, AbortSignal>();
let signalSeq = 0;

/** Số lần tự gửi lại một request bị máy chủ hẹn (429) trước khi báo lỗi cho người dùng. */
const MAX_THROTTLE_RETRIES = 3;

function sleep(ms: number, signal: AbortSignal) {
  return new Promise<void>((resolve) => {
    const id = setTimeout(resolve, ms);
    signal.addEventListener("abort", () => { clearTimeout(id); resolve(); }, { once: true });
  });
}

let lastThrottleWarning = 0;

function warnThrottled() {
  if (Date.now() - lastThrottleWarning < 30_000) return;
  lastThrottleWarning = Date.now();
  toast.warning("Thao tác quá nhanh, vui lòng chậm lại", {
    id: "request-throttle",
    description: "Hệ thống đang xử lý các yêu cầu trước, sẽ tự tải lại sau giây lát.",
  });
}

/**
 * `fetch` qua cổng (docs/kien-truc/11): viết lại địa chỉ API theo cổng của phiên — `/api/equipment` →
 * `/api/school/equipment` — ngay trước khi gửi, sau mọi hook. Một chỗ cho mọi lời gọi (Refine, `kyInstance`,
 * `useCustom`, gửi lại sau 401 / 429); màn hình không phải biết mình đang ở cổng nào.
 */
export async function portalFetch(input: Request | string | URL, init?: RequestInit): Promise<Response> {
  if (!(input instanceof Request)) return fetch(withPortal(String(input)), init);
  const url = withPortal(input.url);
  if (url === input.url) return fetch(input, init);
  const body = input.method === "GET" || input.method === "HEAD" ? undefined : await input.clone().arrayBuffer();
  const moved = new Request(url, {
    method: input.method,
    headers: input.headers,
    body,
    signal: input.signal,
    credentials: input.credentials,
    redirect: input.redirect,
  });
  return fetch(moved, init);
}

const base = createSimpleRestDataProvider({
  apiURL: API_URL,
  kyOptions: {
    fetch: portalFetch,
    // ky retries failed requests by default. Retrying a 401 would race the
    // refresh below and burn the rotated token; retrying a 409 or a 422 would
    // repeat a write the server already rejected on purpose.
    retry: 0,
    // ky cắt mọi request ở 10 giây. Truy vấn gộp toàn ngành (trang chủ, chuẩn tối
    // thiểu, tổng hợp trường) trên máy chủ yếu vượt mức đó dù vẫn chạy xong —
    // người dùng thấy "Request timed out" còn kết quả thì không bao giờ về. Tải
    // tệp (Excel, tệp đính kèm) đặt riêng `DOWNLOAD_TIMEOUT`.
    timeout: 60_000,
    hooks: {
      beforeRequest: [
        (request) => {
          const accessToken = getAccessToken();
          if (accessToken) {
            request.headers.set("Authorization", `Bearer ${accessToken}`);
          }
        },
        /**
         * Gắn tín hiệu huỷ của react-query vào request đọc của Refine (`withSignal` bên dưới gửi nó qua một header
         * tạm, vì `@refinedev/rest` không chuyển `signal` cho ky). Rời màn / đổi tab thì request cũ bị huỷ ngay —
         * trình duyệt chỉ mở vài kết nối tới một máy, request bỏ dở mà vẫn chạy thì request của tab mới phải xếp sau.
         */
        (request) => {
          const id = request.headers.get(SIGNAL_HEADER);
          if (!id) return;
          const signal = signals.get(id);
          const headers = new Headers(request.headers);
          headers.delete(SIGNAL_HEADER);
          if (request.method !== "GET" && request.method !== "HEAD") {
            return new Request(request, { headers });
          }
          return new Request(request, { headers, signal: signal ? AbortSignal.any([request.signal, signal]) : request.signal });
        },
        /**
         * The simple-REST provider pins `Content-Type: application/json` on every
         * request, and that header survives a `FormData` body — so every upload
         * (attachments, equipment photos, imports) went out as "JSON" and the
         * server answered 415. Rebuild the request without it and let the
         * browser write `multipart/form-data` with its boundary. It runs LAST: ky
         * stops at the first hook that returns a Request, so placed before the
         * token hook it sent the upload unauthenticated and burned a refresh.
         */
        (request, options) => {
          if (!(options.body instanceof FormData)) return;
          const headers = new Headers(request.headers);
          headers.delete("Content-Type");
          return new Request(request.url, { method: request.method, headers, body: options.body, signal: request.signal });
        },
      ],
      afterResponse: [
        /**
         * Recovers from an expired access token without the user noticing.
         *
         * Access tokens last minutes, so an open dashboard hits this routinely.
         * The request is replayed once with a fresh token; if the refresh
         * fails, the 401 is returned unchanged and the auth provider's
         * `onError` turns it into a sign-out.
         *
         * Only 401 is retried. A 403 means the token is valid and the
         * permission is missing, which no amount of refreshing will change.
         */
        async (request, _options, response) => {
          if (response.status !== 401) {
            return response;
          }

          // `refreshSession` de-duplicates concurrent callers, so the several
          // list requests a dashboard fires in parallel share one refresh
          // rather than each burning the rotated token in turn.
          const accessToken = await refreshSession(API_URL);
          if (!accessToken) {
            clearSession();
            return response;
          }

          // A fresh Request, because the original's body may already be
          // consumed and its Authorization header still holds the dead token.
          const retried = request.clone();
          retried.headers.set("Authorization", `Bearer ${accessToken}`);
          return portalFetch(retried);
        },

        /**
         * Máy chủ hẹn lại (429 — thao tác dồn dập, xem `RequestThrottle`): đợi đúng `Retry-After` rồi tự gửi lại,
         * tối đa ba lần, người dùng chỉ thấy chậm một nhịp. Gửi lại an toàn cả với lệnh ghi: request bị hẹn chưa vào
         * tới xử lý. Hết lượt mới để lỗi đi tiếp ("Thao tác quá nhanh…").
         */
        async (request, _options, response) => {
          if (response.status !== 429) return response;
          let next = response;
          for (let n = 0; next.status === 429 && n < MAX_THROTTLE_RETRIES && !request.signal.aborted; n++) {
            // Lần hẹn đầu tự đợi lặng lẽ — thường chỉ một nhịp, người dùng không nhận ra. Gửi lại vẫn bị hẹn
            // (máy chủ bận thật) mới báo, và nhiều nhất một lần mỗi 30 giây.
            if (n > 0) warnThrottled();
            const seconds = Number(next.headers.get("Retry-After")) || 1;
            await sleep(Math.min(seconds, 10) * 1000 + Math.random() * 300, request.signal);
            if (request.signal.aborted) break;
            // Mỗi lần một bản sao mới: thân request chỉ đọc được một lần.
            next = await portalFetch(request.clone());
          }
          return next;
        },

        /**
         * Cổng Admin cách ly: máy chủ trả 403 `adminBlock: "mfa"` khi tài khoản quản trị không còn lớp thứ hai (vd. bị
         * đặt lại trong lúc đang mở) — ghi lại danh tính rồi tải lại, giao diện chỉ còn màn bật 2 lớp.
         */
        async (_request, _options, response) => {
          if (response.status !== 403) return response;
          const body = (await response.clone().json().catch(() => null)) as { adminBlock?: string } | null;
          const identity = getIdentity();
          if (body?.adminBlock === "mfa" && identity && !identity.mfaSetupRequired) {
            saveIdentity({ ...identity, mfaSetupRequired: true });
            window.location.reload();
          }
          return response;
        },

        /**
         * Notices when this account's permissions have moved.
         *
         * Every response carries `X-Auth-Version`, a stamp of what the server
         * currently says this account may do. Comparing it against the stamp
         * stored with the cached codes turns ordinary traffic into the
         * notification channel: no polling, no held connection, no extra
         * request while nothing changes.
         *
         * It catches every cause, not just this client's own edits — another
         * administrator changing your role reaches you on your next request.
         * That is why it replaced the earlier version of this hook, which
         * guessed from the URL that a write to `users` or `roles` might have
         * mattered: a guess that fired when nothing had changed and stayed
         * silent when somebody else changed everything.
         *
         * Nothing is awaited. The response is already correct — the server
         * enforced the real permissions when it answered — and all that is
         * outstanding is bringing the menu into line.
         */
        async (_request, _options, response) => {
          reconcileAuthVersion(response.headers.get(AUTH_VERSION_HEADER), API_URL);
          return response;
        },

        /**
         * Turns a non-2xx response into a thrown error.
         *
         * `@refinedev/rest` hard-codes `throwHttpErrors: false` on its ky
         * instance — after spreading `kyOptions`, so it cannot be overridden —
         * and then checks `response.ok` itself in `create`, `update`,
         * `deleteOne`, `getMany` and `custom`. It does not check it in
         * `getList` or `getOne`: those two pass the parsed body straight back
         * as the data.
         *
         * So a 403 arrives at the page as `{status, message, errors}` wearing
         * the shape of a record. The query reports success, no error
         * notification is raised, `authProvider.onError` never runs — and the
         * first `.map` or `for…of` over it takes the whole screen down. That
         * is what a revoked `categories:read` did to the blog posts list.
         *
         * This hook runs last, so the 401 retry above has already had its turn
         * and `X-Auth-Version` has already been read off the response. It
         * throws Refine's `HttpError` shape, which is what `onError` and the
         * notification provider already expect — and what the provider's own
         * `transformError` produces on the paths that do check.
         */
        async (_request, _options, response) => {
          if (response.ok) {
            return response;
          }

          // Cloned because a body read here would otherwise be unavailable to
          // anything that catches this, and tolerant of a non-JSON body: a
          // proxy or a gateway can answer where `ApiExceptionHandler` did not.
          const body = (await response
            .clone()
            .json()
            .catch(() => null)) as {
            message?: string;
            errors?: Record<string, string>;
          } | null;

          throw {
            message:
              body?.message || response.statusText || "Yêu cầu không thành công",
            statusCode: response.status,
            errors: body?.errors,
          };
        },
      ],
    },
  },
});

/** Thời hạn cho một lần tải tệp (xuất Excel, tệp đính kèm) — dài hơn mặc định 60 giây. */
export const DOWNLOAD_TIMEOUT = 180_000;

type ReadParams = { meta?: { headers?: Record<string, string>; queryContext?: { signal?: AbortSignal } } & Record<string, unknown> };

/** Gửi tín hiệu huỷ của react-query (`meta.queryContext.signal`) xuống ky qua header tạm `X-Client-Signal`. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- giữ nguyên chữ ký generic của từng hàm Refine
function withSignal<F extends (params: any) => Promise<unknown>>(run: F): F {
  return (async (params: Parameters<F>[0]) => {
    const meta = (params as ReadParams).meta;
    const signal = meta?.queryContext?.signal;
    if (!signal) return run(params);
    const id = String(++signalSeq);
    signals.set(id, signal);
    try {
      return await run({ ...params, meta: { ...meta, headers: { ...meta?.headers, [SIGNAL_HEADER]: id } } });
    } finally {
      signals.delete(id);
    }
  }) as F;
}

export const kyInstance = base.kyInstance;

/** Data provider của Refine: các lệnh ĐỌC mang tín hiệu huỷ — rời màn / chuyển tab thì request cũ dừng ngay. */
export const dataProvider = {
  ...base.dataProvider,
  getList: withSignal(base.dataProvider.getList),
  getOne: withSignal(base.dataProvider.getOne),
  getMany: base.dataProvider.getMany && withSignal(base.dataProvider.getMany),
  custom: base.dataProvider.custom && withSignal(base.dataProvider.custom),
} as DataProvider;
