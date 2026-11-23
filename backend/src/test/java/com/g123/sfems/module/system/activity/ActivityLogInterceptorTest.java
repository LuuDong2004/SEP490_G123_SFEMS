package com.g123.sfems.module.system.activity;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;

import com.g123.sfems.shared.security.ActorNames;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;

class ActivityLogInterceptorTest {

    private final JdbcTemplate jdbc = mock(JdbcTemplate.class);
    private final ActivityLogInterceptor interceptor = new ActivityLogInterceptor(jdbc, mock(ActorNames.class));

    /** Tham số của lệnh INSERT: 0 created_at · 1 actor_id · 2 actor_name · 3 method · 4 path · 5 resource ·
     * 6 record_id · 7 action · 8 status · 9 ip · 10 export_format · 11 row_count · 12 detail. */
    private Object[] inserted() {
        ArgumentCaptor<Object[]> args = ArgumentCaptor.forClass(Object[].class);
        verify(jdbc).update(anyString(), args.capture());
        return args.getValue();
    }

    @Test
    void xlsxDownloadOutsideExportPathIsLoggedWithItsQuery() {
        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/api/purchase_proposals/adequacy.xlsx");
        request.setQueryString("schoolId=7");
        MockHttpServletResponse response = new MockHttpServletResponse();
        response.setContentType("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
        interceptor.afterCompletion(request, response, null, null);
        Object[] a = inserted();
        assertThat(a[5]).isEqualTo("purchase_proposals");
        assertThat(a[7]).isEqualTo("export");
        assertThat(a[10]).isEqualTo("XLSX");
        assertThat(a[12]).isEqualTo("schoolId=7");
    }

    @Test
    void browserExportIsLoggedAsTheReportedExport() {
        MockHttpServletRequest request = new MockHttpServletRequest("POST", "/api/activity_logs/exports");
        request.setAttribute(ActivityLogInterceptor.EXPORT,
                new ActivityLogInterceptor.ExportEvent("equipment", "CSV", 42, "status=IN_USE", "/equipment"));
        interceptor.afterCompletion(request, new MockHttpServletResponse(), null, null);
        Object[] a = inserted();
        assertThat(a[4]).isEqualTo("/equipment");
        assertThat(a[5]).isEqualTo("equipment");
        assertThat(a[7]).isEqualTo("export");
        assertThat(a[10]).isEqualTo("CSV");
        assertThat(a[11]).isEqualTo(42);
        assertThat(a[12]).isEqualTo("status=IN_USE");
    }

    @Test
    void ordinaryReadIsNotLogged() {
        interceptor.afterCompletion(new MockHttpServletRequest("GET", "/api/equipment"), new MockHttpServletResponse(),
                null, null);
        verify(jdbc, never()).update(anyString(), any(Object[].class));
    }
}
