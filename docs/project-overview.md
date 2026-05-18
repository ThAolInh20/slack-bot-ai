# Kiến Trúc Đa Bot Slack - Tổng Quan Dự Án

Dự án này là một framework Slack Bot phức tạp, hỗ trợ đa khách hàng (chạy nhiều bot trên cùng một máy chủ) và quy trình làm việc AI hai giai đoạn (Đạo diễn & Diễn viên) để tạo ra các cuộc trò chuyện tự động giữa các bot.

## Các Tính Năng Chính
1. **Hỗ trợ Đa Bot (Multi-Bot):** Một máy chủ Fastify duy nhất có thể chạy đồng thời nhiều bot Slack (`senna`, `ochabi`, `minimax_bot`, v.v.). Mỗi bot có thông tin xác thực, webhook endpoint và tính cách (persona) riêng biệt.
2. **Vòng Lặp Trò Chuyện Vô Cực:** Các bot có thể tự động trả lời người dùng và trả lời lẫn nhau, tạo ra một vòng lặp trò chuyện vô tận, tự duy trì và được quản lý thông minh bởi AI.
3. **Lịch Sử Ngữ Cảnh (10 Tin Nhắn):** Hệ thống không chỉ phản ứng với tin nhắn mới nhất. Nó chủ động sử dụng Slack API (`conversations.history`) để lấy 10 tin nhắn gần nhất nhằm hiểu toàn bộ luồng và ngữ cảnh của cuộc trò chuyện.
4. **Kiến Trúc Đa Nền Tảng AI (Multi-Provider):**
   - **Đạo Diễn (AI Router):** Sử dụng Google Gemini (hoặc Minimax thông qua API của Anthropic) để phân tích ngữ cảnh và quyết định *bot nào* sẽ nói tiếp theo.
   - **Diễn Viên (AI Worker):** Tùy thuộc vào cấu hình của từng bot, hệ thống sẽ sử dụng Gemini hoặc API tương thích với Anthropic (như Minimax) để tạo ra câu trả lời dựa trên tính cách của bot đó.
5. **Loại Bỏ Trùng Lặp (Deduplication):** Sử dụng bộ đệm (cache) dựa trên `Set` để ngăn máy chủ xử lý cùng một webhook Slack nhiều lần. Điều này đảm bảo tính ổn định trong môi trường đa bot, nơi một tin nhắn duy nhất có thể kích hoạt webhook cho tất cả các bot trong channel.
6. **Xử Lý Bất Đồng Bộ (Asynchronous):** Để đáp ứng yêu cầu timeout 3 giây cực kỳ nghiêm ngặt của Slack, máy chủ sẽ trả về `200 OK` ngay lập tức và đưa toàn bộ khối lượng công việc AI nặng nề vào xử lý ngầm (background).

## Cấu Trúc Thư Mục
- `src/app.ts`: Điểm khởi đầu của ứng dụng Fastify. Tải các biến môi trường và đăng ký các route webhook của Slack.
- `src/routes/slack.ts`: Trái tim của hệ thống nhận webhook. Nó xử lý xác minh chữ ký Slack, loại bỏ sự kiện trùng lặp, tải lịch sử tin nhắn và điều phối quy trình làm việc AI chạy ngầm.
- `src/config/bots.ts`: Tệp cấu hình tập trung khai báo mọi thông tin của bot bao gồm: ID, Slack Token, Signing Secret, Nhà cung cấp AI (`gemini` hoặc `anthropic`), Base URL của API và Lời nhắc Tính cách (Persona Prompt).
- `src/lib/aiCore.ts`: Bộ não xử lý AI. Chứa các hàm `analyzeRouter` (Đạo diễn) và `generateReply` (Diễn viên). Bao gồm cả logic chuyển đổi linh hoạt giữa các nhà cung cấp AI và xử lý lỗi dự phòng (fallback).
- `src/lib/slackUtils.ts`: Các hàm tiện ích để giao tiếp với Slack API (xác minh chữ ký, gửi tin nhắn, thêm biểu cảm, và lấy lịch sử trò chuyện).

## Vòng Lặp AI Hoạt Động Như Thế Nào
1. Một tin nhắn (từ người dùng hoặc từ bot khác) đập vào webhook `/slack/:botId/events`.
2. Máy chủ phản hồi ngay lập tức `200 OK` cho Slack.
3. Một tiến trình chạy ngầm sẽ gọi API lấy 10 tin nhắn gần nhất từ Slack channel.
4. **Đạo diễn** (`analyzeRouter`) đọc lịch sử này và quyết định xem bot nào nên trả lời tiếp theo (nó được lập trình để không cho phép một bot tự nói chuyện với chính mình liên tục).
5. Nếu một bot được chọn, **Diễn viên** (`generateReply`) sẽ soạn thảo câu trả lời bằng cách gọi API của nhà cung cấp AI được chỉ định cho riêng bot đó.
6. Hệ thống tạm dừng 3 giây (độ trễ nhân tạo để mô phỏng tốc độ gõ phím của con người và tránh bị khóa API do spam).
7. Câu trả lời được gửi lên Slack.
8. Tin nhắn mới này của bot lại tiếp tục kích hoạt webhook một lần nữa, và vòng lặp cứ thế tiếp diễn cho đến khi Đạo diễn quyết định ngắt (hoặc chạy vô cực).

## Biến Môi Trường (Environment Variables)
Xem tệp `.env.example` để biết danh sách đầy đủ. Hệ thống yêu cầu:
- Thông tin xác thực Slack API (`BOT_TOKEN`, `SIGNING_SECRET`) cho mỗi bot.
- API Key của các nhà cung cấp AI (`GEMINI_API_KEY`, `MINIMAX_API_KEY`).
- Cấu hình tùy chọn để thay đổi Nhà cung cấp AI cho Đạo diễn (Router).
