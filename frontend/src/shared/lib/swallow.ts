/**
 * Bỏ qua lỗi đã được báo cho người dùng. `onFinish` của Refine ném lại lỗi lưu sau khi đã hiện thông báo; để nó lọt
 * khỏi `handleSubmit` thì trình duyệt ghi "unhandled rejection" — một lỗi JS thật dù màn hình vẫn đúng.
 */
export function swallow(): void {}
