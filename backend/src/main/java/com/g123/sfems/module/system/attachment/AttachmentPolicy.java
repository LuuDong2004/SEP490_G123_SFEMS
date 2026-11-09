package com.g123.sfems.module.system.attachment;

import com.g123.sfems.shared.exception.FieldValidationException;
import java.io.IOException;
import java.io.InputStream;
import java.util.Map;
import org.springframework.web.multipart.MultipartFile;

/**
 * Luật nhận tệp đính kèm (TS-03): chỉ TÀI LIỆU (PDF, Word, Excel) và HÌNH ẢNH (JPG, PNG, WEBP, GIF),
 * tối đa {@value #MAX_MEGABYTES} MB mỗi tệp.
 *
 * <p>Không tin tên tệp hay Content-Type do trình duyệt gửi: đuôi phải nằm trong danh sách, và
 * vài byte đầu của nội dung phải khớp với đuôi đó (chữ ký tệp). Loại MIME lưu xuống là loại
 * suy ra từ đuôi trong danh sách, không lấy từ client.
 */
public final class AttachmentPolicy {

    public static final int MAX_MEGABYTES = 10;
    public static final long MAX_BYTES = MAX_MEGABYTES * 1024L * 1024L;

    /** Một loại tệp được nhận: đuôi chuẩn, MIME lưu xuống, có phải ảnh không. */
    public record Kind(String extension, String contentType, boolean image) {
    }

    private static final Map<String, Kind> KINDS = Map.of(
            "pdf", new Kind("pdf", "application/pdf", false),
            "doc", new Kind("doc", "application/msword", false),
            "docx", new Kind("docx",
                    "application/vnd.openxmlformats-officedocument.wordprocessingml.document", false),
            "xls", new Kind("xls", "application/vnd.ms-excel", false),
            "xlsx", new Kind("xlsx",
                    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", false),
            "jpg", new Kind("jpg", "image/jpeg", true),
            "jpeg", new Kind("jpeg", "image/jpeg", true),
            "png", new Kind("png", "image/png", true),
            "webp", new Kind("webp", "image/webp", true),
            "gif", new Kind("gif", "image/gif", true));

    /** Chữ ký đầu tệp theo đuôi. Đuôi không có trong bảng thì không kiểm chữ ký (đã bị loại trước). */
    private static final Map<String, byte[]> SIGNATURES = Map.of(
            "pdf", bytes(0x25, 0x50, 0x44, 0x46),                                  // %PDF
            "doc", bytes(0xD0, 0xCF, 0x11, 0xE0, 0xA1, 0xB1, 0x1A, 0xE1),         // OLE2
            "xls", bytes(0xD0, 0xCF, 0x11, 0xE0, 0xA1, 0xB1, 0x1A, 0xE1),         // OLE2
            "docx", bytes(0x50, 0x4B, 0x03, 0x04),                                 // zip
            "xlsx", bytes(0x50, 0x4B, 0x03, 0x04),                                 // zip
            "jpg", bytes(0xFF, 0xD8, 0xFF),
            "jpeg", bytes(0xFF, 0xD8, 0xFF),
            "png", bytes(0x89, 0x50, 0x4E, 0x47),
            "gif", bytes(0x47, 0x49, 0x46, 0x38),                                  // GIF8
            "webp", bytes(0x52, 0x49, 0x46, 0x46));                                // RIFF...WEBP

    private AttachmentPolicy() {
    }

    /** Kiểm tệp và trả loại đã nhận; ném {@link FieldValidationException} nếu không nhận. */
    public static Kind check(MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw new FieldValidationException("file", "Chọn tệp để đính kèm");
        }
        if (file.getSize() > MAX_BYTES) {
            throw new FieldValidationException("file", "Tệp vượt quá " + MAX_MEGABYTES + " MB");
        }
        String ext = extensionOf(file.getOriginalFilename());
        Kind kind = KINDS.get(ext);
        if (kind == null) {
            throw new FieldValidationException("file",
                    "Chỉ nhận tệp PDF, Word, Excel hoặc ảnh (JPG, PNG, WEBP, GIF)");
        }
        if (!signatureMatches(file, ext)) {
            throw new FieldValidationException("file", "Nội dung tệp không khớp với đuôi ." + ext);
        }
        return kind;
    }

    /** Tên tệp để hiện: bỏ đường dẫn thư mục do trình duyệt có thể gửi kèm. */
    public static String displayName(String original) {
        if (original == null || original.isBlank()) {
            return "tệp";
        }
        String name = original.replace('\\', '/');
        name = name.substring(name.lastIndexOf('/') + 1).trim();
        if (name.length() > 255) {
            name = name.substring(name.length() - 255);
        }
        return name.isEmpty() ? "tệp" : name;
    }

    public static Kind kindOf(String extension) {
        return KINDS.get(extension);
    }

    private static String extensionOf(String original) {
        String name = displayName(original);
        int dot = name.lastIndexOf('.');
        return dot < 0 ? "" : name.substring(dot + 1).toLowerCase(java.util.Locale.ROOT);
    }

    private static boolean signatureMatches(MultipartFile file, String ext) {
        byte[] head = readHead(file, 12);
        if (ext.equals("webp")) {
            return startsWith(head, 0, SIGNATURES.get("webp")) && startsWith(head, 8, bytes(0x57, 0x45, 0x42, 0x50));
        }
        byte[] signature = SIGNATURES.get(ext);
        return signature != null && startsWith(head, 0, signature);
    }

    private static byte[] readHead(MultipartFile file, int length) {
        try (InputStream in = file.getInputStream()) {
            return in.readNBytes(length);
        } catch (IOException e) {
            throw new FieldValidationException("file", "Không đọc được tệp");
        }
    }

    private static boolean startsWith(byte[] data, int offset, byte[] prefix) {
        if (data.length < offset + prefix.length) {
            return false;
        }
        for (int i = 0; i < prefix.length; i++) {
            if (data[offset + i] != prefix[i]) {
                return false;
            }
        }
        return true;
    }

    private static byte[] bytes(int... values) {
        byte[] out = new byte[values.length];
        for (int i = 0; i < values.length; i++) {
            out[i] = (byte) values[i];
        }
        return out;
    }
}
