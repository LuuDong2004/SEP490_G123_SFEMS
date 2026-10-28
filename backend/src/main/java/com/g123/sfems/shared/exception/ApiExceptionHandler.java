package com.g123.sfems.shared.exception;

import com.g123.sfems.shared.security.rowlevel.PolicyValidationException;
import com.g123.sfems.shared.security.rowlevel.RowLevelViolationException;
import jakarta.validation.ConstraintViolationException;
import java.sql.SQLException;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import org.postgresql.util.PSQLException;
import org.postgresql.util.ServerErrorMessage;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.core.AuthenticationException;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.ErrorResponse;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import com.g123.sfems.shared.storage.ObjectStorage;
import org.slf4j.LoggerFactory;

/**
 * Turns the exceptions the controllers and the security filter chain can raise
 * into a JSON body.
 *
 * <p>A body is not optional here: the data provider calls {@code response.json()}
 * on every non-2xx response, so an empty error payload surfaces in the admin UI
 * as an unparseable-response error instead of the real message.
 */
@RestControllerAdvice
public class ApiExceptionHandler {

    @ExceptionHandler(ResourceNotFoundException.class)
    public ResponseEntity<Map<String, Object>> handleNotFound(ResourceNotFoundException e) {
        return body(HttpStatus.NOT_FOUND, e.getMessage(), Map.of());
    }

    /**
     * A username already taken, or a role that is still assigned being deleted.
     */
    /** Kho tệp (MinIO) không tới được: lỗi hạ tầng tạm thời, không phải lỗi của yêu cầu. */
    @ExceptionHandler(ObjectStorage.StorageException.class)
    public ResponseEntity<Map<String, Object>> handleStorage(ObjectStorage.StorageException e) {
        LoggerFactory.getLogger(ApiExceptionHandler.class).error(e.getMessage(), e);
        return body(HttpStatus.SERVICE_UNAVAILABLE, e.getMessage() + " — thử lại sau hoặc báo quản trị viên", Map.of());
    }

    @ExceptionHandler(ConflictException.class)
    public ResponseEntity<Map<String, Object>> handleConflict(ConflictException e) {
        return body(HttpStatus.CONFLICT, e.getMessage(), Map.of());
    }

    /**
     * Wrong username or password.
     *
     * <p>Deliberately the same message whichever half was wrong: saying which
     * one turns the login form into a way to find out whether an account
     * exists. It is separated from the handler below only so that the message
     * can be about credentials rather than about a token.
     */
    @ExceptionHandler(com.g123.sfems.shared.security.MfaRequiredException.class)
    public ResponseEntity<Map<String, Object>> handleMfaRequired(com.g123.sfems.shared.security.MfaRequiredException e) {
        ResponseEntity<Map<String, Object>> response = body(HttpStatus.UNAUTHORIZED, e.getMessage(), Map.of());
        response.getBody().put("mfaRequired", true);
        response.getBody().put("mfaMethod", e.getMethod());
        return response;
    }

    @ExceptionHandler(BadCredentialsException.class)
    public ResponseEntity<Map<String, Object>> handleBadCredentials(BadCredentialsException e) {
        return body(HttpStatus.UNAUTHORIZED, e.getMessage(), Map.of());
    }

    /**
     * No access token, or one that is expired, tampered with or not ours.
     *
     * <p>Reached from the security filter chain rather than from a controller,
     * via {@code RestAuthenticationEntryPoint}. The admin UI treats a 401 on any
     * request as its cue to refresh the token and, failing that, to sign out —
     * so this needs a body like every other error, or that path never runs.
     */
    @ExceptionHandler(AuthenticationException.class)
    public ResponseEntity<Map<String, Object>> handleUnauthenticated(AuthenticationException e) {
        return body(HttpStatus.UNAUTHORIZED, "Phiên đăng nhập đã hết hạn hoặc không hợp lệ — hãy đăng nhập lại", Map.of());
    }

    /**
     * A valid token without the permission the endpoint asks for.
     *
     * <p>Covers both the filter chain and the {@code @PreAuthorize} annotations,
     * whose {@code AuthorizationDeniedException} is an {@code AccessDeniedException}.
     * Distinct from a 401 on purpose: the admin UI must not try to refresh a
     * token that is working exactly as intended.
     */
    @ExceptionHandler(AccessDeniedException.class)
    public ResponseEntity<Map<String, Object>> handleAccessDenied(AccessDeniedException e) {
        return body(HttpStatus.FORBIDDEN, "Bạn không có quyền thực hiện thao tác này", Map.of());
    }

    /** Field-level bean validation failures on a {@code @Valid} request body. */
    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<Map<String, Object>> handleInvalidBody(MethodArgumentNotValidException e) {
        Map<String, Object> errors = new LinkedHashMap<>();
        e.getBindingResult().getFieldErrors().forEach(error ->
                errors.putIfAbsent(error.getField(), error.getDefaultMessage()));

        // Câu chung mang luôn lỗi đầu tiên: ô sai không phải lúc nào cũng có mặt trên form (trường nằm
        // trong hộp thoại con, trường máy tự gửi), và khi đó "Dữ liệu chưa hợp lệ" trơ trọi không nói
        // phải sửa gì.
        return body(HttpStatus.UNPROCESSABLE_CONTENT, invalid(errors), errors);
    }

    private static String invalid(Map<String, Object> errors) {
        return errors.values().stream().findFirst()
                .map(first -> "Dữ liệu chưa hợp lệ: " + first)
                .orElse("Dữ liệu chưa hợp lệ");
    }

    /** Quy tắc nghiệp vụ theo trường — cùng hình dạng 422 với lỗi {@code @Valid}. */
    @ExceptionHandler(FieldValidationException.class)
    public ResponseEntity<Map<String, Object>> handleFieldRule(FieldValidationException e) {
        return body(HttpStatus.UNPROCESSABLE_CONTENT, e.getMessage(), e.errors());
    }

    @ExceptionHandler(ConstraintViolationException.class)
    public ResponseEntity<Map<String, Object>> handleConstraintViolation(ConstraintViolationException e) {
        // `getMessage()` của ngoại lệ này là "create.request.name: ..." — đường dẫn Java, không phải câu
        // cho người dùng. Lấy câu của từng vi phạm, khoá theo tên trường cuối đường dẫn.
        Map<String, Object> errors = new LinkedHashMap<>();
        e.getConstraintViolations().forEach(v -> {
            String path = v.getPropertyPath().toString();
            errors.putIfAbsent(path.substring(path.lastIndexOf('.') + 1), v.getMessage());
        });
        return body(HttpStatus.UNPROCESSABLE_CONTENT, invalid(errors), errors);
    }

    /**
     * A write whose resulting state falls outside the caller's data scope.
     *
     * <p>{@code 422}, the same status a failed bean validation gets, and for the
     * same reason: the request was understood and the row does exist as far as
     * this caller is concerned. What is refused is the state it would leave
     * behind — moving a task into a department the writer cannot reach, say.
     * A {@code 403} would suggest the whole endpoint is closed to them, and a
     * {@code 404} would deny a record they can plainly see.
     */
    @ExceptionHandler(RowLevelViolationException.class)
    public ResponseEntity<Map<String, Object>> handleRowLevel(RowLevelViolationException e) {
        Map<String, Object> errors = e.field() == null
                ? Map.of()
                : Map.of(e.field(), "outside your data scope");
        return body(HttpStatus.UNPROCESSABLE_CONTENT, e.getMessage(), errors);
    }

    /**
     * A row-level policy that cannot be compiled — an unknown field, an operator
     * the type does not support, a literal that will not coerce.
     *
     * <p>Raised only on the path that <em>saves</em> a policy, which is the one
     * moment somebody is present to be told. The same failure at load time is
     * quarantined instead; see {@code RowLevelPolicyCache}.
     */
    @ExceptionHandler(PolicyValidationException.class)
    public ResponseEntity<Map<String, Object>> handlePolicyValidation(PolicyValidationException e) {
        Map<String, Object> errors = e.node() == null
                ? Map.of()
                : Map.of("scope", e.node());
        return body(HttpStatus.UNPROCESSABLE_CONTENT, e.getMessage(), errors);
    }

    /**
     * Cơ sở dữ liệu từ chối một lần ghi. Trước đây MỌI trường hợp đều trả cùng một câu "bản ghi còn
     * được tham chiếu" — đúng cho xoá một dòng đang được dùng, và sai cho mọi thứ còn lại: gõ quá dài,
     * trùng mã, thiếu trường bắt buộc đều hiện ra như thể đang xoá nhầm thứ gì. Phân theo SQLSTATE của
     * PostgreSQL để mỗi loại có câu của nó, và trả 422 (kèm tên trường khi biết) cho lỗi nhập liệu để
     * form hiện ngay dưới ô sai.
     *
     * <p>Đây là lưới ĐỠ, không phải nơi kiểm chính: service kiểm trước để câu từ chối gọi đúng tên
     * nghiệp vụ; tới được đây nghĩa là một đường nào đó chưa kiểm, và nó phải hỏng cho tử tế.
     */
    @ExceptionHandler(DataIntegrityViolationException.class)
    public ResponseEntity<Map<String, Object>> handleIntegrityViolation(DataIntegrityViolationException e) {
        Throwable root = e.getMostSpecificCause();
        String state = root instanceof SQLException sql ? sql.getSQLState() : null;
        ServerErrorMessage server = root instanceof PSQLException pg ? pg.getServerErrorMessage() : null;
        String text = root.getMessage() == null ? "" : root.getMessage();
        String column = server == null ? null : server.getColumn();
        String constraint = server == null ? null : server.getConstraint();
        if (state == null) {
            LOG.warn("Vi phạm ràng buộc dữ liệu không rõ loại", e);
            return body(HttpStatus.CONFLICT, "Không lưu được: dữ liệu vi phạm một ràng buộc của hệ thống", Map.of());
        }
        switch (state) {
            case "22001": {
                Matcher m = TOO_LONG.matcher(text);
                return body(HttpStatus.UNPROCESSABLE_CONTENT, m.find()
                        ? "Nội dung nhập quá dài — có ô vượt quá " + m.group(1) + " ký tự"
                        : "Nội dung nhập quá dài so với giới hạn của ô", Map.of());
            }
            case "22003":
                return body(HttpStatus.UNPROCESSABLE_CONTENT, "Có số nhập quá lớn so với giới hạn của ô", Map.of());
            case "23502": {
                String field = column == null ? null : camel(column);
                return body(HttpStatus.UNPROCESSABLE_CONTENT,
                        "Thiếu thông tin bắt buộc" + (column == null ? "" : ": " + label(column)),
                        field == null ? Map.of() : Map.of(field, "Bắt buộc nhập"));
            }
            case "23505": {
                Matcher m = DUPLICATE.matcher(server == null || server.getDetail() == null ? text : server.getDetail());
                if (m.find()) {
                    // Cột cuối của khoá là cột người dùng gõ (các cột trước là phạm vi: trường, năm học).
                    String[] columns = m.group(1).split(",\\s*");
                    String[] values = m.group(2).split(",\\s*");
                    String last = columns[columns.length - 1].replaceAll("[^a-z0-9_]", "");
                    String value = values[values.length - 1];
                    String message = "%s \"%s\" đã tồn tại — nhập giá trị khác".formatted(capitalize(label(last)), value);
                    return body(HttpStatus.CONFLICT, message, Map.of(camel(last), "Đã tồn tại"));
                }
                return body(HttpStatus.CONFLICT, "Dữ liệu bị trùng với một bản ghi đã có", Map.of());
            }
            case "23503":
                // Hai chiều của cùng một khoá ngoại: xoá dòng đang được dùng, hoặc trỏ tới dòng không có.
                return body(HttpStatus.CONFLICT, text.contains("is not present")
                        ? "Một mục được chọn không còn tồn tại — tải lại trang rồi chọn lại"
                        : "Không xoá được: bản ghi này đang được dùng ở nơi khác", Map.of());
            case "23514":
                LOG.warn("Vi phạm CHECK {} chưa được service kiểm trước", constraint);
                return body(HttpStatus.UNPROCESSABLE_CONTENT, "Dữ liệu chưa hợp lệ"
                        + (constraint == null ? "" : " (ràng buộc " + constraint + ")")
                        + " — kiểm tra lại các ô vừa nhập", Map.of());
            default:
                LOG.warn("Vi phạm ràng buộc dữ liệu {}", state, e);
                return body(HttpStatus.CONFLICT, "Không lưu được: dữ liệu vi phạm một ràng buộc của hệ thống", Map.of());
        }
    }

    private static final org.slf4j.Logger LOG = LoggerFactory.getLogger(ApiExceptionHandler.class);
    private static final Pattern TOO_LONG = Pattern.compile("character varying\\((\\d+)\\)");
    private static final Pattern DUPLICATE = Pattern.compile("Key \\(([^)]*)\\)=\\((.*)\\) already exists");

    /** Tên cột thường gặp → chữ người dùng đọc; cột lạ thì trả nguyên tên. */
    private static final Map<String, String> COLUMN_LABELS = Map.ofEntries(
            Map.entry("code", "mã"), Map.entry("name", "tên"), Map.entry("username", "tên đăng nhập"),
            Map.entry("email", "email"), Map.entry("short_code", "mã hai ký tự"), Map.entry("moet_code", "mã định danh"),
            Map.entry("school_id", "trường"), Map.entry("phone", "số điện thoại"), Map.entry("serial_number", "số serial"),
            Map.entry("title", "tiêu đề"), Map.entry("user_id", "tài khoản"), Map.entry("prefix", "ký hiệu đầu"));

    private static String label(String column) {
        return COLUMN_LABELS.getOrDefault(column, column);
    }

    private static String capitalize(String s) {
        return s.isEmpty() ? s : Character.toUpperCase(s.charAt(0)) + s.substring(1);
    }

    /** {@code short_code} → {@code shortCode}; {@code school_id} → {@code school}: tên trường trên form. */
    private static String camel(String column) {
        String base = column.endsWith("_id") ? column.substring(0, column.length() - 3) : column;
        StringBuilder out = new StringBuilder();
        boolean upper = false;
        for (char c : base.toCharArray()) {
            if (c == '_') {
                upper = true;
            } else {
                out.append(upper ? Character.toUpperCase(c) : c);
                upper = false;
            }
        }
        return out.toString();
    }

    /** Thân yêu cầu không đọc được: JSON hỏng, số / ngày / lựa chọn sai dạng. */
    @ExceptionHandler(HttpMessageNotReadableException.class)
    public ResponseEntity<Map<String, Object>> handleUnreadable(HttpMessageNotReadableException e) {
        return body(HttpStatus.BAD_REQUEST,
                "Dữ liệu gửi lên không đúng định dạng — kiểm tra lại các ô số, ngày và ô chọn", Map.of());
    }

    /** Tham số trên đường dẫn / query sai kiểu — {@code /api/rooms/abc}. */
    @ExceptionHandler(MethodArgumentTypeMismatchException.class)
    public ResponseEntity<Map<String, Object>> handleTypeMismatch(MethodArgumentTypeMismatchException e) {
        return body(HttpStatus.BAD_REQUEST, "Tham số \"%s\" không hợp lệ".formatted(e.getName()), Map.of());
    }

    /**
     * Mọi thứ còn lại. Ngoại lệ của chính Spring MVC (404 đường dẫn lạ, 405 sai phương thức, 415…) giữ
     * mã của nó; còn lại là lỗi của ta — ghi log đầy đủ, và trả một câu tiếng Việt thay cho trang lỗi
     * mặc định hay một stack trace.
     */
    @ExceptionHandler(Exception.class)
    public ResponseEntity<Map<String, Object>> handleUnexpected(Exception e) {
        if (e instanceof ErrorResponse known) {
            HttpStatus status = HttpStatus.resolve(known.getStatusCode().value());
            if (status != null && status.is4xxClientError()) {
                return body(status, switch (status) {
                    case NOT_FOUND -> "Không tìm thấy đường dẫn được yêu cầu";
                    case METHOD_NOT_ALLOWED -> "Thao tác này không được hỗ trợ";
                    case UNSUPPORTED_MEDIA_TYPE -> "Định dạng dữ liệu gửi lên không được hỗ trợ";
                    case CONTENT_TOO_LARGE -> "Tệp tải lên quá lớn";
                    default -> "Yêu cầu không hợp lệ";
                }, Map.of());
            }
        }
        LOG.error("Lỗi chưa được xử lý", e);
        return body(HttpStatus.INTERNAL_SERVER_ERROR,
                "Hệ thống gặp lỗi khi xử lý yêu cầu — thử lại, nếu vẫn lỗi hãy báo quản trị viên", Map.of());
    }

    /** Covers the unparseable enum / id values the request DTOs reject. */
    @ExceptionHandler(IllegalArgumentException.class)
    public ResponseEntity<Map<String, Object>> handleIllegalArgument(IllegalArgumentException e) {
        return body(HttpStatus.BAD_REQUEST, e.getMessage(), Map.of());
    }

    private ResponseEntity<Map<String, Object>> body(HttpStatus status, String message, Map<String, Object> errors) {
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("timestamp", Instant.now().toString());
        payload.put("status", status.value());
        payload.put("error", status.getReasonPhrase());
        payload.put("message", message);
        if (!errors.isEmpty()) {
            payload.put("errors", errors);
        }
        return ResponseEntity.status(status).body(payload);
    }
}
