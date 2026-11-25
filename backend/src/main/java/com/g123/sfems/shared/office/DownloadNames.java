package com.g123.sfems.shared.office;

/** Tên tệp người dùng tải xuống: giữ dấu tiếng Việt, bỏ ký tự không hợp lệ trên Windows. */
public final class DownloadNames {

    private DownloadNames() {
    }

    public static String safe(String title) {
        if (title == null || title.isBlank()) {
            return "Báo cáo";
        }
        String name = title.replaceAll("[\\\\/:*?\"<>|\\p{Cntrl}]", "-").trim();
        return name.isEmpty() ? "Báo cáo" : name;
    }
}
