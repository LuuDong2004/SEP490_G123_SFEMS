package com.g123.sfems.shared.data.rls;

/**
 * Trả phạm vi trường của yêu cầu đang chạy cho {@link RowSecurityDataSource}. Cài đặt nằm ở feature tổ chức (biết
 * {@code VisibleSchools}); tầng {@code shared} chỉ biết giao diện này.
 *
 * <p>Được gọi ở MỖI lần mượn kết nối, nên không được tự chạm CSDL trừ khi đi qua bộ nhớ đệm — lần nạp đệm nếu có
 * sẽ nhận một kết nối {@link DbRowScope#bypass()} (chống gọi lồng).
 */
public interface DbRowScopeSource {

    DbRowScope current();
}
