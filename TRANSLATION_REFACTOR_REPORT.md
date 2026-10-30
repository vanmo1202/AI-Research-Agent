# Refactor Translation: Chunk, Retry, Cache, Fallback

Ngày: 2026-10-30, Asia/Ho_Chi_Minh.

## Nguyên nhân và phạm vi kết luận

Thiết kế cũ gửi title + snippet + content (tối đa 12.000 ký tự content) trong một request và dùng timeout/retry HTTP chung. Khi request lỗi, mất toàn bộ bản dịch nguồn. Đây là điểm làm request nặng và fallback quá rộng; chưa có bằng chứng payload lớn là nguyên nhân duy nhất của timeout. Smoke test thật mới còn gặp Gemini HTTP 503 ngay ở planner, trước bước dịch. Refactor tăng khả năng chịu lỗi; không bảo đảm sửa được sự cố mạng/provider bên ngoài.

## Kiến trúc sau thay đổi

- Metadata title/snippet dùng request JSON riêng, mỗi field có giới hạn theo chunk size. Dịch lỗi trả titleVi/snippetVi null.
- Content chỉ lấy tối đa TRANSLATE_MAX_CONTENT_CHARS để dịch, không sửa nguồn gốc.
- splitTextForTranslation ưu tiên newline/paragraph, rồi ranh giới câu, khoảng trắng, cuối cùng character split; bỏ chunk rỗng, trim và giữ thứ tự.
- Dịch tuần tự từng chunk với JSON {translatedText}. Không gửi nguyên source trong một request.
- Retry độc lập từng request; không có nested retry trong llm.generateJson khi translation điều khiển retry bên ngoài.
- Chunk vẫn lỗi sau retry được thay bằng chính chunk gốc tại cùng vị trí; ghép bằng hai newline. Các chunk dịch thành công không bị mất.
- Content hoàn toàn lỗi vẫn có thể trả contentVi chứa các chunk gốc. Log ghi failed/partial và số chunk fallback. Metadata lỗi không ngăn content dịch, content lỗi không xóa metadata đã dịch.
- Source được chuẩn bị trước bước dịch, sau đó transaction lưu nguyên bản và các field dịch; translation failure không làm Workflow 2 thất bại. DB/search failure giữ logic cũ.

## Cấu hình mặc định

| Biến | Giá trị |
| --- | --- |
| TRANSLATE_SOURCE_CONTENT | true |
| TRANSLATE_CHUNK_CHARS | 2200 |
| TRANSLATE_MAX_CONTENT_CHARS | 12000 |
| TRANSLATE_CONCURRENCY | 1 |
| GEMINI_TRANSLATION_TIMEOUT_MS | 45000 |
| GEMINI_TRANSLATION_RETRY_COUNT | 3 |
| GEMINI_TRANSLATION_RETRY_BASE_DELAY_MS | 1000 |

Ba retry nghĩa là tối đa bốn attempts/request. Backoff khoảng 1/2/4 giây, mỗi lần cộng jitter 0–299 ms. Timeout 45 giây là cho mỗi request, không phải deadline toàn Workflow 2. Timeout và retry count được kiểm tra giới hạn hợp lệ. Planner/report/evidence không bị chuyển sang timeout translation.

Retry: AbortError, TimeoutError, TypeError, HTTP 408/429/500/502/503/504. Không retry HTTP 400/401/403/404 hay JSON/schema/URL validation lỗi. Lỗi khi đọc response body do timeout vẫn được giữ để retry. Shared retry helper có options riêng nhưng mặc định của các caller cũ được giữ.

Chỉ .env.example được cập nhật; không ghi đè .env thật. Automated tests stub provider, không dùng Gemini thật.

## Cache và database

Reuse cache cấp source: normalizedUrl và title/snippet/content gốc phải giống bản đã lưu; các field dịch cần thiết phải tồn tại. Log Reusing cached translation và không gọi Gemini. Không có input tương ứng thì không bắt buộc field dịch đó. Original thay đổi thì dịch lại; UPSERT giữ nguyên source ID và URL. Bản dịch partial có đủ các field vẫn có thể được tái sử dụng.

Không thêm cột hoặc bảng trong refactor này. Giữ title_vi/snippet_vi/content_vi, model mapping và migration idempotent của lần triển khai trước. So sánh original trực tiếp đủ cho cache hiện tại, không thêm hash/chunk cache table.

RAG vẫn ưu tiên contentVi rồi content, kể cả bản partial. sources.content gốc còn nguyên. Không đổi citation, source mapping, frontend layout hay toggle Xem bản gốc/Xem bản dịch.

## Kiểm chứng

- Backend npm test: 49 tests, pass 49, fail 0.
- Frontend npm run build: PASS.
- Playwright npm run test:e2e: 5/5 PASS, không sửa/skip test Playwright trong refactor này.
- git diff --check: PASS.

Tests bổ sung/cập nhật kiểm tra splitting, payload tách biệt/giới hạn, timeout riêng, retry từng status và network error, không retry validation, timeout khi đọc body, fallback một chunk đúng vị trí, metadata failure độc lập, giới hạn tổng nội dung, bounded concurrency 1, cache reuse/invalidation, source ID/URL ổn định, persist/API, migration legacy, RAG/report và không gọi Gemini thật. Không bỏ các kiểm tra original preservation hoặc provider errors của bộ test trước; cập nhật kỳ vọng theo fallback từng chunk.

## Smoke test thật

1. Dùng database tạm, có cả Gemini/Tavily keys nhưng không in key. Với chủ đề “Ứng dụng Retrieval-Augmented Generation trong hệ thống hỏi đáp tài liệu”, Workflow 1 trả 502 với thông điệp an toàn Gemini API request failed (HTTP 503). Chưa đạt planned nên chưa chạy được Workflow 2 end-to-end thật. Riêng planner smoke giới hạn timeout HTTP 10 giây, retry 0 để chẩn đoán nhanh; không sửa cấu hình runtime.
2. Smoke riêng một nguồn Tavily thật thành công, URL https://aws.amazon.com/vi/what-is/retrieval-augmented-generation. Giới hạn dịch 500 ký tự, timeout 10 giây/request, một retry (override chỉ trong process smoke). Metadata lỗi sau retry, chunk content cũng lỗi sau retry; service vẫn hoàn tất với titleVi/snippetVi null và contentVi là chunk gốc. Source và URL không thay đổi; originalContentChars=10701, fallbackContentChars=499 sau trim.

Chưa xác nhận bản dịch Gemini thật thành công trong môi trường này. Fallback thật đã được quan sát; cả đường thành công/partial/failed và Workflow 2 collected được kiểm chứng bằng mocks trong automated tests.

## Files của refactor này

Tạo mới:
- backend/test/translation-chunks.test.js
- TRANSLATION_REFACTOR_REPORT.md

Chỉnh sửa:
- backend/.env.example
- backend/src/services/translation.service.js (đã untracked từ task trước)
- backend/src/services/llm.service.js
- backend/src/services/research.service.js
- backend/src/utils/httpRetry.js
- backend/test/translation.test.js (đã untracked từ task trước)

Không commit/push, không reset/clean và giữ mọi thay đổi local có sẵn. Không sửa n8n.

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
?? backend/src/services/chunk.service.js
?? backend/src/services/evidence.service.js
?? backend/src/services/relevance.service.js
?? backend/src/services/report.service.js
?? backend/src/services/translation.service.js
?? backend/test/translation-chunks.test.js
?? backend/test/translation.test.js
?? frontend/src/pages/EvidencePage.jsx
?? frontend/src/pages/ReportPage.jsx
?? n8n/workflows/WORKFLOW3_SETUP.md
?? n8n/workflows/WORKFLOW4_SETUP.md
?? n8n/workflows/workflow-3-evidence-rag.json
?? n8n/workflows/workflow-4-report-generation.json
?? package-lock.json
```
