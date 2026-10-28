package com.g123.sfems.shared.storage;

import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * Kho đối tượng (MinIO / S3), bound from {@code app.storage.*}.
 *
 * @param endpoint  địa chỉ S3 API, vd. {@code http://localhost:9000}
 * @param accessKey khoá truy cập — ghi đè bằng {@code APP_STORAGE_ACCESS_KEY} khi triển khai
 * @param secretKey khoá bí mật — ghi đè bằng {@code APP_STORAGE_SECRET_KEY} khi triển khai
 * @param bucket    bucket chứa tệp đính kèm; tự tạo nếu chưa có
 * @param region    MinIO không dùng region nhưng SDK hỏi nó trước mỗi lần gọi nếu để trống
 */
@ConfigurationProperties(prefix = "app.storage")
public record StorageProperties(String endpoint, String accessKey, String secretKey, String bucket, String region) {
}
