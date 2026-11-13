# ResearchOS Frontend rebuild

## Audit và thiết kế — 2026-11-09

Đặc tả: tệp yêu cầu người dùng, full frontend rebuild trong repository hiện tại. Giữ React 19/Vite 8, JavaScript, Express/PostgreSQL, 5 JSON workflow và tất cả thay đổi chưa commit. Không migration, không restart backend/worker/database/n8n, không commit/push. `docs/POSTGRESQL_MIGRATION_REPORT.md` không tồn tại. Đã đọc compatibility/readiness: source PASS trước đây không chứng minh runtime/Cloud đã triển khai.

Thiết kế: navy/blue/white, typography Inter, navigation theo công việc, dashboard dữ liệu thật, run workspace sáu giai đoạn có URL bền vững. Giữ chức năng PDF/chat/memory hiện có thay vì viết lại các hợp đồng đã đúng. Không thêm framework, thư viện hay dark mode khi chưa có nền tảng. Luồng cũ vẫn truy cập được cho dữ liệu legacy.

## API-to-screen compatibility matrix

Tất cả `/api` yêu cầu session `research_session` HttpOnly, SameSite=Lax, Secure theo môi trường; mutations được CSRF middleware kiểm tra Origin/Referer bằng `FRONTEND_ORIGIN`. Browser tự gửi Origin, không có CSRF token endpoint. Responses `{success:true,data}` hoặc `{success:false,error,code?,stage?,requestId?}`. Ownership kiểm tra ở Backend, không nhận owner từ UI. Chỉ `/health` và login/register không cần phiên.

| Màn hình / workflow | Public API thực tế | Khả năng / giới hạn |
|---|---|---|
| Login/Register/Account | `/api/auth/me`, POST `login/register/logout/change-password` | Session restoration, protected routes; không JWT/localStorage secrets |
| Dashboard | GET `/api/dashboard`, `/api/research` | Tổng research/PDF/memory/completed; danh sách tối đa 200 research với latestRunId/runStatus, không có tổng mọi run |
| Full research / WF01 | POST `/api/research` với executionMode async; POST `/api/research/:id/runs`; GET `/:id/runs/:runId/progress` | Sáu stage, options vi/en, 1–30 nguồn, searchMore; backend orchestration mặc định, không gọi webhook |
| Run workspace / WF01 | GET `/api/research/runs/:runId/{sources,evidence,reports}`; POST `retry/cancel`; GET `/api/research/reports/:reportId/export/{pdf,docx}` | Retry/create run bắt buộc Idempotency-Key, terminal partial giữ nguyên; GET không tạo job |
| Legacy research | GET `/api/research/:id`, sources/evidence/report; POST search/analyze/report | Giữ đường dẫn cho nghiên cứu cũ |
| PDF / WF02 | GET/POST `/api/documents`; GET `/:id`, `/:id/file`, `/:id/pages/:page`; POST `/:id/retry`; DELETE `/:id` | Upload multipart, pending/processing/ready/failed thật; giới hạn từ `/api/knowledge/config` |
| PDF attachment | POST `/api/research/:id/documents`, DELETE `.../:documentId`; GET `/api/documents?requestId=` | Backend kiểm tra sở hữu cả nghiên cứu và PDF |
| Chat / WF03 | GET/POST `/api/chats`, `/api/research/:id/chats`; GET/DELETE `/api/chats/:id`; GET/POST `/:id/messages`; PATCH `/:id/preferences` | clientToken cho từng lượt, lịch sử, PDF/research/combined, citations từ backend |
| Memory / WF04 | GET `/api/memories`, `/search?q=&status=`; POST `/:id/approve`, `/:id/reject`; DELETE `/:id`; POST `/api/research/:id/memory-recall` | Trạng thái thật là candidate/verified/rejected/stale, chia sẻ chỉ trong tài khoản |
| Schedules / WF05 | GET/POST `/api/research/schedules`; PATCH `/:id` với enabled | Có API public. Chỉ tạo/list/bật/tắt; không có sửa options, delete, chu kỳ/timezone, dispatch history/lastRun API |
| Internal automation | `/internal/**`, X-Internal-Api-Key; 5 n8n graphs 33/13/10/5/7 node | Chỉ backend/n8n; browser tuyệt đối không gọi |

## Kế hoạch triển khai

- [x] Chung API client, errors/timeout/session; giữ auth policy và export/PDF binary.
- [x] Kiểm thử mock browser trước cho run resume/partial/retry idempotency và schedules.
- [x] Form tạo async request rồi tạo run; giữ request ID khi run creation lỗi; khóa gửi trùng. Run URL `/research/:requestId/runs/:runId`, polling cleanup/backoff/budget; sources/evidence/report/events, cancel/retry/export.
- [x] Dashboard thật + danh sách nghiên cứu tìm/lọc và liên kết latest run. Schedules create/list/toggle, công khai giới hạn API.
- [x] Navy design tokens, navigation responsive, giữ PDF/chat/memory, sửa trạng thái và citations nếu cần.
- [x] Build, các test hiện có và test mới, browser 375/768/1440; Docker frontend build; ghi rõ PASS/FAIL/BLOCKED.

Review focus: không tạo run khi refresh; ambiguous timeout giữ cùng idempotency key; partial khác completed; 401 quay lại URL an toàn; API thiếu không hiển thị success/zero giả; polling dừng terminal/unmount và không gọi provider thật.


## Màn hình và thay đổi đã triển khai

- Dashboard thay toàn bộ bố cục cũ: thống kê thật có phạm vi rõ ràng, recent research/latest run, liên kết PDF/chat/memory/schedules. Không hiển thị số 0 khi API lỗi.
- New Research: form chủ đề/mục tiêu/phạm vi/độ dài, vi/en, 1–30 nguồn, searchMore; POST async request rồi POST run backend orchestration. Giữ request và key khi chưa xác nhận run, khóa gửi trùng.
- Research History và Research Entry: tìm/lọc tối đa 200 nghiên cứu từ server; mở latest run, giữ màn hình cũ cho dữ liệu legacy, tạo run từ request `created` đã lưu. Chưa có endpoint liệt kê mọi run, nên không bịa lịch sử run đầy đủ.
- Run Workspace: URL chứa requestId/runId; refresh chỉ GET. Planning/Collecting/Analyzing/Evaluating/Composing/Verifying, progress, rounds, events, nguồn bất biến, evidence/quotes/provenance/coverage/gaps, report preview/verification/references, export PDF/DOCX, retry/cancel đúng trạng thái. Partial không đổi thành completed.
- PDF Library/Detail, PDF Chat/Research Chat, Memory và Auth: giữ chức năng thật đã có, đồng bộ navy/blue/white; sửa số liệu khi lỗi, trang PDF nguyên, provenance nullable, citation panel link an toàn, báo tạm dừng polling. Memory dùng candidate (tương đương chờ duyệt), không tự approve; lựa chọn chia sẻ ghi rõ trong cùng tài khoản.
- Schedules: list/create/enable/disable đúng API; tạo ở trạng thái tắt, không coi bật lịch là bằng chứng automation hoạt động. Hiển thị giới hạn chu kỳ/timezone/dispatch history.
- Shell: navigation theo công việc, server-backed global search, responsive sidebar/focus trap/Escape, skip link, focus visible, reduced motion; Error Boundary và route lazy loading.
- Chung API client: credentials include, envelope/error/status, timeout, AbortSignal cleanup, binary download, 401 expiry tập trung. Không JWT hoặc session/password trong localStorage. Session restoration phân biệt 401 với mất kết nối (cho retry). CSRF giữ nguyên Origin/Referer policy, không tự tạo token.
- Polling: tối đa 240 lần mỗi lượt quan sát, chậm dần 2.2–10s, tab ẩn 15s, lỗi transient backoff tối đa 30s/4 retries, dừng khi terminal/unmount hoặc lỗi quyền. Chỉ GET được poll; không tự retry POST.

## BLOCKED / giới hạn hợp đồng

1. **Run-context Chat**: Backend `knowledge/retrieval.js` đọc legacy `sources/evidence`, không đọc `source_versions/analysis_versions` của run mới. UI công khai giới hạn; Run Workspace dẫn đến Chat PDF. PDF/legacy research/combined chat vẫn dùng API thật. Không sửa Backend để nối context và không tự tạo citations. Memory từ các run v2 cũng không có API theo runId; Memory hiện quản lý dữ liệu Backend đã cung cấp.
2. Sửa cấu hình/xóa schedule, thay chu kỳ/timezone, xem latest dispatch/run và quota còn lại: thiếu public API. Không gọi `/internal/research/schedules/dispatch`. Backend quản lý cửa sổ ngày Asia/Ho_Chi_Minh; n8n vẫn cần operator triển khai và gắn lịch.
3. Tổng mọi run/lịch sử mọi run: thiếu API, `/api/research` chỉ trả tối đa 200 request và latest run mỗi request. Dashboard ghi rõ phạm vi.
4. POST tạo request chưa có idempotency contract. Nếu chính request POST bị mất phản hồi, UI yêu cầu kiểm tra lịch sử trước khi gửi lại. POST tạo run/retry sau khi có requestId dùng key ổn định; không tự gửi lại mutation. Key/request đang chờ nằm trong memory của form, không phải secret; reload dùng lịch sử server để khôi phục run đã xác nhận.
5. Production/Cloud chưa kiểm thử: readiness trước đó ghi image/schema/network/automation identity chưa đồng bộ. Không chạy migrations hoặc triển khai để vượt blocker.

## Review và kiểm thử

Đã review độc lập Frontend và đối chiếu Backend source. Sửa lỗi retry do disabled fieldset làm FormData thiếu topic/goal (test tái hiện TypeError trước, PASS sau); sửa tên field source_versions và làm rõ run-context chat BLOCKED. Test ban đầu xác nhận các màn hình run/schedule chưa tồn tại trước triển khai. Không thay workflow JSON/Backend/Worker/PostgreSQL hoặc volumes.

| Kiểm tra | Kết quả |
|---|---|
| `npm --prefix frontend run build` | PASS — Vite production build |
| `npm --prefix frontend run format:check` | PASS — toàn bộ source/tests/config theo Prettier |
| ESLint / frontend unit suite | N/A — project không có cấu hình ESLint hoặc unit runner riêng |
| `npm --prefix frontend run test:rebuild` | PASS — 21/21 Playwright tests (34.9s), API mock, không có provider/database thật |
| Responsive | PASS 375/768/1440px cho dashboard/new research/run/PDF/chat/memory/schedules; kiểm tra scrollWidth và screenshot dashboard/run |
| Browser errors/security boundary | Kiểm thử bắt pageerror và từ chối request `/internal`; production không có fixture/mock fallback |
| `npm --prefix frontend test` (suite cũ) | BLOCKED ở launcher: chưa cấu hình PostgreSQL test cô lập. Không khởi tạo DB/migration. Assertions UI cũ cũng cần cập nhật trước khi chạy tích hợp |
| Docker Frontend build | PASS — image `researchos-frontend-rebuild:local`, build cuối sau review |
| Backend 175 / n8n 8 scenarios | Không chạy lại trong phiên này; không dùng kết quả trước để tuyên bố production E2E PASS |

Mock browser coverage: new form required/config và async create, run resume/refresh không POST, failed create-run retry cùng key/request, partial/gaps/six stages, retry cùng key khi 503, cancel/terminal actions, raw source version fields, report preview/verification/public PDF download, 401 return path, session503 retry, register confirmation, dashboard503, PDF upload/processing/failed, chat send/clientToken/citation PDF page, memory approve/reject, schedule create/toggle/API404, responsive và keyboard menu/Escape. Mock chỉ nằm trong `tests/`, production dùng API thật.

Chưa kiểm thử: provider chất lượng thật, upload PDF/RAG thật với PostgreSQL/Worker, cross-user ownership bằng browser live, DOCX payload thực, n8n transport/Cloud credentials, schedule dispatch thực, production load/soak và hỗ trợ PDF viewer trên mọi mobile browser. Backend ownership/CSRF không được thay đổi; các kiểm thử mock không chứng minh bảo mật server.

Logs: `/tmp/researchos-frontend-build.log`, `/tmp/researchos-frontend-format.log`, `/tmp/researchos-frontend-rebuild-tests.log`, `/tmp/researchos-frontend-docker-build.log`. Screenshots mock: `/tmp/researchos-rebuild-{dashboard,run}-{375,768,1440}.png`.

## File thay đổi

- Mới: `frontend/src/services/{apiClient,runApi}.js`; `pages/{NewResearchPage,ResearchEntryPage,ResearchHistoryPage,RunWorkspacePage,SchedulesPage}.jsx`; `components/research/ResearchRows.jsx`; `components/ui/ErrorBoundary.jsx`; `styles/workspace.css`; `frontend/playwright.rebuild.config.js`, `frontend/tests/rebuild.spec.js`.
- Sửa: `frontend/package.json`, `src/{App,main}.jsx`, `auth/AuthProvider.jsx`, `services/{researchApi,knowledgeApi}.js`, `hooks/useKnowledge.js`, `utils/researchStorage.js`; `components/layout/{AppLayout,Header,Sidebar}.jsx`, `components/ui/Badge.jsx`, `components/knowledge/{ChatPanel,MemoryCard}.jsx`; `pages/{DashboardPage,LoginPage,SettingsPage,DocumentLibraryPage,DocumentDetailPage,ResearchChatPage}.jsx`; `tests/start-backend.cjs` (chặn DB test chưa cô lập; PGDATABASE researchos_test_* và PGSCHEMA test_*); `README.md` và báo cáo này.
- Không thay Backend, năm workflow JSON, database/volumes, compose hay Dockerfile. Không tạo lại env examples, không commit/push/merge. Các thay đổi trước phiên vẫn giữ nguyên.

## Chạy và Docker

```sh
npm --prefix frontend run dev
npm --prefix frontend run build
npm --prefix frontend run test:rebuild
# Chỉ build image; không up/recreate dịch vụ khác
 docker build -t researchos-frontend-rebuild:local frontend
```

Dev mặc định proxy `/api` và `/health` đến `127.0.0.1:3000`; API khác origin dùng `VITE_API_BASE_URL` hiện có. Backend `FRONTEND_ORIGIN` phải khớp origin browser chính xác (kể cả port) và cookie Secure phải phù hợp HTTPS. Không cần secret ở browser. Mock test chạy Vite port4175 + Chrome; có thể đặt `PLAYWRIGHT_CHROME_PATH` tới Chromium đã cài.

Docker image dùng Nginx hiện có, proxy `/api` tới `backend:3000`. Để chạy image riêng cho kiểm tra thủ công, chỉ sau khi đã xác định network của Backend đang chạy và origin được CSRF cho phép:

```sh
# Thay <existing-backend-network> và port bằng cấu hình thực của môi trường
 docker run --rm --name researchos-frontend-preview --network <existing-backend-network> -p 127.0.0.1:8088:80 researchos-frontend-rebuild:local
```

Lệnh run trên chỉ là hướng dẫn, chưa thực thi. Không dùng Compose up toàn stack, migrate, down hoặc xóa volume cho việc kiểm tra Frontend. Health không chứng minh Backend đủ phiên bản mới; production E2E vẫn BLOCKED theo readiness.
