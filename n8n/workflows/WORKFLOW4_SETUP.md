# Luồng 4 — Tạo báo cáo nghiên cứu

Import `workflow-4-report-generation.json` vào n8n. Truyền `requestId` của nghiên cứu đã `analyzed`, cùng cấu hình tùy chọn `title`, `language`, `style`, `outputLength`. Workflow gọi `POST /api/research/:id/report`, sau đó `GET /api/research/:id/report`. Trong Docker, URL backend là `http://host.docker.internal:3000`.

Không đưa API key Gemini vào n8n; backend chịu trách nhiệm retry, gọi Gemini và lưu SQLite.
