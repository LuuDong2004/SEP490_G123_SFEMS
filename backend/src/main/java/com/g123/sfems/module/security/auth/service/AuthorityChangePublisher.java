package com.g123.sfems.module.security.auth.service;

import com.g123.sfems.module.security.auth.api.dto.AuthoritiesResponse;
import com.g123.sfems.module.security.rowlevel.service.RowLevelSecurity;
import com.g123.sfems.shared.security.AuthoritiesChanged;
import jakarta.annotation.PreDestroy;
import java.util.List;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.atomic.AtomicBoolean;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.event.EventListener;
import org.springframework.core.annotation.Order;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.messaging.simp.user.SimpUser;
import org.springframework.messaging.simp.user.SimpUserRegistry;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

/**
 * Tells an open tab that its permissions moved, without waiting for it to ask.
 *
 * <p>The last gap {@code X-Auth-Version} leaves. That stamp rides on every
 * response, so a client learns of a change on its next request — which, in a
 * dashboard somebody is using, is seconds away. But a tab sitting idle sends
 * nothing and therefore hears nothing, and now that there is a socket open
 * anyway there is no reason for it to wait.
 *
 * <p>The header is not replaced by this and should not be. It is the path that
 * still works while the socket is reconnecting, or is blocked by a proxy, or
 * was never established because the browser is on a network that will not
 * upgrade — and it costs nothing to keep, being a header on a response that was
 * already being sent. Two mechanisms, one converging on the same client state:
 * whichever arrives first wins and the other becomes a no-op, because both
 * write the same version stamp.
 *
 * <h2>The payload is the grants, not a nudge</h2>
 *
 * <p>Sending "something changed" and letting the client re-read would cost a
 * request per change, which is what the socket exists to avoid. Sending the
 * grants themselves costs nothing extra — they are already in memory, in the
 * cache that was just refilled — and leaves the client with nothing to fetch.
 * The stamp travels with them so the next response's header agrees rather than
 * looking like a further change.
 */
@Component
public class AuthorityChangePublisher {

    private static final Logger log = LoggerFactory.getLogger(AuthorityChangePublisher.class);

    /**
     * Where the client subscribes, minus the {@code /user} prefix Spring adds.
     *
     * <p>Under {@code auth} rather than a resource name because it needs no
     * permission — see {@code StompAuthChannelInterceptor}. Every account may be
     * told what it may do; requiring a permission to receive your own
     * permissions would be circular.
     */
    public static final String DESTINATION = "/queue/auth";

    private final SimpMessagingTemplate messaging;
    private final SimpUserRegistry users;
    private final AuthorizationService authorizationService;

    // The push carries the same payload the endpoint would, which now includes
    // the resources this account is narrowed on. Leaving it out here would make
    // a socket delivery and a fetch leave the client in two different states.
    private final RowLevelSecurity rowLevel;

    /** Số người đẩy liền nhau trước một lần nghỉ {@link #PUSH_PAUSE_MS}. */
    private static final int PUSH_BATCH = 100;
    private static final long PUSH_PAUSE_MS = 50;

    /** Một luồng nền duy nhất: các lượt đẩy cho mọi người không chạy chồng lên nhau. */
    private final ExecutorService pushExecutor = Executors.newSingleThreadExecutor(
            Thread.ofPlatform().name("authority-push").daemon().factory());
    private final AtomicBoolean everyoneDirty = new AtomicBoolean();
    private final AtomicBoolean everyoneRunning = new AtomicBoolean();

    public AuthorityChangePublisher(SimpMessagingTemplate messaging,
                                    SimpUserRegistry users,
                                    AuthorizationService authorizationService,
                                    RowLevelSecurity rowLevel) {
        this.messaging = messaging;
        this.users = users;
        this.authorizationService = authorizationService;
        this.rowLevel = rowLevel;
    }

    /**
     * A change made on this node.
     *
     * <p>Ordered last of the three listeners on this event: {@link
     * AuthorityCache} evicts at {@code 0} and {@link AuthorityChangeChannel}
     * tells the other nodes at {@code 1}. Running before the eviction would push
     * the grants that are being replaced.
     */
    @Order(2)
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT, fallbackExecution = true)
    public void onLocalChange(AuthoritiesChanged change) {
        push(change);
    }

    /**
     * A change that reached this node from another one.
     *
     * <p>Each node pushes to its own sessions and only its own, which is what
     * makes this correct across nodes with the in-memory broker: the message
     * never has to cross a broker, only the fact that something changed —
     * and {@link AuthorityChangeChannel} already carries that.
     */
    @Order(2)
    @EventListener
    public void onRemoteChange(AuthorityChangeChannel.Received received) {
        push(received.change());
    }

    private void push(AuthoritiesChanged change) {
        switch (change) {
            case AuthoritiesChanged.ForUser forUser -> send(String.valueOf(forUser.userId()));
            case AuthoritiesChanged.ForEveryone ignored -> {
                // Everyone holding the edited role is affected, and working out
                // who that is would mean reading the user feature's table from
                // here. Telling every account with a socket open on this node
                // is the same trade the cache makes when it drops everything:
                // bounded by who is actually connected.
                //
                // Nhưng KHÔNG chạy trong luồng này: đây là luồng HTTP của người bấm Lưu (hoặc luồng
                // LISTEN của PostgresEventBus ở node khác), và cache vừa bị xoá sạch nên mỗi người là
                // một lần nạp lại từ CSDL — 3.600 người là hàng chục giây chặn người bấm Lưu, và chặn
                // mọi tin huỷ cache khác đang chờ trên bus. Thứ tự vẫn giữ: việc được ĐẶT vào hàng
                // sau khi cache xoá (@Order 0) và kênh đã báo node khác (@Order 1).
                requestPushToEveryone();
            }
        }
    }

    /**
     * Xếp một lượt đẩy cho mọi người đang kết nối vào luồng nền. Nhiều thay đổi dồn dập (sửa vài
     * vai liền tay) gộp thành MỘT lượt chạy sau thay đổi cuối: lượt đó đọc quyền mới nhất của mỗi
     * người, nên các lượt ở giữa không mang gì thêm.
     */
    private void requestPushToEveryone() {
        everyoneDirty.set(true);
        if (everyoneRunning.compareAndSet(false, true)) {
            pushExecutor.execute(this::drainEveryone);
        }
    }

    private void drainEveryone() {
        try {
            while (everyoneDirty.getAndSet(false)) {
                List<SimpUser> connected = List.copyOf(users.getUsers());
                log.debug("Pushing authority change to {} connected account(s)", connected.size());
                int sent = 0;
                for (SimpUser user : connected) {
                    try {
                        send(user.getName());
                    } catch (RuntimeException e) {
                        // Một người hỏng không được chặn cả lượt; X-Auth-Version vẫn sửa được họ ở yêu cầu kế tiếp.
                        log.warn("Could not push authorities to {}", user.getName(), e);
                    }
                    // Rải tải: mỗi người là một lần nạp quyền từ CSDL vì cache vừa xoá sạch. Nghỉ ngắn
                    // sau mỗi lô để lượt đẩy không chiếm pool kết nối của người dùng đang làm việc.
                    if (++sent % PUSH_BATCH == 0) {
                        Thread.sleep(PUSH_PAUSE_MS);
                    }
                }
            }
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        } finally {
            everyoneRunning.set(false);
            // Một thay đổi tới đúng lúc vòng trên vừa thoát: nhận lấy nó thay vì để nó nằm đó.
            if (everyoneDirty.get() && everyoneRunning.compareAndSet(false, true)) {
                pushExecutor.execute(this::drainEveryone);
            }
        }
    }

    @PreDestroy
    void shutdown() {
        pushExecutor.shutdownNow();
    }

    /**
     * Sends one account its current grants.
     *
     * <p>Costs nothing when they have no session here: the broker drops a
     * message for a user it does not know, so there is no need to check first.
     */
    private void send(String name) {
        long userId;
        try {
            userId = Long.parseLong(name);
        } catch (NumberFormatException e) {
            // The principal's name is always the account id — see
            // StompAuthChannelInterceptor. Anything else is not one of ours.
            return;
        }

        authorizationService.entryOf(userId)
                .filter(AuthorityCache.Entry::canSignIn)
                .ifPresent(entry -> messaging.convertAndSendToUser(
                        name,
                        DESTINATION,
                        // Identical to what /auth/permissions would answer,
                        // scoped resources included. The client must not be able
                        // to tell which path delivered it, or a push and a fetch
                        // would leave it in two different states.
                        AuthoritiesResponse.from(entry, rowLevel.scopedResourcesFor(userId))));
    }
}
