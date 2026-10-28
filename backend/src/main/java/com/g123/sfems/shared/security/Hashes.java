package com.g123.sfems.shared.security;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.util.Base64;
import java.util.HexFormat;

/** Băm SHA-256 và sinh chuỗi ngẫu nhiên cho mã một lần (mã email, token đặt lại mật khẩu). */
public final class Hashes {

    private static final SecureRandom RANDOM = new SecureRandom();

    private Hashes() {
    }

    public static String sha256(String value) {
        try {
            byte[] digest = MessageDigest.getInstance("SHA-256").digest(value.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(digest);
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException(e);
        }
    }

    /** Mã {@code digits} chữ số, có thể bắt đầu bằng 0. */
    public static String digits(int digits) {
        StringBuilder out = new StringBuilder(digits);
        for (int i = 0; i < digits; i++) {
            out.append(RANDOM.nextInt(10));
        }
        return out.toString();
    }

    /** Token dùng trong URL: {@code bytes} byte ngẫu nhiên, base64url không đệm. */
    public static String urlToken(int bytes) {
        byte[] raw = new byte[bytes];
        RANDOM.nextBytes(raw);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(raw);
    }
}
