# Luồng 3 — Phân tích bằng chứng & RAG

Import `workflow-3-evidence-rag.json` vào n8n. Backend phải chạy tại port 3000; trong Docker, workflow dùng `host.docker.internal`. Truyền `requestId` từ một nghiên cứu đã ở trạng thái `collected` vào Manual Trigger. Workflow gọi `POST /api/research/:id/analyze`, sau đó `GET /api/research/:id/evidence`.

Business logic và API key nằm ở backend, không cấu hình Gemini key trong n8n.
