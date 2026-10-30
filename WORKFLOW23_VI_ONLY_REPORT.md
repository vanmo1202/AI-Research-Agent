# Workflow 2 tối ưu / nguồn chỉ tiếng Việt / Workflow 3 chịu lỗi 429

Ngày: 2026-10-30 (Asia/Ho_Chi_Minh).

## Workflow 2: audit và kiến trúc

Bottleneck cũ: mọi nguồn đều đi qua dịch, kể cả nguồn tiếng Việt; content fetch dùng chung concurrency search; phần dịch nằm trước persistence, khiến UI chờ cả collection; chưa có source language/status/hash. Dedupe trước fetch và transaction đã có sẵn, được giữ lại, không phải tính năng mới.

Luồng mới: bounded Tavily search → normalize/dedupe → bounded content fetch → nhận diện ngôn ngữ local → persist nguồn gốc → xử lý nguồn với concurrency riêng → persist từng nguồn sẵn sàng → collected. Polling 1,8 giây khi đang làm việc, không dùng WebSocket; nguồn đã có kết quả xuất hiện dần. Reload giữ dữ liệu cũ để hạn chế nhấp nháy.

| Giới hạn mặc định | Trước | Sau |
| --- | --- | --- |
| Search | 2 | 4 |
| Content fetch | dùng chung search | 5 riêng |
| Translation sources | 1 | 2 |
| Translation chunks/source | tuần tự | 1, có cấu hình riêng |
| Gemini dùng chung | chưa có | 2 request, cách lần bắt đầu tối thiểu 400 ms |

Cấu hình .env thật được giữ nguyên; biến đã đặt trong đó có thể khác mặc định. TRANSLATE_CONCURRENCY cũ được hỗ trợ làm fallback cho source concurrency. .env.example cập nhật các biến mới.

Dedupe normalized URL trước fetch giữ mỗi URL chỉ một lần và giữ ID bằng UPSERT. Test bốn query trả cùng bốn nguồn chỉ fetch bốn lần. Một connection SQLite dùng transaction cho các nhóm ghi; không mở connection mỗi nguồn. Wrapper hiện không hỗ trợ prepared statement reuse nên không thêm tầng database mới.

## Ngôn ngữ, dịch và cache nguồn

language.js trả vi/en/unknown, dựa Unicode tiếng Việt và stop words tiếng Việt/Anh; không gọi Gemini. Đây là nhận diện heuristic, không phải bộ phân loại ngôn ngữ hoàn hảo.

Nguồn vi: sao chép original sang các field Vi, status not_required, zero Gemini. Nguồn en/unknown: metadata riêng, content chia chunk tối đa 2200 ký tự, giới hạn phần dịch mặc định 12000 ký tự. Dịch thất bại chỉ đưa placeholder tiếng Việt vào phần thiếu, không chèn original English vào contentVi nữa. Status pending/complete/partial/failed được lưu. Original title/snippet/content, URL và source ID vẫn giữ.

Hash gồm phiên bản vi-only, language, metadata, phần content cần dịch, chunk size và model. Nguồn vi hash toàn bộ content vì nó được sao chép đầy đủ. Cache complete/not_required dùng lại với zero Gemini; partial/failed được thử lại ở lần thu thập sau. Hash phiên bản mới không reuse bản dịch mixed English từ triển khai cũ.

SQLite migration idempotent thêm source_language, translation_status, translation_hash. Giữ các cột original và *_vi. Model trả thêm sourceLanguage, translationStatus, translationHash và displayTitle/displaySnippet/displayContent. Nguồn legacy chưa có trạng thái mới không được lộ original qua display fields; chạy lại Workflow 2 để cập nhật nguồn cũ.

## Giao diện chỉ tiếng Việt

sourceDisplay.js dùng chung cho cards, danh sách, source detail và tiêu đề source của evidence. Nguồn en/unknown chỉ dùng field dịch đã có trạng thái phù hợp; chưa dịch dùng placeholder tiếng Việt. Nguồn vi được dùng original. Không fallback en title/snippet/content. Source detail bỏ toggle Xem bản gốc và copy nội dung đang hiển thị. URL/provider giữ nguyên. Bộ lọc/sort nguồn dùng giá trị hiển thị.

UI hiển thị thông báo partial/pending, trạng thái translating/analyzing/analyzed_partial và thông báo phân tích một phần sau refresh. Evidence chỉ được trả khi nội dung được nhận diện tiếng Việt. RAG dùng contentVi đáng tin cậy hoặc original của nguồn vi, không dùng English chưa dịch. Placeholder dịch thiếu bị loại khỏi input RAG. Report references dùng displayTitle; report có thể dùng evidence từ kết quả partial nếu có bằng chứng.

## Workflow 3: audit, context và calls

Audit thực tế: trước task, evidence.service gửi một request lớn chứa selected chunks của tất cả câu hỏi. Không có bằng chứng code cũ gọi một request/chunk. Vì vậy không thể báo giảm từ 4×N calls; luồng mới chuyển từ một context lớn sang tối đa một bounded request/câu hỏi ở đường bình thường. Bốn câu hỏi có thể cần bốn calls ban đầu; cache hit cần zero calls. Retry có thể làm số transport calls lớn hơn số câu hỏi.

Mỗi câu hỏi: rank → dedupe exact content → top tối đa 4 chunks → context JSON tối đa 10000 ký tự (tính cả envelope/IDs/URL/title) → một generateJson call. Giới hạn cứng 4/10000 bảo vệ cả .env cũ còn RAG_TOP_K=8. Context giữ chunkId/sourceId/titleVi/url. Chunk IDs xác định theo request/source/index/content để cache ổn định. Validate output đúng cặp source/chunk, text/reason tiếng Việt, không dùng source do model tự tạo.

Global limiter nằm trong generateJson, áp dụng translation/evidence/report; giữ slot tới khi đọc hết response body. Retry ra khỏi slot, không giữ concurrency trong lúc backoff. Các tùy chọn evidence mặc định: concurrency=1, timeout=60000, retry count=4, base delay=1500; backoff/jitter, tối đa attempts hữu hạn.

## 429, quota và partial

Shared retry helper đọc retryAfterMs (seconds hoặc HTTP-date); ưu tiên Retry-After, nếu thiếu dùng exponential backoff+jitter. Header quá 120 giây được trả về để retry sau thay vì ngủ vô hạn. Retry lỗi 408/429/500/502/503/504 và network/timeout/abort; không retry 400/401/403/404/validation.

Gemini error body chỉ được dùng nội bộ để nhận diện dấu hiệu quota theo ngày, billing hoặc limit=0. RESOURCE_EXHAUSTED một mình được coi là throttling tạm thời. Trả code GEMINI_QUOTA_EXHAUSTED hoặc GEMINI_RATE_LIMITED với message tiếng Việt; không lộ raw body/keys. Khi quota exhausted, các câu hỏi chưa bắt đầu được dừng sớm, không retry vô hạn. Không thể sửa hạn mức tài khoản bằng code.

Cache evidence bền vững trong evidence_cache, khóa request/question/input hash (question, selected stable chunk IDs+contents, model, chế độ mock và phiên bản prompt). Cache success được reuse, không gọi Gemini. analysis_results lưu metadata partial/error/metrics để UI refresh vẫn đúng trạng thái.

Câu hỏi lỗi giữ evidence trước đó còn khớp selected chunks, đồng thời giữ evidence các câu hỏi khác. Kết quả dùng analyzed_partial và metadata từng câu hỏi; không xóa toàn bộ phân tích chỉ vì một 429. Nút thử lại dùng cache cho phần đã thành công. Đây là partial thành công ở HTTP/API với lỗi riêng trong metadata, không giả vờ mọi câu hỏi đã xong.

## Kiểm chứng

- Backend npm test: 58 tests, pass 58, fail 0.
- Frontend npm run build: PASS.
- Playwright npm run test:e2e: 5/5 PASS, không skip.
- git diff --check: PASS.
- Runtime GET /health: status ok.

Tests gồm vi bypass/copy; en translation/original preservation; API không fallback English, legacy/pending; dedupe/fetch một lần; concurrency search/fetch/translation/global limiter; hash cache/reuse/invalidation; partial chunk; bounded per-question payload/topK; source/chunk/URL mapping; retry và Retry-After/date parsing; quota stop; 403 no retry; durable evidence cache; partial giữ kết quả cũ; UI tiếng Việt và partial message còn sau refresh. Automated tests không gọi Gemini/Tavily thật.

## Smoke thật và giới hạn kết luận

Chủ đề: Ứng dụng Retrieval-Augmented Generation trong hệ thống hỏi đáp tài liệu.

- Workflow 1 thật gặp Gemini 429: API trả 502, thông điệp quota/rate limit, khoảng 464 ms. Chưa có full run W1→W2→W3 thành công bằng Gemini thật.
- Để đo riêng W2/W3, dùng một plan seed rõ ràng trong database tạm, một câu hỏi/query. Tavily và Gemini vẫn dùng thật; không tạo dữ liệu nghiên cứu giả. Smoke override: HTTP timeout 10 giây, translation/evidence timeout 8 giây, retry 0, phần dịch tối đa 500 ký tự; không sửa .env runtime.
- W2 thật: collected, tổng 4681 ms; search 4594 ms, content fetch 35 ms, bước xử lý ngôn ngữ/dịch 26 ms. Năm nguồn vi, không nguồn en/unknown. Translation calls=0, cache hits=0 ở lần chạy đầu. Original content còn trong cả năm source rows. Lượt smoke này chưa đo được đường dịch en thành công vì không có nguồn en.
- W3 thật cuối sau cap: chọn bốn chunks, một Gemini call cho một câu hỏi, 658 ms, Gemini vẫn 429. Trả analyzed_partial và GEMINI_RATE_LIMITED. Retry count=0 theo override smoke nên metric 429 retries=0; đường retry/Retry-After đã kiểm tra bằng automated tests.
- Cache đo bằng fixture: W2 lần đầu một nguồn vi + ba nguồn en, sáu Gemini calls; lần lặp cache hits=4 và zero Gemini. W3 bốn câu hỏi lần đầu bốn calls, lần lặp cache hits=4 và zero Gemini. Đây là số liệu test, không phải benchmark provider thật.

Không có benchmark trước/sau trên cùng dữ liệu/provider ổn định, nên không tuyên bố hệ số tăng tốc thực tế. Cải thiện đã kiểm chứng là bỏ dịch cho vi, tách concurrency và không gọi lại Gemini khi cache hit. 429 từ tài khoản/provider vẫn tồn tại và được xử lý partial an toàn.

## File của task này

Tạo mới:
- backend/src/utils/language.js
- backend/src/utils/geminiLimiter.js
- backend/src/utils/geminiError.js
- backend/test/workflow23.test.js
- frontend/src/utils/sourceDisplay.js
- WORKFLOW23_VI_ONLY_REPORT.md

Chỉnh sửa (gồm một số file đã untracked từ các task trước):
- backend/.env.example
- backend/src/config/database.js
- backend/src/models/source.model.js
- backend/src/controllers/research.controller.js
- backend/src/services/research.service.js
- backend/src/services/search.service.js
- backend/src/services/translation.service.js
- backend/src/services/llm.service.js
- backend/src/services/chunk.service.js
- backend/src/services/evidence.service.js
- backend/src/services/report.service.js
- backend/src/utils/httpRetry.js
- backend/test/translation.test.js
- backend/test/translation-chunks.test.js
- frontend/src/components/research/SourceCard.jsx
- frontend/src/components/research/SourceList.jsx
- frontend/src/components/ui/Badge.jsx
- frontend/src/hooks/useResearch.js
- frontend/src/hooks/useSearchAndCollect.js
- frontend/src/pages/SourceDetailPage.jsx
- frontend/src/pages/Workflow2Page.jsx
- frontend/src/pages/EvidencePage.jsx
- frontend/src/pages/ReportPage.jsx
- frontend/src/services/researchApi.js
- frontend/tests/research.spec.js

Giữ nguyên mọi thay đổi local trước task, không sửa n8n, không ghi đè .env thật, chưa commit/push.

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
 M backend/src/services/search.service.js
 M backend/src/utils/httpRetry.js
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
 M frontend/src/components/ui/Badge.jsx
 M frontend/src/hooks/useResearch.js
 M frontend/src/hooks/useSearchAndCollect.js
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
?? TRANSLATION_REFACTOR_REPORT.md
?? WORKFLOW23_VI_ONLY_REPORT.md
?? backend/src/services/chunk.service.js
?? backend/src/services/evidence.service.js
?? backend/src/services/relevance.service.js
?? backend/src/services/report.service.js
?? backend/src/services/translation.service.js
?? backend/src/utils/geminiError.js
?? backend/src/utils/geminiLimiter.js
?? backend/src/utils/language.js
?? backend/test/translation-chunks.test.js
?? backend/test/translation.test.js
?? backend/test/workflow23.test.js
?? frontend/src/pages/EvidencePage.jsx
?? frontend/src/pages/ReportPage.jsx
?? frontend/src/utils/sourceDisplay.js
?? n8n/workflows/WORKFLOW3_SETUP.md
?? n8n/workflows/WORKFLOW4_SETUP.md
?? n8n/workflows/workflow-3-evidence-rag.json
?? n8n/workflows/workflow-4-report-generation.json
?? package-lock.json
```
