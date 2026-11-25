package com.g123.sfems.module.security.auth.api;

import java.net.InetSocketAddress;
import java.util.Map;
import org.springframework.http.server.ServerHttpRequest;
import org.springframework.http.server.ServerHttpResponse;
import org.springframework.web.socket.WebSocketHandler;
import org.springframework.web.socket.server.HandshakeInterceptor;

/**
 * Giữ IP của máy lúc bắt tay WebSocket vào thuộc tính phiên, để {@link StompAuthChannelInterceptor} kiểm IP quản trị ở
 * CONNECT — khung STOMP không còn mang địa chỉ máy. Cùng nguồn với {@code getRemoteAddr()} bên HTTP (đã qua cấu hình
 * forwarded headers nếu có proxy).
 */
public class ClientIpHandshakeInterceptor implements HandshakeInterceptor {

    public static final String CLIENT_IP = "qltb.clientIp";

    @Override
    public boolean beforeHandshake(ServerHttpRequest request, ServerHttpResponse response, WebSocketHandler wsHandler,
            Map<String, Object> attributes) {
        InetSocketAddress remote = request.getRemoteAddress();
        if (remote != null && remote.getAddress() != null) {
            attributes.put(CLIENT_IP, remote.getAddress().getHostAddress());
        }
        return true;
    }

    @Override
    public void afterHandshake(ServerHttpRequest request, ServerHttpResponse response, WebSocketHandler wsHandler,
            Exception exception) {
        // Không có gì để làm.
    }
}
