package com.g123.sfems.module.system.operations;

import com.g123.sfems.shared.cache.SharedCache;
import java.io.File;
import java.lang.management.ManagementFactory;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

/**
 * Tình trạng vận hành trên một màn: cơ sở dữ liệu còn trả lời không và lớn cỡ
 * nào, ổ đĩa còn bao nhiêu, bản sao lưu gần nhất lúc nào, ứng dụng chạy bao lâu,
 * dùng bao nhiêu bộ nhớ — và các CẢNH BÁO rút ra từ đó theo ngưỡng cấu hình.
 *
 * <p>Cảnh báo được tính ở đây, một chỗ, để màn hình và việc gửi thông báo hằng
 * ngày ({@link CapacityAlertJob}) không bao giờ nói hai điều khác nhau.
 */
@Service
public class SystemStatusService {

    public record TableSize(String table, long bytes, long rows) {
    }

    public record Alert(String level, String message) {
    }

    public record Status(boolean databaseUp, long databaseBytes, List<TableSize> largestTables, long attachmentBytes,
            long diskFreeBytes, long diskTotalBytes, String backupDir, List<BackupService.BackupFile> backups,
            Instant lastBackupAt, long uptimeSeconds, long heapUsedBytes, long heapMaxBytes, int activeUsers24h,
            int writes24h, int failedWrites24h, SharedCache.Stats cache, List<Alert> alerts) {
    }

    private final JdbcTemplate jdbc;
    private final BackupService backups;
    private final SharedCache shared;
    private final long minFreeBytes;
    private final long maxDatabaseBytes;
    private final Duration maxBackupAge;

    public SystemStatusService(JdbcTemplate jdbc, BackupService backups, SharedCache shared,
            @Value("${app.capacity.disk-min-free-gb:5}") long minFreeGb,
            @Value("${app.capacity.database-max-gb:50}") long maxDatabaseGb,
            @Value("${app.backup.max-age-hours:36}") long maxBackupAgeHours) {
        this.jdbc = jdbc;
        this.backups = backups;
        this.shared = shared;
        this.minFreeBytes = minFreeGb * 1024 * 1024 * 1024;
        this.maxDatabaseBytes = maxDatabaseGb * 1024 * 1024 * 1024;
        this.maxBackupAge = Duration.ofHours(maxBackupAgeHours);
    }

    public Status status() {
        boolean up;
        long dbBytes = 0;
        List<TableSize> tables = List.of();
        long attachments = 0;
        int active = 0;
        int writes = 0;
        int failed = 0;
        try {
            dbBytes = jdbc.queryForObject("SELECT pg_database_size(current_database())", Long.class);
            tables = jdbc.query("""
                    SELECT c.relname, pg_total_relation_size(c.oid), GREATEST(c.reltuples, 0)::bigint
                    FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
                    WHERE n.nspname = 'public' AND c.relkind = 'r'
                    ORDER BY 2 DESC LIMIT 8""",
                    (rs, i) -> new TableSize(rs.getString(1), rs.getLong(2), rs.getLong(3)));
            attachments = jdbc.queryForObject("SELECT COALESCE(SUM(size_bytes), 0) FROM attachments", Long.class);
            active = jdbc.queryForObject(
                    "SELECT COUNT(*) FROM users WHERE last_login_at > now() - INTERVAL '24 hours'", Integer.class);
            Map<String, Object> w = jdbc.queryForMap("""
                    SELECT COUNT(*) AS writes, COUNT(*) FILTER (WHERE status_code >= 400) AS failed
                    FROM activity_logs WHERE created_at > now() - INTERVAL '24 hours'""");
            writes = ((Number) w.get("writes")).intValue();
            failed = ((Number) w.get("failed")).intValue();
            up = true;
        } catch (RuntimeException e) {
            up = false;
        }
        File disk = backups.directory().toFile().exists() ? backups.directory().toFile() : new File(".");
        List<BackupService.BackupFile> files = backups.list();
        Instant last = files.isEmpty() ? null : files.get(0).createdAt();
        Runtime rt = Runtime.getRuntime();

        List<Alert> alerts = new ArrayList<>();
        if (!up) {
            alerts.add(new Alert("destructive", "Cơ sở dữ liệu không trả lời"));
        }
        if (disk.getUsableSpace() < minFreeBytes) {
            alerts.add(new Alert("destructive", "Ổ đĩa còn dưới %d GB trống".formatted(minFreeBytes >> 30)));
        }
        if (dbBytes > maxDatabaseBytes) {
            alerts.add(new Alert("warning", "Cơ sở dữ liệu vượt %d GB — xem lại dung lượng máy chủ"
                    .formatted(maxDatabaseBytes >> 30)));
        }
        SharedCache.Stats cache = shared.stats();
        if (cache.configured() && !cache.up()) {
            // Không phải sự cố dữ liệu: hệ thống đọc thẳng CSDL, chỉ chậm hơn và đăng xuất không cắt phiên ngay.
            alerts.add(new Alert("warning", "Bộ nhớ đệm (Redis) không trả lời — hệ thống đang đọc thẳng cơ sở dữ liệu"));
        }
        if (last == null) {
            alerts.add(new Alert("warning", "Chưa có bản sao lưu nào trong " + backups.directory()));
        } else if (last.isBefore(Instant.now().minus(maxBackupAge))) {
            alerts.add(new Alert("warning", "Bản sao lưu gần nhất đã quá %d giờ".formatted(maxBackupAge.toHours())));
        }
        return new Status(up, dbBytes, tables, attachments, disk.getUsableSpace(), disk.getTotalSpace(),
                backups.directory().toString(), files, last,
                ManagementFactory.getRuntimeMXBean().getUptime() / 1000, rt.totalMemory() - rt.freeMemory(),
                rt.maxMemory(), active, writes, failed, cache, alerts);
    }
}
