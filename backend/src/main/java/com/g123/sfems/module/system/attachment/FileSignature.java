package com.g123.sfems.module.system.attachment;

import java.nio.charset.StandardCharsets;
import java.util.Arrays;
import java.util.Map;

/**
 * Kiểm NỘI DUNG tệp khớp đuôi. Đuôi và Content-Type đều do người gửi tự khai, nên một trang HTML đặt tên
 * "anh.png" sẽ qua mọi kiểm tra chỉ nhìn tên. Ở đây đọc vài byte đầu (magic bytes) và so với đuôi;
 * Content-Type lưu lại cũng suy từ đuôi chứ không nhận của trình duyệt.
 */
final class FileSignature {

    private static final byte[] PDF = ascii("%PDF");
    private static final byte[] PNG = {(byte) 0x89, 'P', 'N', 'G'};
    private static final byte[] JPEG = {(byte) 0xFF, (byte) 0xD8, (byte) 0xFF};
    private static final byte[] GIF = ascii("GIF8");
    private static final byte[] RIFF = ascii("RIFF");
    private static final byte[] WEBP = ascii("WEBP");
    private static final byte[] ZIP = {'P', 'K', 3, 4};
    private static final byte[] OLE = {(byte) 0xD0, (byte) 0xCF, 0x11, (byte) 0xE0};

    /** Đuôi được nhận → Content-Type lưu và trả về khi tải xuống. */
    static final Map<String, String> CONTENT_TYPES = Map.ofEntries(
            Map.entry("pdf", "application/pdf"),
            Map.entry("png", "image/png"),
            Map.entry("jpg", "image/jpeg"),
            Map.entry("jpeg", "image/jpeg"),
            Map.entry("gif", "image/gif"),
            Map.entry("webp", "image/webp"),
            Map.entry("doc", "application/msword"),
            Map.entry("xls", "application/vnd.ms-excel"),
            Map.entry("ppt", "application/vnd.ms-powerpoint"),
            Map.entry("docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"),
            Map.entry("xlsx", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"),
            Map.entry("pptx", "application/vnd.openxmlformats-officedocument.presentationml.presentation"),
            Map.entry("odt", "application/vnd.oasis.opendocument.text"),
            Map.entry("ods", "application/vnd.oasis.opendocument.spreadsheet"),
            Map.entry("txt", "text/plain; charset=UTF-8"),
            Map.entry("csv", "text/csv; charset=UTF-8"),
            Map.entry("zip", "application/zip"));

    private FileSignature() {
    }

    /** {@code head}: vài KB đầu của tệp. Đuôi không có trong {@link #CONTENT_TYPES} thì luôn {@code false}. */
    static boolean matches(String extension, byte[] head) {
        return switch (extension) {
            case "pdf" -> startsWith(head, PDF);
            case "png" -> startsWith(head, PNG);
            case "jpg", "jpeg" -> startsWith(head, JPEG);
            case "gif" -> startsWith(head, GIF);
            case "webp" -> startsWith(head, RIFF) && head.length >= 12
                    && Arrays.equals(Arrays.copyOfRange(head, 8, 12), WEBP);
            case "docx", "xlsx", "pptx", "odt", "ods", "zip" -> startsWith(head, ZIP);
            case "doc", "xls", "ppt" -> startsWith(head, OLE);
            // Văn bản thuần: không có byte 0 (tệp nhị phân đổi đuôi thành .txt luôn có).
            case "txt", "csv" -> !contains(head, (byte) 0);
            default -> false;
        };
    }

    private static boolean startsWith(byte[] data, byte[] prefix) {
        return data.length >= prefix.length && Arrays.equals(Arrays.copyOf(data, prefix.length), prefix);
    }

    private static boolean contains(byte[] data, byte value) {
        for (byte b : data) {
            if (b == value) {
                return true;
            }
        }
        return false;
    }

    private static byte[] ascii(String s) {
        return s.getBytes(StandardCharsets.US_ASCII);
    }
}
