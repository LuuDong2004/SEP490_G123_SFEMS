package com.g123.sfems.shared.data.rls;

import com.g123.sfems.shared.security.CurrentUser;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.function.Supplier;
import javax.sql.DataSource;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.jdbc.datasource.DelegatingDataSource;

/**
 * Bọc DataSource của ứng dụng: MỖI lần mượn kết nối từ pool thì ghi phạm vi trường của người đang gọi vào phiên
 * PostgreSQL, để chính sách Row-Level Security (changelog 230–231) chặn cả SQL thuần quên lọc trường.
 *
 * <p>Ba khoá, ghi ĐỦ cả ba ở mọi lần mượn — kể cả khi không có người dùng — nên trạng thái của yêu cầu trước không
 * bao giờ sót sang yêu cầu sau dù kết nối được pool dùng lại:
 * <ul>
 * <li>{@code role} — {@value #APP_ROLE} khi bị giới hạn (vai thường, không vượt được RLS), {@code none} còn lại.
 * Tài khoản đăng nhập CSDL là superuser thì RLS không áp, nên phải hạ vai.</li>
 * <li>{@code app.rls_mode} — {@code bypass} / {@code all} / {@code school}.</li>
 * <li>{@code app.rls_school_ids} — mảng id trường, ví dụ {@code {12,15}}.</li>
 * </ul>
 *
 * <p>Ghi mức phiên ({@code set_config(.., false)}) chứ không {@code SET LOCAL}: lúc mượn, kết nối còn ở autocommit
 * (giao dịch Spring mở SAU đó), và JdbcTemplate ngoài giao dịch thì không có giao dịch nào để {@code LOCAL} bám vào.
 * Ghi đè toàn bộ ở mỗi lần mượn thay cho dọn lúc trả.
 *
 * <p>Phạm vi được tính TRƯỚC khi mượn kết nối (không giữ một kết nối trong lúc chờ kết nối thứ hai); bộ nhớ đệm phải
 * nạp từ CSDL trong lúc tính thì lần mượn lồng đó nhận {@link DbRowScope#bypass()}.
 */
public class RowSecurityDataSource extends DelegatingDataSource {

    /** Vai PostgreSQL không vượt RLS, do changelog 230 tạo. */
    public static final String APP_ROLE = "qltb_app";

    private static final Logger log = LoggerFactory.getLogger(RowSecurityDataSource.class);

    private static final String APPLY = "SELECT set_config('role', ?, false), set_config('app.rls_mode', ?, false),"
            + " set_config('app.rls_school_ids', ?, false)";

    private static final String ROLE_USABLE = "SELECT CASE WHEN EXISTS (SELECT 1 FROM pg_roles WHERE rolname = '"
            + APP_ROLE + "' AND NOT rolsuper AND NOT rolbypassrls) THEN pg_has_role(session_user, '" + APP_ROLE
            + "', 'MEMBER') ELSE false END";

    private static final ThreadLocal<Boolean> RESOLVING = new ThreadLocal<>();

    private final ObjectProvider<DbRowScopeSource> scopes;
    private volatile Boolean roleUsable;

    public RowSecurityDataSource(DataSource target, ObjectProvider<DbRowScopeSource> scopes) {
        super(target);
        this.scopes = scopes;
    }

    @Override
    public Connection getConnection() throws SQLException {
        DbRowScope scope = scope();
        return applied(obtainTargetDataSource().getConnection(), scope);
    }

    @Override
    public Connection getConnection(String username, String password) throws SQLException {
        DbRowScope scope = scope();
        return applied(obtainTargetDataSource().getConnection(username, password), scope);
    }

    /**
     * Chạy {@code work} với kết nối KHÔNG gắn phạm vi trường. Dành cho việc mà chính việc dò phạm vi phụ thuộc vào —
     * nạp quyền của người đang gọi ({@code AuthorityCache}): dò phạm vi cần quyền, nạp quyền cần kết nối, mở kết nối lại
     * dò phạm vi → luồng tự chờ lần nạp của chính nó (khoá chết, người đó treo tới khi khởi động lại). Bảng tài khoản /
     * vai / quyền không nằm dưới RLS nên không mở rộng thứ gì người gọi thấy được.
     */
    public static <T> T unscoped(Supplier<T> work) {
        Boolean previous = RESOLVING.get();
        RESOLVING.set(Boolean.TRUE);
        try {
            return work.get();
        } finally {
            if (previous == null) {
                RESOLVING.remove();
            } else {
                RESOLVING.set(previous);
            }
        }
    }

    private DbRowScope scope() {
        // Không người dùng thì khỏi hỏi nguồn phạm vi — cũng là thứ cắt vòng lúc khởi động (Liquibase mượn kết nối
        // khi chuỗi bean của nguồn phạm vi còn đang dựng).
        if (RESOLVING.get() != null || CurrentUser.id().isEmpty()) {
            return DbRowScope.bypass();
        }
        DbRowScopeSource source = scopes.getIfAvailable();
        if (source == null) {
            return DbRowScope.bypass();
        }
        return unscoped(source::current);
    }

    private Connection applied(Connection connection, DbRowScope scope) throws SQLException {
        try {
            String role = scope.restricted() && roleUsable(connection) ? APP_ROLE : "none";
            try (PreparedStatement statement = connection.prepareStatement(APPLY)) {
                statement.setString(1, role);
                statement.setString(2, scope.mode().setting());
                statement.setString(3, scope.schoolIdsLiteral());
                statement.execute();
            }
            return connection;
        } catch (SQLException | RuntimeException e) {
            // Không ghi được phạm vi thì không đưa kết nối ra — đóng hẳn, báo lỗi (chặn chứ không thả).
            connection.close();
            throw e;
        }
    }

    /**
     * Tài khoản đăng nhập có hạ được xuống {@value #APP_ROLE} không — kiểm một lần. Không được (CSDL chưa chạy
     * changelog 230, hoặc tài khoản không phải thành viên) thì vẫn ghi phạm vi nhưng không đổi vai: RLS chỉ còn áp
     * khi tài khoản đăng nhập không phải superuser / BYPASSRLS.
     */
    private boolean roleUsable(Connection connection) throws SQLException {
        Boolean known = roleUsable;
        if (known == null) {
            try (PreparedStatement statement = connection.prepareStatement(ROLE_USABLE);
                    ResultSet rows = statement.executeQuery()) {
                known = rows.next() && rows.getBoolean(1);
            }
            roleUsable = known;
            if (known) {
                log.info("RLS CSDL: yêu cầu bị giới hạn chạy dưới vai {}", APP_ROLE);
            } else {
                log.warn("RLS CSDL: không hạ được xuống vai {} — chính sách chỉ áp khi tài khoản CSDL không phải"
                        + " superuser / BYPASSRLS (docs/kien-truc/03, mục Lớp CSDL)", APP_ROLE);
            }
        }
        return known;
    }
}
