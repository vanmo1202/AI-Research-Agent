# Báo cáo Việt hóa nguồn và Playwright

Ngày: 2026-10-30 (Asia/Ho_Chi_Minh).

## Kiến trúc và dữ liệu

Workflow 2: tìm nguồn → normalize/dedupe → làm sạch nội dung → dịch với concurrency giới hạn → transaction lưu nguồn gốc và bản dịch → collected. Dịch lỗi riêng từng nguồn được bắt lại; nguồn vẫn lưu với các trường dịch null. Không đổi URL/provider/source ID. Không dùng n8n.

SQLite thêm `title_vi`, `snippet_vi`, `content_vi` bằng PRAGMA table_info và ALTER chỉ khi thiếu. Migration không recreate bảng hoặc xóa dữ liệu cũ, đã kiểm tra chạy hai lần trên bảng legacy có dữ liệu.

`translation.service.js` dùng `llm.service.generateJson`/Gemini hiện có. Validate JSON object, kiểu string, nội dung không rỗng cho input có dữ liệu và danh sách URL không thay đổi. Prompt yêu cầu dịch tự nhiên, không tóm tắt/thêm sự kiện, giữ thuật ngữ/code/tên sản phẩm và xử lý input như dữ liệu.

Cấu hình mặc định: `TRANSLATE_SOURCE_CONTENT=true`, `TRANSLATE_MAX_CONTENT_CHARS=12000`, `TRANSLATE_CONCURRENCY=2`. Mỗi trường gửi dịch được giới hạn ký tự; bản gốc trong nguồn không bị cắt bởi bước dịch. Nội dung gốc vẫn theo giới hạn collection có sẵn. Dịch chỉ gọi Gemini khi `MOCK_LLM=false`; mock không tạo bản dịch giả. Bản dịch đầy đủ đã lưu được tái sử dụng khi nội dung gốc không thay đổi. Đặt TRANSLATE_SOURCE_CONTENT=false để tắt các lần dịch mới. Chỉ cập nhật .env.example, không sửa .env thật.

Các nguồn đã lưu trước đây tiếp tục hiển thị bản gốc; chạy lại Workflow 2 để dịch. Bước dịch có thể làm tăng thời gian thu thập và vẫn dùng timeout/retry HTTP của Gemini hiện có.

## API, UI, RAG và báo cáo

GET /api/research/:id/sources giữ nguyên các trường cũ, thêm titleVi/snippetVi/contentVi (string hoặc null).

SourceCard được dùng chung cho Workflow 2 và trang Sources: ưu tiên bản dịch, fallback từng trường về bản gốc. Bộ lọc tìm kiếm gồm cả bản dịch và bản gốc, sort theo tiêu đề hiển thị.

SourceDetail mặc định dùng bản dịch, có nút Xem bản gốc/Xem bản dịch khi có dịch; sao chép nội dung theo phiên bản đang xem. URL và provider giữ nguyên. Có thông báo bản dịch có thể giới hạn độ dài.

Chunk/RAG ưu tiên contentVi rồi content; nguồn gốc vẫn truy cập được từ sources.content. Evidence prompt yêu cầu evidenceText/reason tiếng Việt; kiểm tra sourceId phải khớp chunkId. UI evidence ưu tiên titleVi. Khi dùng mock và nguồn gốc tiếng Anh không có dịch, mock evidence vẫn có thể giữ tiếng Anh; không tạo bản dịch giả.

Report giữ tiếng Việt như hiện tại; references và context ưu tiên titleVi, URL/provider gốc. Test xác nhận references trỏ đúng nguồn.

## Kiểm chứng

- npm test (backend): 29 tests, pass 29, fail 0.
- npm run build (frontend): PASS.
- npm run test:e2e: 5/5 PASS, không skip.
- git diff --check: PASS.
- Test dịch: thành công, schema/JSON không hợp lệ, Gemini failure, giới hạn độ dài, URL không đổi, original không overwrite, persist/API fields, fallback null, cache, migration legacy/idempotent, không gọi mạng thật trong automated tests, RAG/report/citation mapping.
- Playwright có fixture dịch riêng trong test validation: kiểm tra ưu tiên tiếng Việt, URL gốc và toggle hai chiều.

Ba Playwright test cũ lỗi do heading/nút/navigation label đã đổi sau Việt hóa. Locator đã cập nhật:

| Cũ | Mới |
| --- | --- |
| Tạo yêu cầu nghiên cứu | Khởi đầu nghiên cứu của bạn. |
| Tạo Research Plan | Tạo kế hoạch nghiên cứu |
| Kết quả Research Plan | Kế hoạch nghiên cứu (exact) |
| Bắt đầu Search & Collect | Bắt đầu tìm kiếm & thu thập |
| Kết quả Search & Collect | Tìm kiếm & Thu thập tài liệu (heading cấp 1) |
| Nguồn tài liệu của bạn | Nguồn tài liệu nghiên cứu |
| Search & Collect (trang chọn nghiên cứu) | Tìm kiếm & Thu thập tài liệu |
| Workflow 1 (link điều hướng) | Lập kế hoạch nghiên cứu |

Giữ route /research/:id/sources và port Playwright 4300/4173; runtime vẫn 3000/5173. Locator danh sách nguồn dùng role article thay class; các assertion số lượng, dữ liệu, persistence, responsive, validation, lỗi mạng và CORS được giữ.

Kiểm tra thật với chủ đề “Ứng dụng Retrieval-Augmented Generation trong hệ thống hỏi đáp tài liệu”: Tavily trả nguồn; Gemini dịch gặp timeout sau các retry. Lần kiểm tra ngắn riêng, timeout 10 giây và không retry, trả TimeoutError. Chưa xác nhận bản dịch tiếng Việt thật thành công trong môi trường hiện tại. Không in keys, headers hoặc provider response body.

## File của công việc này

Tạo mới:
- backend/src/services/translation.service.js
- backend/test/translation.test.js
- SOURCE_TRANSLATION_REPORT.md

Chỉnh sửa (một số file vốn đã untracked trước khi bắt đầu):
- backend/.env.example
- backend/src/config/database.js
- backend/src/models/source.model.js
- backend/src/services/research.service.js
- backend/src/services/chunk.service.js
- backend/src/services/evidence.service.js
- backend/src/services/report.service.js
- frontend/src/components/research/SourceCard.jsx
- frontend/src/components/research/SourceList.jsx
- frontend/src/pages/SourceDetailPage.jsx
- frontend/src/pages/EvidencePage.jsx
- frontend/src/pages/Workflow2Page.jsx
- frontend/tests/research.spec.js

Không commit/push, không thay đổi .env thật, không sửa n8n và giữ các thay đổi local trước đó.

## Git status cuối

```text
 M backend/.env.example
 M backend/src/config/database.js
 M backend/src/controllers/research.controller.js
 M backend/src/models/source.model.js
 M backend/src/routes/research.routes.js
 M backend/src/server.js
 M backend/src/services/llm.service.js
 M backend/src/services/research.service.js
 M backend/test/search-workflow.test.js
 M backend/test/workflow1.test.js
 M frontend/src/App.jsx
 M frontend/src/components/layout/AppLayout.jsx
 M frontend/src/components/layout/Header.jsx
 M frontend/src/components/layout/Sidebar.jsx
 M frontend/src/components/research/ResearchForm.jsx
 M frontend/src/components/research/SourceCard.jsx
 M frontend/src/components/research/SourceList.jsx
 M frontend/src/components/research/WorkflowProgress.jsx
 M frontend/src/pages/DashboardPage.jsx
 M frontend/src/pages/NotFoundPage.jsx
 M frontend/src/pages/ResearchPlanPage.jsx
 M frontend/src/pages/SettingsPage.jsx
 M frontend/src/pages/SourceDetailPage.jsx
 M frontend/src/pages/SourcesPage.jsx
 M frontend/src/pages/Workflow1Page.jsx
 M frontend/src/pages/Workflow2Page.jsx
 M frontend/src/services/researchApi.js
 M frontend/tests/research.spec.js
?? CODEX_FRONTEND_VIET_HOA_WORKFLOW_3_4.md
?? SOURCE_TRANSLATION_REPORT.md
?? backend/src/services/chunk.service.js
?? backend/src/services/evidence.service.js
?? backend/src/services/relevance.service.js
?? backend/src/services/report.service.js
?? backend/src/services/translation.service.js
?? backend/test/translation.test.js
?? frontend/src/pages/EvidencePage.jsx
?? frontend/src/pages/ReportPage.jsx
?? n8n/workflows/WORKFLOW3_SETUP.md
?? n8n/workflows/WORKFLOW4_SETUP.md
?? n8n/workflows/workflow-3-evidence-rag.json
?? n8n/workflows/workflow-4-report-generation.json
?? package-lock.json
```
