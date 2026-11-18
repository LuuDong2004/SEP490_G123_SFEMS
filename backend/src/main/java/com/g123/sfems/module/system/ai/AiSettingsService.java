package com.g123.sfems.module.system.ai;

import com.anthropic.client.AnthropicClient;
import com.anthropic.client.okhttp.AnthropicOkHttpClient;
import com.anthropic.errors.AnthropicServiceException;
import com.anthropic.models.messages.Message;
import com.anthropic.models.messages.MessageCreateParams;
import com.g123.sfems.shared.exception.ConflictException;
import com.g123.sfems.shared.exception.FieldValidationException;
import com.g123.sfems.shared.security.CurrentUser;
import com.g123.sfems.shared.security.SecretBox;
import com.g123.sfems.shared.validation.FieldRule;
import com.g123.sfems.shared.validation.Text;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;
import java.time.Duration;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

/**
 * Cấu hình AI của cả hệ thống — một dòng {@code ai_settings}: bật / tắt, khoá API (mã hoá bằng {@link SecretBox},
 * không bao giờ trả ra API — chỉ 4 ký tự cuối để nhận ra), mô hình. Khoá để trống thì dùng {@code ANTHROPIC_API_KEY}
 * của máy chủ. Mọi tính năng AI lấy client, mô hình qua đây và ghi nhật ký qua {@link #record}.
 */
@Service
public class AiSettingsService {

    /** Mô hình được chọn trên màn hình, kèm giá (USD / 1 triệu token vào, ra) để ước chi phí. */
    public record ModelOption(String id, String name, String note, double inputPrice, double outputPrice) {
    }

    public static final List<ModelOption> MODELS = List.of(
            new ModelOption("claude-haiku-5-5", "Claude Haiku 5.5", "Nhanh, rẻ nhất — đủ cho ghép danh mục đơn giản", 0.10, 0.50),
            new ModelOption("claude-sonnet-5-5", "Claude Sonnet 5.5", "Cân bằng giữa chất lượng và chi phí", 2.00, 10.00),
            new ModelOption("claude-opus-5-5", "Claude Opus 5.5", "Chính xác nhất — ghép tên thiết bị khó", 4.00, 20.00));

    public record Settings(boolean enabled, String model, boolean hasKey, String keyHint, String keySource,
            boolean available, String updatedAt, String updatedBy, List<ModelOption> models, Usage month,
            double monthlyBudgetUsd, int userHourlyLimit) {
    }

    /**
     * Một lần gọi Anthropic chờ tối đa bấy nhiêu, thử lại tối đa một lần. Mặc định của SDK là 10 phút và 2 lần thử
     * lại — trình duyệt bỏ cuộc từ lâu mà máy chủ vẫn chờ, vẫn trả tiền, vẫn giữ một luồng.
     */
    static final Duration TIMEOUT = Duration.ofSeconds(60);
    static final int MAX_RETRIES = 1;

    /** Tổng số lần gọi và token trong tháng này, kèm chi phí ước tính theo giá mô hình đã dùng. */
    public record Usage(long calls, long errors, long inputTokens, long outputTokens, double costUsd) {
    }

    public record Update(Boolean enabled,
            @Text(value = FieldRule.CODE, label = "Mô hình", max = 60) String model,
            @Size(max = 500, message = "Khoá API tối đa 500 ký tự") String apiKey,
            Boolean clearKey, BigDecimal monthlyBudgetUsd, Integer userHourlyLimit) {
    }

    public record TestResult(boolean ok, String message, long latencyMs) {
    }

    private record Row(boolean enabled, String sealedKey, String model, OffsetDateTime updatedAt, String updatedBy,
            BigDecimal budget, int hourlyLimit) {
    }

    private final JdbcTemplate jdbc;
    private final SecretBox secrets;
    private final String envKey;
    private volatile AnthropicClient client;
    private volatile String clientKey;

    public AiSettingsService(JdbcTemplate jdbc, SecretBox secrets, @Value("${app.ai.api-key:}") String envKey) {
        this.jdbc = jdbc;
        this.secrets = secrets;
        this.envKey = envKey == null ? "" : envKey.trim();
    }

    private Row row() {
        return jdbc.queryForObject("""
                SELECT a.enabled, a.api_key, a.model, a.updated_at, COALESCE(u.full_name, u.username) AS updated_by,
                       a.monthly_budget_usd, a.user_hourly_limit
                FROM ai_settings a LEFT JOIN users u ON u.id = a.updated_by_id WHERE a.id = 1
                """, (rs, i) -> new Row(rs.getBoolean("enabled"), rs.getString("api_key"), rs.getString("model"),
                rs.getObject("updated_at", OffsetDateTime.class), rs.getString("updated_by"),
                rs.getBigDecimal("monthly_budget_usd"), rs.getInt("user_hourly_limit")));
    }

    /**
     * Chặn TRƯỚC khi gọi: hết ngân sách tháng của cả hệ thống, hoặc người gọi đã gọi đủ số lần trong giờ qua. Chi phí
     * là ước tính theo token đã ghi ở {@code ai_calls}, nên lần gọi đang chạy song song có thể vượt trần một chút.
     */
    @Transactional(readOnly = true, propagation = Propagation.SUPPORTS)
    public void requireQuota() {
        Row r = row();
        double spent = monthUsage().costUsd();
        if (spent >= r.budget().doubleValue()) {
            throw new ConflictException("Đã dùng hết ngân sách AI tháng này ($%.2f / $%.2f). Quản trị viên nâng ngân sách ở màn Cấu hình AI"
                    .formatted(spent, r.budget().doubleValue()));
        }
        Long userId = CurrentUser.id().orElse(null);
        if (userId != null) {
            Integer recent = jdbc.queryForObject("""
                    SELECT COUNT(*) FROM ai_calls WHERE user_id = ? AND feature <> 'TEST' AND called_at >= now() - interval '1 hour'
                    """, Integer.class, userId);
            if (recent != null && recent >= r.hourlyLimit()) {
                throw new ConflictException("Bạn đã gọi AI %d lần trong giờ qua — thử lại sau".formatted(recent));
            }
        }
    }

    private String key(Row r) {
        if (r.sealedKey() != null && !r.sealedKey().isBlank()) {
            return secrets.open(r.sealedKey());
        }
        return envKey;
    }

    /** Có gọi AI được không: đã bật và có khoá (của màn hình hoặc của máy chủ). */
    @Transactional(readOnly = true, propagation = Propagation.SUPPORTS)
    public boolean available() {
        Row r = row();
        return r.enabled() && !key(r).isEmpty();
    }

    @Transactional(readOnly = true, propagation = Propagation.SUPPORTS)
    public String model() {
        return row().model();
    }

    /** Client theo khoá đang dùng — dựng lại khi khoá đổi. */
    public AnthropicClient client() {
        String k = key(row());
        if (k.isEmpty()) {
            throw new FieldValidationException("apiKey", "Chưa có khoá API");
        }
        AnthropicClient c = client;
        if (c == null || !k.equals(clientKey)) {
            synchronized (this) {
                if (client == null || !k.equals(clientKey)) {
                    AnthropicClient old = client;
                    client = AnthropicOkHttpClient.builder().apiKey(k).timeout(TIMEOUT).maxRetries(MAX_RETRIES).build();
                    clientKey = k;
                    // Đổi khoá thì đóng client cũ, không để lại bộ kết nối không ai dùng.
                    if (old != null) {
                        old.close();
                    }
                }
                c = client;
            }
        }
        return c;
    }

    @Transactional(readOnly = true)
    public Settings get() {
        Row r = row();
        String k = key(r);
        boolean own = r.sealedKey() != null && !r.sealedKey().isBlank();
        String source = own ? "settings" : envKey.isEmpty() ? null : "server";
        String hint = k.length() >= 4 ? "…" + k.substring(k.length() - 4) : null;
        return new Settings(r.enabled(), r.model(), !k.isEmpty(), hint, source, r.enabled() && !k.isEmpty(),
                r.updatedAt() == null ? null : r.updatedAt().toString(), r.updatedBy(), MODELS, monthUsage(),
                r.budget().doubleValue(), r.hourlyLimit());
    }

    @Transactional
    public Settings update(Update body) {
        Row r = row();
        String model = body.model() == null ? r.model() : body.model().trim();
        if (MODELS.stream().noneMatch(m -> m.id().equals(model))) {
            throw new FieldValidationException("model", "Mô hình không có trong danh sách");
        }
        String sealed = r.sealedKey();
        if (Boolean.TRUE.equals(body.clearKey())) {
            sealed = null;
        }
        if (body.apiKey() != null && !body.apiKey().isBlank()) {
            String k = body.apiKey().replaceAll("\\s", "");
            if (!k.startsWith("sk-ant-")) {
                throw new FieldValidationException("apiKey", "Khoá API của Anthropic bắt đầu bằng sk-ant-");
            }
            sealed = secrets.seal(k);
        }
        boolean enabled = body.enabled() == null ? r.enabled() : body.enabled();
        if (enabled && (sealed == null || sealed.isBlank()) && envKey.isEmpty()) {
            throw new FieldValidationException("apiKey", "Nhập khoá API trước khi bật AI");
        }
        BigDecimal budget = body.monthlyBudgetUsd() == null ? r.budget() : body.monthlyBudgetUsd();
        if (budget.signum() <= 0 || budget.compareTo(BigDecimal.valueOf(10_000)) > 0) {
            throw new FieldValidationException("monthlyBudgetUsd", "Ngân sách từ 0,01 đến 10.000 USD");
        }
        int hourly = body.userHourlyLimit() == null ? r.hourlyLimit() : body.userHourlyLimit();
        if (hourly < 1 || hourly > 1000) {
            throw new FieldValidationException("userHourlyLimit", "Số lần mỗi giờ từ 1 đến 1.000");
        }
        jdbc.update("""
                UPDATE ai_settings SET enabled = ?, api_key = ?, model = ?, monthly_budget_usd = ?, user_hourly_limit = ?,
                       updated_at = now(), updated_by_id = ? WHERE id = 1
                """, enabled, sealed, model, budget, hourly, CurrentUser.id().orElse(null));
        return get();
    }

    /** Gọi thử một câu rất ngắn với khoá và mô hình đang lưu — báo được hay lỗi gì, mất bao lâu. */
    public TestResult test() {
        Row r = row();
        if (key(r).isEmpty()) {
            return new TestResult(false, "Chưa có khoá API", 0);
        }
        long t0 = System.currentTimeMillis();
        try {
            Message m = client().messages().create(MessageCreateParams.builder()
                    .model(r.model())
                    .maxTokens(256L)
                    .addUserMessage("Trả lời đúng một từ: OK")
                    .build());
            long ms = System.currentTimeMillis() - t0;
            record("TEST", null, r.model(), 0, 0, m.usage().inputTokens(), m.usage().outputTokens(), null);
            return new TestResult(true, "Kết nối được với " + r.model(), ms);
        } catch (AnthropicServiceException e) {
            long ms = System.currentTimeMillis() - t0;
            record("TEST", null, r.model(), 0, 0, 0, 0, e.getMessage());
            return new TestResult(false, switch (e.statusCode()) {
                case 401 -> "Khoá API không đúng hoặc đã bị thu hồi";
                case 403 -> "Khoá API không có quyền dùng mô hình này";
                case 404 -> "Không tìm thấy mô hình " + r.model();
                case 429 -> "Đang bị giới hạn tần suất — thử lại sau";
                default -> "Lỗi " + e.statusCode() + ": " + e.getMessage();
            }, ms);
        } catch (RuntimeException e) {
            return new TestResult(false, "Không kết nối được tới Anthropic: " + e.getMessage(),
                    System.currentTimeMillis() - t0);
        }
    }

    /** Ghi một lần gọi. Giao dịch riêng — lần gọi lỗi vẫn để lại dấu, kể cả khi việc của người gọi lùi lại. */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void record(String feature, String reference, String model, int rowsSent, int suggestions,
            long inputTokens, long outputTokens, String error) {
        jdbc.update("""
                INSERT INTO ai_calls (user_id, feature, reference, model, rows_sent, suggestions, input_tokens,
                                      output_tokens, status, error)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, CurrentUser.id().orElse(null), feature, reference, model, rowsSent, suggestions,
                (int) inputTokens, (int) outputTokens, error == null ? "OK" : "ERROR",
                error == null ? null : error.length() > 500 ? error.substring(0, 500) : error);
    }

    @Transactional(readOnly = true)
    public List<Map<String, Object>> calls(int start, int end, boolean oldestFirst) {
        String order = oldestFirst ? "ASC" : "DESC";
        return jdbc.queryForList("""
                SELECT c.id, c.called_at AS "calledAt", COALESCE(u.full_name, u.username) AS "user", c.feature,
                       c.reference, c.model, c.rows_sent AS "rowsSent", c.suggestions, c.input_tokens AS "inputTokens",
                       c.output_tokens AS "outputTokens", c.status, c.error
                FROM ai_calls c LEFT JOIN users u ON u.id = c.user_id
                ORDER BY c.called_at %s, c.id %s OFFSET ? LIMIT ?
                """.formatted(order, order), Math.max(0, start), Math.max(0, Math.min(200, end - start)));
    }

    @Transactional(readOnly = true)
    public long countCalls() {
        Long n = jdbc.queryForObject("SELECT COUNT(*) FROM ai_calls", Long.class);
        return n == null ? 0 : n;
    }

    private Usage monthUsage() {
        List<Map<String, Object>> rows = jdbc.queryForList("""
                SELECT model, COUNT(*) AS calls, COUNT(*) FILTER (WHERE status = 'ERROR') AS errors,
                       COALESCE(SUM(input_tokens), 0) AS input, COALESCE(SUM(output_tokens), 0) AS output
                FROM ai_calls WHERE called_at >= date_trunc('month', now()) GROUP BY model
                """);
        long calls = 0;
        long errors = 0;
        long in = 0;
        long out = 0;
        double cost = 0;
        for (Map<String, Object> r : rows) {
            long i = ((Number) r.get("input")).longValue();
            long o = ((Number) r.get("output")).longValue();
            calls += ((Number) r.get("calls")).longValue();
            errors += ((Number) r.get("errors")).longValue();
            in += i;
            out += o;
            ModelOption m = MODELS.stream().filter(x -> x.id().equals(r.get("model"))).findFirst().orElse(null);
            if (m != null) {
                cost += i / 1_000_000.0 * m.inputPrice() + o / 1_000_000.0 * m.outputPrice();
            }
        }
        return new Usage(calls, errors, in, out, Math.round(cost * 10000) / 10000.0);
    }
}
