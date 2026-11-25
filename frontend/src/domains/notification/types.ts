/** Loại thông báo — trùng `NotificationType` ở backend. */
export type NotificationType =
  | "VOUCHER_PENDING"
  | "VOUCHER_RESULT"
  | "INVENTORY_CAMPAIGN"
  | "YEAR_PROFILE"
  | "SYSTEM_ALERT"
  | "ADMIN_MESSAGE";

/** Một loại trên màn cài đặt của người dùng. */
export type NotificationPreference = {
  type: NotificationType;
  label: string;
  emailEnabled: boolean;
  /** Quản trị có bật email cho loại này không — tắt thì ô tích bị khoá. */
  emailAllowed: boolean;
};

/** Một loại trên màn cài đặt toàn hệ thống. */
export type NotificationTypeSetting = {
  type: NotificationType;
  label: string;
  inAppEnabled: boolean;
  emailEnabled: boolean;
  /** Tắt được trên hệ thống không (cảnh báo vận hành, thông báo của quản trị thì không). */
  inAppOptional: boolean;
};

export type NotificationTypeSettings = { items: NotificationTypeSetting[]; mailConfigured: boolean };
