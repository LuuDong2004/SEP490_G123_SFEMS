package com.g123.sfems.shared.storage;

import io.minio.BucketExistsArgs;
import io.minio.GetObjectArgs;
import io.minio.MakeBucketArgs;
import io.minio.MinioClient;
import io.minio.PutObjectArgs;
import io.minio.RemoveObjectArgs;
import java.io.InputStream;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.stereotype.Component;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

/**
 * Nội dung tệp trong MinIO; database chỉ giữ khoá đối tượng.
 *
 * <p>Hai kho không chung một giao dịch, nên thứ tự là thứ giữ chúng khớp nhau:
 * <ul>
 *   <li><b>Ghi</b>: đẩy đối tượng lên TRƯỚC rồi mới lưu dòng; giao dịch lùi lại thì
 *       {@link #putInTransaction} xoá đối tượng vừa đẩy. Làm ngược lại thì có lúc database
 *       trỏ vào một đối tượng không tồn tại — tệp "có trong danh sách mà không tải được".</li>
 *   <li><b>Xoá</b>: xoá dòng trước, xoá đối tượng SAU khi giao dịch commit
 *       ({@link #deleteAfterCommit}). Lùi lại thì đối tượng còn nguyên cho dòng còn nguyên.</li>
 * </ul>
 * Lỗi xoá đối tượng chỉ ghi log: một đối tượng mồ côi tốn chỗ, không làm sai dữ liệu.
 *
 * <p>Bucket được kiểm / tạo ở lần dùng đầu, không lúc khởi động: MinIO chưa lên thì ứng
 * dụng vẫn chạy, chỉ tải tệp là báo lỗi.
 */
@Component
@EnableConfigurationProperties(StorageProperties.class)
public class ObjectStorage {

    private static final Logger log = LoggerFactory.getLogger(ObjectStorage.class);
    /** Phần nhỏ nhất MinIO cho phép khi chưa biết kích thước (5 MB). */
    private static final long PART_SIZE = 5L * 1024 * 1024;

    private final MinioClient client;
    private final String bucket;
    private volatile boolean bucketReady;

    public ObjectStorage(StorageProperties props) {
        MinioClient.Builder builder = MinioClient.builder()
                .endpoint(props.endpoint())
                .credentials(props.accessKey(), props.secretKey());
        if (props.region() != null && !props.region().isBlank()) {
            builder.region(props.region());
        }
        this.client = builder.build();
        this.bucket = props.bucket();
    }

    public void put(String key, InputStream content, long size, String contentType) {
        ensureBucket();
        try {
            client.putObject(PutObjectArgs.builder()
                    .bucket(bucket).object(key)
                    .stream(content, size, size < 0 ? PART_SIZE : -1)
                    .contentType(contentType)
                    .build());
        } catch (Exception e) {
            throw new StorageException("Không lưu được tệp vào kho lưu trữ", e);
        }
    }

    /** {@link #put}, và gỡ đối tượng đi nếu giao dịch đang chạy bị lùi lại. */
    public void putInTransaction(String key, InputStream content, long size, String contentType) {
        put(key, content, size, contentType);
        if (TransactionSynchronizationManager.isSynchronizationActive()) {
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                @Override
                public void afterCompletion(int status) {
                    if (status != STATUS_COMMITTED) {
                        deleteQuietly(key);
                    }
                }
            });
        }
    }

    /** Luồng đọc nội dung — người gọi phải đóng. */
    public InputStream get(String key) {
        ensureBucket();
        try {
            return client.getObject(GetObjectArgs.builder().bucket(bucket).object(key).build());
        } catch (Exception e) {
            throw new StorageException("Không đọc được tệp từ kho lưu trữ", e);
        }
    }

    /** Xoá đối tượng khi giao dịch hiện tại commit; không có giao dịch thì xoá ngay. */
    public void deleteAfterCommit(String key) {
        if (key == null) {
            return;
        }
        if (TransactionSynchronizationManager.isSynchronizationActive()) {
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                @Override
                public void afterCommit() {
                    deleteQuietly(key);
                }
            });
        } else {
            deleteQuietly(key);
        }
    }

    private void deleteQuietly(String key) {
        try {
            client.removeObject(RemoveObjectArgs.builder().bucket(bucket).object(key).build());
        } catch (Exception e) {
            log.warn("Không xoá được đối tượng {} khỏi bucket {} — để lại mồ côi", key, bucket, e);
        }
    }

    private void ensureBucket() {
        if (bucketReady) {
            return;
        }
        synchronized (this) {
            if (bucketReady) {
                return;
            }
            try {
                if (!client.bucketExists(BucketExistsArgs.builder().bucket(bucket).build())) {
                    client.makeBucket(MakeBucketArgs.builder().bucket(bucket).build());
                    log.info("Đã tạo bucket {}", bucket);
                }
                bucketReady = true;
            } catch (Exception e) {
                throw new StorageException("Kho lưu trữ tệp không truy cập được", e);
            }
        }
    }

    /** Kho tệp hỏng hoặc không tới được — {@code ApiExceptionHandler} trả 503. */
    public static class StorageException extends RuntimeException {
        public StorageException(String message, Throwable cause) {
            super(message, cause);
        }
    }
}
