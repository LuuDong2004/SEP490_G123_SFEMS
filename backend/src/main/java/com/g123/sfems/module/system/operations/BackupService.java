package com.g123.sfems.module.system.operations;

import java.io.File;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.locks.ReentrantLock;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Stream;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

/**
 * Sao lưu cơ sở dữ liệu bằng {@code pg_dump} định dạng custom ({@code -Fc}) — nén
 * sẵn, và {@code pg_restore} khôi phục được từng bảng nếu cần.
 *
 * <p>Gọi công cụ của chính PostgreSQL chứ không tự đọc bảng ra: bản sao lưu
 * tự viết sẽ thiếu đúng thứ bạn cần lúc khôi phục (sequence, ràng buộc, chỉ
 * mục, bảng changelog của Liquibase). Khôi phục ({@link #restore}, QLTB-247) chạy
 * {@code pg_restore --clean --single-transaction}: TRƯỚC đó luôn sao lưu bản hiện
 * tại, và cả lần khôi phục là một giao dịch — lỗi giữa chừng thì cơ sở dữ liệu
 * nguyên như cũ. Nó ghi đè toàn bộ dữ liệu đang chạy, nên màn hình đòi gõ lại
 * tên bản sao lưu và mật khẩu; xong phải khởi động lại máy chủ ứng dụng để nạp
 * lại bộ đệm (quyền, phạm vi dữ liệu) và để Liquibase đưa cấu trúc về bản mới.
 *
 * <p>Giữ {@code app.backup.retention} bản mới nhất, xoá bản cũ hơn. Thư mục sao
 * lưu nên là ổ khác máy chủ ứng dụng — cùng một ổ đĩa thì hỏng ổ là mất cả hai.
 */
@Service
public class BackupService {

    private static final Logger log = LoggerFactory.getLogger(BackupService.class);
    private static final Pattern JDBC = Pattern.compile("jdbc:postgresql://([^:/]+)(?::(\\d+))?/([^?]+).*");
    private static final DateTimeFormatter STAMP = DateTimeFormatter.ofPattern("yyyyMMdd-HHmmss");

    public record BackupFile(String name, long size, Instant createdAt) {
    }

    public record Result(boolean success, String file, long size, long millis, String message) {
    }

    /** Tên tệp sao lưu hợp lệ — không có thư mục, không có "..": tên đi thẳng vào dòng lệnh và đường dẫn. */
    private static final Pattern FILE_NAME = Pattern.compile("[A-Za-z0-9._-]+\\.dump");

    private final String pgDump;
    private final String pgRestore;
    private final Path dir;
    private final int retention;
    private final String url;
    private final String username;
    private final String password;
    private final ReentrantLock running = new ReentrantLock();

    public BackupService(@Value("${app.backup.pg-dump:pg_dump}") String pgDump,
            @Value("${app.backup.pg-restore:}") String pgRestore,
            @Value("${app.backup.dir:./backups}") String dir,
            @Value("${app.backup.retention:14}") int retention,
            @Value("${spring.datasource.url}") String url,
            @Value("${spring.datasource.username}") String username,
            @Value("${spring.datasource.password}") String password) {
        this.pgDump = pgDump;
        // Chưa khai riêng thì pg_restore nằm cạnh pg_dump (cùng thư mục bin của PostgreSQL).
        this.pgRestore = pgRestore == null || pgRestore.isBlank() ? pgDump.replace("pg_dump", "pg_restore") : pgRestore;
        this.dir = Path.of(dir).toAbsolutePath().normalize();
        this.retention = Math.max(retention, 1);
        this.url = url;
        this.username = username;
        this.password = password;
    }

    public Path directory() {
        return dir;
    }

    public List<BackupFile> list() {
        if (!Files.isDirectory(dir)) {
            return List.of();
        }
        try (Stream<Path> files = Files.list(dir)) {
            return files.filter(p -> p.getFileName().toString().endsWith(".dump"))
                    .map(p -> {
                        File f = p.toFile();
                        return new BackupFile(f.getName(), f.length(), Instant.ofEpochMilli(f.lastModified()));
                    })
                    .sorted(Comparator.comparing(BackupFile::createdAt).reversed())
                    .toList();
        } catch (IOException e) {
            return List.of();
        }
    }

    /** Chạy một lần sao lưu. Hai lần cùng lúc thì lần sau từ chối, không xếp hàng. */
    public Result run() {
        if (!running.tryLock()) {
            return new Result(false, null, 0, 0, "Đang có một lần sao lưu khác chạy");
        }
        long started = System.currentTimeMillis();
        try {
            Matcher m = JDBC.matcher(url);
            if (!m.matches()) {
                return new Result(false, null, 0, 0, "Không đọc được địa chỉ cơ sở dữ liệu: " + url);
            }
            Files.createDirectories(dir);
            Path target = dir.resolve("qltb-" + LocalDateTime.now().format(STAMP) + ".dump");
            List<String> command = new ArrayList<>(List.of(pgDump, "-h", m.group(1), "-p",
                    m.group(2) == null ? "5432" : m.group(2), "-U", username, "-Fc", "--no-owner", "-f",
                    target.toString(), m.group(3)));
            ProcessBuilder pb = new ProcessBuilder(command).redirectErrorStream(true);
            // Mật khẩu qua biến môi trường, không qua dòng lệnh — dòng lệnh thì
            // ai liệt kê tiến trình trên máy cũng đọc được.
            pb.environment().put("PGPASSWORD", password);
            Process process = pb.start();
            String output = new String(process.getInputStream().readAllBytes(), StandardCharsets.UTF_8);
            boolean done = process.waitFor(30, TimeUnit.MINUTES);
            if (!done) {
                process.destroyForcibly();
                return new Result(false, null, 0, System.currentTimeMillis() - started, "pg_dump quá 30 phút");
            }
            if (process.exitValue() != 0) {
                Files.deleteIfExists(target);
                log.error("Sao lưu thất bại: {}", output);
                return new Result(false, null, 0, System.currentTimeMillis() - started,
                        "pg_dump lỗi: " + output.strip());
            }
            prune();
            long size = Files.size(target);
            log.info("Đã sao lưu {} ({} byte)", target, size);
            return new Result(true, target.getFileName().toString(), size, System.currentTimeMillis() - started,
                    "Đã sao lưu");
        } catch (IOException e) {
            return new Result(false, null, 0, System.currentTimeMillis() - started,
                    "Không chạy được pg_dump (" + pgDump + "): " + e.getMessage());
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            return new Result(false, null, 0, System.currentTimeMillis() - started, "Bị ngắt");
        } finally {
            running.unlock();
        }
    }

    /**
     * Khôi phục từ một bản sao lưu trong thư mục sao lưu. Luôn sao lưu bản hiện tại trước (bản đó vào danh sách, khôi
     * phục ngược lại được nếu chọn nhầm); không sao lưu được thì không khôi phục.
     */
    public Result restore(String fileName) {
        if (fileName == null || !FILE_NAME.matcher(fileName).matches()) {
            return new Result(false, null, 0, 0, "Tên bản sao lưu không hợp lệ");
        }
        Path source = dir.resolve(fileName).normalize();
        if (!source.startsWith(dir) || !Files.isRegularFile(source)) {
            return new Result(false, null, 0, 0, "Không có bản sao lưu " + fileName);
        }
        Result safety = run();
        if (!safety.success()) {
            return new Result(false, null, 0, 0, "Chưa khôi phục: không sao lưu được bản hiện tại — " + safety.message());
        }
        if (!running.tryLock()) {
            return new Result(false, null, 0, 0, "Đang có một lần sao lưu / khôi phục khác chạy");
        }
        long started = System.currentTimeMillis();
        try {
            Matcher m = JDBC.matcher(url);
            if (!m.matches()) {
                return new Result(false, null, 0, 0, "Không đọc được địa chỉ cơ sở dữ liệu: " + url);
            }
            List<String> command = List.of(pgRestore, "-h", m.group(1), "-p", m.group(2) == null ? "5432" : m.group(2),
                    "-U", username, "-d", m.group(3), "--clean", "--if-exists", "--no-owner", "--single-transaction",
                    source.toString());
            ProcessBuilder pb = new ProcessBuilder(command).redirectErrorStream(true);
            pb.environment().put("PGPASSWORD", password);
            Process process = pb.start();
            String output = new String(process.getInputStream().readAllBytes(), StandardCharsets.UTF_8);
            boolean done = process.waitFor(60, TimeUnit.MINUTES);
            if (!done) {
                process.destroyForcibly();
                return new Result(false, null, 0, System.currentTimeMillis() - started, "pg_restore quá 60 phút");
            }
            if (process.exitValue() != 0) {
                log.error("Khôi phục {} thất bại: {}", fileName, output);
                return new Result(false, null, 0, System.currentTimeMillis() - started,
                        "pg_restore lỗi (cơ sở dữ liệu giữ nguyên): " + output.strip());
            }
            log.warn("Đã khôi phục cơ sở dữ liệu từ {} — bản trước khi khôi phục: {}", fileName, safety.file());
            return new Result(true, fileName, Files.size(source), System.currentTimeMillis() - started,
                    "Đã khôi phục từ " + fileName + ". Bản trước khi khôi phục: " + safety.file()
                            + ". Khởi động lại máy chủ ứng dụng để nạp lại bộ đệm.");
        } catch (IOException e) {
            return new Result(false, null, 0, System.currentTimeMillis() - started,
                    "Không chạy được pg_restore (" + pgRestore + "): " + e.getMessage());
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            return new Result(false, null, 0, System.currentTimeMillis() - started, "Bị ngắt");
        } finally {
            running.unlock();
        }
    }

    private void prune() {
        List<BackupFile> files = list();
        for (int i = retention; i < files.size(); i++) {
            try {
                Files.deleteIfExists(dir.resolve(files.get(i).name()));
            } catch (IOException e) {
                log.warn("Không xoá được bản sao lưu cũ {}", files.get(i).name());
            }
        }
    }
}
