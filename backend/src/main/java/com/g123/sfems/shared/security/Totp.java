package com.g123.sfems.shared.security;

import java.net.URLEncoder;
import java.nio.ByteBuffer;
import java.nio.charset.StandardCharsets;
import java.security.GeneralSecurityException;
import java.security.MessageDigest;
import java.security.SecureRandom;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;

/**
 * Mã một lần theo thời gian (TOTP, RFC 6238): HMAC-SHA1, bước 30 giây, 6 chữ số
 * — đúng bộ tham số mà Google Authenticator, Microsoft Authenticator và mọi ứng
 * dụng xác thực phổ biến mặc định dùng. Đổi một tham số là mã sinh ra trên điện
 * thoại không khớp nữa.
 *
 * <p>Chấp nhận lệch một bước mỗi phía (±30 giây) cho đồng hồ điện thoại chạy lệch.
 * So sánh bằng {@link MessageDigest#isEqual} để thời gian so không để lộ số chữ
 * số đúng.
 */
public final class Totp {

    private static final SecureRandom RANDOM = new SecureRandom();
    private static final String BASE32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
    private static final int DIGITS = 6;
    private static final long STEP_SECONDS = 30;

    private Totp() {
    }

    /** 160 bit ngẫu nhiên, mã base32 — độ dài RFC 4226 khuyến nghị cho HMAC-SHA1. */
    public static String newSecret() {
        byte[] bytes = new byte[20];
        RANDOM.nextBytes(bytes);
        return base32(bytes);
    }

    public static boolean verify(String secret, String code, long epochSeconds) {
        return matchedStep(secret, code, epochSeconds) >= 0;
    }

    /**
     * Bước thời gian (epoch / 30 giây) mà mã khớp, lệch tối đa một bước; {@code -1} nếu không khớp. Lưu bước đã dùng
     * và từ chối bước không mới hơn là cách chặn một mã bị nhìn trộm được dùng lại trong khoảng còn hiệu lực.
     */
    public static long matchedStep(String secret, String code, long epochSeconds) {
        if (code == null) {
            return -1;
        }
        String digits = code.replaceAll("\\s", "");
        if (!digits.matches("\\d{" + DIGITS + "}")) {
            return -1;
        }
        long counter = epochSeconds / STEP_SECONDS;
        byte[] given = digits.getBytes(StandardCharsets.US_ASCII);
        long matched = -1;
        for (long drift = -1; drift <= 1; drift++) {
            if (MessageDigest.isEqual(given, code(secret, counter + drift).getBytes(StandardCharsets.US_ASCII))) {
                matched = counter + drift;
            }
        }
        return matched;
    }

    /** Mã của một bước — cho kiểm thử. */
    public static String code(String secret, long counter) {
        try {
            Mac mac = Mac.getInstance("HmacSHA1");
            mac.init(new SecretKeySpec(unbase32(secret), "HmacSHA1"));
            byte[] hash = mac.doFinal(ByteBuffer.allocate(8).putLong(counter).array());
            int offset = hash[hash.length - 1] & 0x0f;
            int binary = ((hash[offset] & 0x7f) << 24) | ((hash[offset + 1] & 0xff) << 16)
                    | ((hash[offset + 2] & 0xff) << 8) | (hash[offset + 3] & 0xff);
            return String.format("%0" + DIGITS + "d", binary % 1_000_000);
        } catch (GeneralSecurityException e) {
            throw new IllegalStateException(e);
        }
    }

    /** URI để ứng dụng xác thực quét bằng mã QR. */
    public static String otpauthUri(String issuer, String account, String secret) {
        String label = URLEncoder.encode(issuer + ":" + account, StandardCharsets.UTF_8).replace("+", "%20");
        return "otpauth://totp/" + label + "?secret=" + secret + "&issuer="
                + URLEncoder.encode(issuer, StandardCharsets.UTF_8).replace("+", "%20")
                + "&algorithm=SHA1&digits=" + DIGITS + "&period=" + STEP_SECONDS;
    }

    static String base32(byte[] data) {
        StringBuilder out = new StringBuilder();
        int buffer = 0;
        int bits = 0;
        for (byte b : data) {
            buffer = (buffer << 8) | (b & 0xff);
            bits += 8;
            while (bits >= 5) {
                out.append(BASE32.charAt((buffer >> (bits - 5)) & 31));
                bits -= 5;
            }
        }
        if (bits > 0) {
            out.append(BASE32.charAt((buffer << (5 - bits)) & 31));
        }
        return out.toString();
    }

    static byte[] unbase32(String text) {
        String s = text.replace("=", "").replace(" ", "").toUpperCase();
        ByteBuffer out = ByteBuffer.allocate(s.length() * 5 / 8);
        int buffer = 0;
        int bits = 0;
        for (char ch : s.toCharArray()) {
            int v = BASE32.indexOf(ch);
            if (v < 0) {
                throw new IllegalArgumentException("Không phải base32");
            }
            buffer = (buffer << 5) | v;
            bits += 5;
            if (bits >= 8) {
                out.put((byte) ((buffer >> (bits - 8)) & 0xff));
                bits -= 8;
            }
        }
        return out.array();
    }
}
