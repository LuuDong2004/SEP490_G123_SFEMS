package com.g123.sfems.shared.security;

import java.nio.ByteBuffer;
import java.nio.charset.StandardCharsets;
import java.security.GeneralSecurityException;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.util.Base64;
import javax.crypto.Cipher;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.SecretKeySpec;
import org.springframework.stereotype.Component;

/**
 * Mã hoá đối xứng (AES-256-GCM) cho bí mật phải lưu mà không được để lộ khi cơ
 * sở dữ liệu lộ — hiện là bí mật TOTP.
 *
 * <p>Khoá dẫn từ {@code app.security.jwt.secret} qua SHA-256 với một nhãn riêng,
 * nên không có thêm một bí mật cấu hình nào phải quản lý, mà khoá này cũng không
 * trùng khoá ký token. Hệ quả cần biết: ĐỔI bí mật JWT thì các bí mật TOTP đã
 * lưu không giải mã được nữa, và mọi người đã bật xác thực hai yếu tố phải được
 * quản trị viên đặt lại.
 */
@Component
public class SecretBox {

    private static final SecureRandom RANDOM = new SecureRandom();
    private static final int IV_BYTES = 12;

    private final SecretKeySpec key;

    public SecretBox(JwtProperties properties) {
        try {
            byte[] digest = MessageDigest.getInstance("SHA-256")
                    .digest(("qltb-secret-box:" + properties.secret()).getBytes(StandardCharsets.UTF_8));
            this.key = new SecretKeySpec(digest, "AES");
        } catch (GeneralSecurityException e) {
            throw new IllegalStateException(e);
        }
    }

    public String seal(String plain) {
        try {
            byte[] iv = new byte[IV_BYTES];
            RANDOM.nextBytes(iv);
            Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(Cipher.ENCRYPT_MODE, key, new GCMParameterSpec(128, iv));
            byte[] sealed = cipher.doFinal(plain.getBytes(StandardCharsets.UTF_8));
            return Base64.getEncoder().encodeToString(ByteBuffer.allocate(iv.length + sealed.length)
                    .put(iv).put(sealed).array());
        } catch (GeneralSecurityException e) {
            throw new IllegalStateException(e);
        }
    }

    public String open(String sealed) {
        try {
            byte[] all = Base64.getDecoder().decode(sealed);
            Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(Cipher.DECRYPT_MODE, key, new GCMParameterSpec(128, all, 0, IV_BYTES));
            return new String(cipher.doFinal(all, IV_BYTES, all.length - IV_BYTES), StandardCharsets.UTF_8);
        } catch (GeneralSecurityException | IllegalArgumentException e) {
            throw new IllegalStateException("Không giải mã được bí mật đã lưu — bí mật JWT đã đổi?", e);
        }
    }
}
