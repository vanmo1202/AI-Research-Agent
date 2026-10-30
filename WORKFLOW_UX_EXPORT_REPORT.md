# Báo cáo UX Workflow 2–4 và export Word/PDF

Ngày: 2026-10-31, Asia/Ho_Chi_Minh.

## Audit và thay đổi UX

Workflow 2 đã có helper hiển thị tiếng Việt và preview card clamp ba dòng; giữ nguyên cơ chế không fallback English. Chuẩn hóa pending thành “Đang xử lý bản dịch tiếng Việt...”, partial thành “Một phần nội dung chưa thể dịch.”. Source snippets clamp hai dòng; source detail dài có nút Đọc toàn bộ nội dung / Thu gọn nội dung, mặc định thu gọn. Giữ original URL/provider và không sửa dữ liệu source hoặc logic tìm kiếm/dịch.

Workflow 3 trước đây có evidence nhưng WorkflowProgress hardcode bước 3/4 là Chưa triển khai, counter chỉ 0–2/4. Evidence page cũng gộp analyzed_partial vào badge Đã phân tích và lặp lỗi từng câu hỏi. Sidebar bỏ sót request ID trên route workflow-3/4.

researchJourney.js hiện dùng status backend, plan/source data, analysis status, số evidence và report đã lưu:

| Status | Hiển thị bước phân tích |
| --- | --- |
| analyzing | Đang phân tích |
| analyzed | Đã phân tích |
| analyzed_partial | Hoàn thành một phần |
| failed (trang phân tích) | Phân tích thất bại |

WorkflowProgress bỏ các placeholder Chưa triển khai. Bước hoàn tất dùng check xanh, partial dùng warning vàng, failed có màu lỗi. Counter đếm bước thực sự complete; analyzed thông thường là 3/4, completed là 4/4. Partial chưa được tính complete nên thường là 2/4. Nếu report đã hoàn tất nhưng analysis vẫn partial, giữ cảnh báo thay vì giả vờ mọi bước đã complete. Sidebar đọc backend và đồng bộ metadata về history; Dashboard dùng cùng hàm tính journey. Các trang kế hoạch/thu thập truyền request status thật vào journey.

Alert partial hiện chỉ một khối: tiêu đề, số câu hỏi complete/incomplete và nút Thử lại các câu hỏi chưa hoàn tất. Nút dùng POST analyze hiện có: backend đã cache câu hỏi thành công và retry phần còn thiếu. Không thêm API giả hoặc thay đổi business logic phân tích.

Evidence hiển thị thành các article/card riêng, badge score bốn chữ số, câu hỏi, evidenceText, reason khi có, vùng Nguồn và nút Mở nguồn rõ ràng. Title qua helper Vietnamese-only, link dùng original URL. Tăng khoảng cách và line-height, giữ mobile không tràn ngang.

## Report rendering

Thay pre/monospace bằng react-markdown + remark-gfm: heading, paragraph, strong/emphasis, lists, blockquote, links, code và bảng. Style serif học thuật, khoảng trắng, list markers và links rõ. Markdown parser được lazy-load để không tăng bundle ban đầu của các workflow khác. Main JS khoảng 345,6 kB, Markdown chunk khoảng 161,4 kB (minified).

Không sửa content đã lưu. View/export chỉ normalize legacy mock reports lưu literal backslash-n nếu có đúng envelope heading đặc trưng và chưa có newline thật. HTML trong Markdown không được thực thi; link javascript bị chặn. Test xác nhận script không chạy.

## Export backend

Endpoints:

- GET /api/research/:id/report/export/docx
- GET /api/research/:id/report/export/pdf

report-export.service.js chỉ đọc request/report/sources từ SQLite. Không gọi Gemini/Tavily hoặc dịch vụ SaaS, không tạo lại report, không cập nhật nội dung đã lưu. Mã không hợp lệ trả 400; request/report không tồn tại trả 404 JSON.

DOCX: thư viện docx tạo OOXML ZIP thật; A4, Times New Roman, body 12pt, heading phân cấp, line spacing, paragraphs, list prefixes, quote indent và links clickable. Có tên báo cáo, chủ đề, ngày tạo và references ở cuối. marked dùng để phân tích Markdown ở backend qua dynamic import, tương thích CommonJS.

PDF: PDFKit tạo PDF thật, A4, margins, heading/paragraphs/lists, tự ngắt trang và hyperlinks. Kèm Liberation Serif regular/bold/italic/bold-italic trong backend/assets/fonts và giấy phép SIL OFL. Font được nhúng và có ToUnicode mapping; không phụ thuộc font máy deploy. Đã trích text bằng pdftotext để xác nhận dấu tiếng Việt đọc đúng.

References lấy từ report.references đã lưu, khớp source URL để ưu tiên titleVi/displayTitle hoặc title của source vi, giữ nguyên citation label và URL. Bỏ section references trong body export nếu đã có để thêm danh sách canonical ở cuối, không fabricate nguồn mới. Không fetch hình ảnh/link từ xa khi export.

Headers:

- DOCX: application/vnd.openxmlformats-officedocument.wordprocessingml.document
- PDF: application/pdf
- Content-Disposition: attachment; filename="Bao_cao_nghien_cuu_<8 ký tự ID>.docx|pdf"

CORS expose Content-Disposition để frontend đọc được tên file ở origin khác. Tên file chỉ dùng ký tự ID an toàn.

## Export frontend

Action chính đổi thành Xuất báo cáo, menu có Xuất Word (.docx) và Xuất PDF (.pdf), icon download/file. Có focus, Escape, phím mũi tên và đóng khi click ngoài. Trong lúc tạo file, disable button và hiển thị Đang tạo file Word... hoặc Đang tạo file PDF....

researchApi.js có exportReportDocx/exportReportPdf: fetch → kiểm tra HTTP → blob → object URL → download anchor → revoke URL. Ưu tiên tên file trong Content-Disposition. Lỗi hiển thị Không thể xuất báo cáo Word/PDF và không mất nội dung report trên trang.

## Kiểm chứng

- Backend npm test: 62/62 PASS, fail 0.
- Frontend npm run build: PASS, không còn cảnh báo chunk chính vượt 500 kB sau lazy-load Markdown.
- Playwright npm run test:e2e: 9/9 PASS, không skip.
- Prettier check trên các file frontend refactor: PASS.
- git diff --check: PASS.
- Không có script lint trong backend/package.json hoặc frontend/package.json, nên không có npm run lint để chạy.

Backend test kiểm tra actual DOCX ZIP/XML, nội dung/heading/font/hyperlink, canonical Vietnamese reference title, PDF signature, nhiều trang, font nhúng/ToUnicode, original URL, Content-Type/Disposition/CORS expose, 404/400, report không đổi. Test chặn global.fetch bên trong server để chứng minh export không gọi external API.

Playwright kiểm tra năm test workflow cũ cùng status analyzing/analyzed/partial/failed, journey 3/4–4/4, không còn Chưa triển khai, partial count/retry action, evidence card/source URL, semantic Markdown, XSS, menu keyboard, actual Word/PDF downloads/filename/signature, loading/disable, lỗi export không crash, mobile width và collapse/pending/partial source detail.

Artifacts kiểm tra:
- /tmp/ai-research-export-check.docx
- /tmp/ai-research-export-check.pdf
- /tmp/ai-research-export-check.txt (pdftotext)
- /tmp/ai-research-evidence-ux.png
- /tmp/ai-research-report-ux.png

## Files của task này

Tạo mới:
- backend/src/services/report-export.service.js
- backend/test/report-export.test.js
- backend/assets/fonts/LiberationSerif-Regular.ttf
- backend/assets/fonts/LiberationSerif-Bold.ttf
- backend/assets/fonts/LiberationSerif-Italic.ttf
- backend/assets/fonts/LiberationSerif-BoldItalic.ttf
- backend/assets/fonts/LICENSE.txt
- frontend/src/utils/researchJourney.js
- frontend/src/components/ui/Alert.jsx
- frontend/src/components/research/ReportMarkdown.jsx
- frontend/tests/workflow-ux.spec.js
- WORKFLOW_UX_EXPORT_REPORT.md

Chỉnh sửa (một số file đã untracked trước task):
- backend/package.json, backend/package-lock.json
- backend/src/routes/research.routes.js
- backend/src/server.js
- frontend/package.json, frontend/package-lock.json
- frontend/src/components/layout/Sidebar.jsx
- frontend/src/components/research/WorkflowProgress.jsx
- frontend/src/components/ui/Card.jsx
- frontend/src/components/ui/Badge.jsx
- frontend/src/pages/EvidencePage.jsx
- frontend/src/pages/ReportPage.jsx
- frontend/src/pages/SourceDetailPage.jsx
- frontend/src/pages/Workflow2Page.jsx
- frontend/src/pages/ResearchPlanPage.jsx
- frontend/src/pages/DashboardPage.jsx
- frontend/src/utils/sourceDisplay.js
- frontend/src/utils/researchStorage.js
- frontend/src/services/researchApi.js
- frontend/src/index.css
- frontend/tests/research.spec.js

Dependency mới: backend docx/pdfkit/marked, dev fflate; frontend react-markdown/remark-gfm. Không sửa n8n, không xóa original English, không ghi đè .env thật. Giữ mọi thay đổi local có sẵn; chưa commit/push.

## Git status cuối

```text
 M backend/.env.example
 M backend/package-lock.json
 M backend/package.json
 M backend/src/config/database.js
 M backend/src/controllers/research.controller.js
 M backend/src/models/source.model.js
 M backend/src/routes/research.routes.js
 M backend/src/server.js
 M backend/src/services/llm.service.js
 M backend/src/services/research.service.js
 M backend/src/services/search.service.js
 M backend/src/utils/httpRetry.js
 M backend/test/search-workflow.test.js
 M backend/test/workflow1.test.js
 M frontend/package-lock.json
 M frontend/package.json
 M frontend/src/App.jsx
 M frontend/src/components/layout/AppLayout.jsx
 M frontend/src/components/layout/Header.jsx
 M frontend/src/components/layout/Sidebar.jsx
 M frontend/src/components/research/ResearchForm.jsx
 M frontend/src/components/research/SourceCard.jsx
 M frontend/src/components/research/SourceList.jsx
 M frontend/src/components/research/WorkflowProgress.jsx
 M frontend/src/components/ui/Badge.jsx
 M frontend/src/components/ui/Card.jsx
 M frontend/src/hooks/useResearch.js
 M frontend/src/hooks/useSearchAndCollect.js
 M frontend/src/index.css
 M frontend/src/pages/DashboardPage.jsx
 M frontend/src/pages/NotFoundPage.jsx
 M frontend/src/pages/ResearchPlanPage.jsx
 M frontend/src/pages/SettingsPage.jsx
 M frontend/src/pages/SourceDetailPage.jsx
 M frontend/src/pages/SourcesPage.jsx
 M frontend/src/pages/Workflow1Page.jsx
 M frontend/src/pages/Workflow2Page.jsx
 M frontend/src/services/researchApi.js
 M frontend/src/utils/researchStorage.js
 M frontend/tests/research.spec.js
?? CODEX_FRONTEND_VIET_HOA_WORKFLOW_3_4.md
?? SOURCE_TRANSLATION_REPORT.md
?? TRANSLATION_REFACTOR_REPORT.md
?? WORKFLOW23_VI_ONLY_REPORT.md
?? WORKFLOW_UX_EXPORT_REPORT.md
?? backend/assets/
?? backend/src/services/chunk.service.js
?? backend/src/services/evidence.service.js
?? backend/src/services/relevance.service.js
?? backend/src/services/report-export.service.js
?? backend/src/services/report.service.js
?? backend/src/services/translation.service.js
?? backend/src/utils/geminiError.js
?? backend/src/utils/geminiLimiter.js
?? backend/src/utils/language.js
?? backend/test/report-export.test.js
?? backend/test/translation-chunks.test.js
?? backend/test/translation.test.js
?? backend/test/workflow23.test.js
?? frontend/src/components/research/ReportMarkdown.jsx
?? frontend/src/components/ui/Alert.jsx
?? frontend/src/pages/EvidencePage.jsx
?? frontend/src/pages/ReportPage.jsx
?? frontend/src/utils/researchJourney.js
?? frontend/src/utils/sourceDisplay.js
?? frontend/tests/workflow-ux.spec.js
?? n8n/workflows/WORKFLOW3_SETUP.md
?? n8n/workflows/WORKFLOW4_SETUP.md
?? n8n/workflows/workflow-3-evidence-rag.json
?? n8n/workflows/workflow-4-report-generation.json
?? package-lock.json
```
