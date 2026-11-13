# ResearchOS — rebuild theo interactive demo

Cập nhật: 2026-11-10 (Asia/Ho_Chi_Minh).

## Phạm vi và audit

Branch `feat/researchos-ui-rebuild`, tạo từ checkout đang có thay đổi chưa commit. Nguồn thiết kế: `design/reference/researchos_demo/index.html`, README và hero/thumb1–3.webp. Đọc HTML/CSS/JS: demo có 13 views, CSS navy #192c4d/sidebar238px/header62px, banner187px, 4 stats, 5 function cards, recent research/knowledge/activity/quick access, dialog/search/toast; JavaScript seed/localStorage và các hành động giả lập **không được đưa vào production**. Các ảnh chỉ dùng làm minh họa, không giả là nguồn nghiên cứu.

Giữ React/Vite/Inter/Lucide, API client/session/CSRF, run sáu giai đoạn và toàn bộ PDF/RAG/Memory/schedule hiện có. Không sửa Backend, database/migrations, workflow JSON hay cấu hình Docker production. SHA-256 code Backend/n8n/reference/Docker được ghi trước thay đổi tại `/tmp/researchos-ui-protected-hashes.json`; trạng thái Git tại `/tmp/researchos-ui-start-status.txt`. Không commit/push/merge.

## Mapping demo → API thật

| Demo | Production React / public session API | Giới hạn |
|---|---|---|
| Header/search/account | Search nghiên cứu `/api/research`, PDF `/api/documents`; auth me/login/register/logout/change-password giữ nguyên | Không có search toàn bộ báo cáo; không có notification/unread service |
| Dashboard 4 stats | `/api/dashboard` researchCount/documentCount/verifiedMemoryCount/completedCount | Không bịa trend tuần hoặc tổng report/chat từ danh sách giới hạn |
| Nghiên cứu tổng hợp | Async request + run API, six stages/progress/retry/cancel | WF01; không có nút tự đánh dấu stage hoàn tất |
| Phân tích bằng chứng | Chọn nghiên cứu → run sources/evidence; legacy analyze API giữ nguyên | Cũng thuộc WF01, không phải WF02; không bịa quality/citation count |
| Tạo báo cáo | Chọn nghiên cứu → run reports/export PDF/DOCX; legacy report API giữ nguyên | Cũng thuộc WF01; chỉ hiển thị report đã lưu, không xuất báo cáo mẫu |
| PDF/Knowledge | `/api/documents`, file/pages/retry/delete, research attachment | WF02; upload multipart thật, trạng thái do Worker quyết định |
| Chat RAG | `/api/chats`, research chats/messages/preferences; clientToken/citations thật | WF03; run v2 context chưa được retrieval backend hỗ trợ, PDF/legacy vẫn hoạt động |
| Agent Memory | `/api/memories`, search/approve/reject/delete/memory-recall | WF04; candidate/verified/rejected/stale; không có tạo memory thủ công/unapprove API |
| Tự động hóa n8n | Public schedules list/create/PATCH enabled, 5 workflow được mô tả theo source | WF05; chưa có public n8n health/execution log/dispatch/manual-run/credential config API; không gọi internal/webhook |
| Hoạt động/thông báo | Dấu thời gian thật của research/docs/memories/chats; run events giữ ở màn hình run | Feed suy ra từ tài nguyên, không phải audit log đầy đủ; không bịa thời gian/chấm unread |
| Thống kê | Số liệu tài khoản và trạng thái latest run của tối đa 200 requests | Không có time-series API; không dùng biểu đồ seed |

Auth: browser gửi session cookie HttpOnly qua credentials include, Backend kiểm tra Origin/Referer cho CSRF và ownership. Không thay authentication, không JWT/localStorage business store, không đưa X-Internal-Api-Key ra browser. `/internal/**` chỉ dành cho server/n8n.

## Thiết kế và kế hoạch triển khai

Theo chỉ thị triển khai trực tiếp: chuyển CSS demo sang namespace `ref-*` và reusable React components, không nhúng HTML/iframe hoặc logic mô phỏng. Giữ routes hiện có; bổ sung catalog/workflows/automation/activity/help và các alias tương thích. Dùng native dialog có focus/Escape/return focus; toast chỉ sau phản hồi API thành công. Palette nhiều màu của năm thẻ theo **mẫu mới** thay thế ràng buộc palette cũ.

- [x] Test trước: 4 stats/5 cards, n8n menu, global search/dialog keyboard, API-backed upload/create, no internal API, responsive.
- [x] Shell/nav phân cấp/header/avatar/search/notifications và UI primitives dialog/toast.
- [x] Dashboard và workflow cards sát demo, hero/WebP, real recent data/activity/knowledge/quick links.
- [x] Catalog bằng chứng/báo cáo, sessions, statistics/help, n8n automation theo public schedule API.
- [x] Đồng bộ detail/form/PDF/chat/memory với visual tokens và interaction; giữ API hiện có.
- [x] Build/format/tests/browser screenshots, so sánh mẫu và sửa sai lệch, xác minh protected hashes; ghi PASS/FAIL/BLOCKED và Docker instructions.

Review focus: không giả stage/progress, không dùng localStorage seed, không biến candidate thành verified trước response, n8n unknown khác disconnected/healthy, blocked API không giả success, không ghi đè thay đổi cũ.


## Kết quả triển khai

- Dashboard giữ sidebar navy238px/header62px, banner hero/WebP, bốn chỉ số thật, năm thẻ pastel theo mẫu, thumbnails minh họa, recent research, Knowledge Workspace, activity và quick access. Bỏ trend/số mẫu; metric thứ ba là số nghiên cứu hoàn thành có trong API, thay cho tổng chat giả trong demo.
- Sidebar phân cấp giữ **Tự động hóa (n8n)**, thêm lối vào workflows/sessions/reports/knowledge/activity/help. Không xóa các routes cũ, auth, retry/cancel, PDF attachment, report export, research/PDF/combined chat hoặc Memory sharing.
- `WorkspaceUI`/native `WorkspaceDialog`/search/notifications/upload dialog và toast được tách component. Search lấy nghiên cứu/PDF của tài khoản, hỗ trợ Ctrl/Cmd+K, Arrow keys, Enter, Escape và return focus. Ctrl/Cmd+N mở form nghiên cứu thật. Toast chỉ phát khi public API xác nhận success, không phải chứng nhận run/ingestion hoàn tất.
- Form tạo nghiên cứu trong dialog dùng lại `NewResearchPage`, async request → idempotent backend run; không dùng tên/lĩnh vực/depth giả của demo. Progress vẫn sáu stage, Partial giữ nguyên; chọn bằng chứng/báo cáo từ catalog mở đúng tab qua URL `?tab=evidence/report`.
- Catalog `/evidence` và `/reports` dùng requests/latestRun, không bịa report/quality/citation count khi chưa tải kết quả. Thư viện/PDF detail/chat/memory/run/form được đồng bộ visual tokens với mẫu; sessions hiển thị dạng thẻ responsive.
- n8n `/automations` có schedule list/create/enable/disable thật và năm workflow kỹ thuật được mô tả theo source. Kết nối hiển thị **chưa có dữ liệu xác nhận**, không suy ra connected/disconnected từ schedule list. Không có nút chạy thử hoặc cấu hình credentials giả. `/schedules` cũ vẫn hoạt động.
- PDF chọn tệp hoặc kéo thả một PDF, dùng multipart upload thực, giữ trạng thái Backend. Từ chối multi-file drop và xóa lựa chọn cũ để không gửi nhầm tệp. Metadata hoạt động và điều hướng lấy từ API; `useResearchHistory` không còn đọc localStorage làm danh sách nghiệp vụ. Helper cache legacy còn giữ metadata điều hướng, mọi nội dung vẫn tải qua API.
- Responsive375/768/1440, keyboard sidebar/dialog, focus visible, safe-area toast, reduced motion. Rà soát các quy tắc phù hợp từ [Web Interface Guidelines](https://raw.githubusercontent.com/vercel-labs/web-interface-guidelines/main/command.md). Đây không phải chứng nhận WCAG đầy đủ.

## Lỗi đã sửa và review

- Test Ctrl+K đợi workspace khôi phục session xong trước khi gửi phím. Browser `type=search` có thể dùng Escape để xóa query trước native dialog cancel; thêm handler Escape rõ ràng và restore trigger focus. Test đã tái hiện FAIL rồi PASS.
- Multi-file PDF drop giữ lại tệp chọn trước đó: xóa input/selected name khi từ chối; test FAIL→PASS, thêm test multipart drop một tệp.
- Dialog tạo schedule trước đó giấu quota/API error ở phần trang bên ngoài modal: đưa error vào form, giữ dialog khi lỗi, chỉ đóng khi create được Backend xác nhận; test FAIL→PASS.
- Lỗi tải activity không biến thành “chưa có hoạt động”; vẫn giữ error/partial state.
- Review độc lập các phần dashboard/dialog/search/notifications/toast/PDF drop/catalog/navigation/activity/API events/history: không phát hiện Critical/Important đã xác nhận. Bản sửa schedule dialog và CSS accessibility được tác giả kiểm tra bằng regression/browser, chưa có review độc lập chi tiết. Không sửa Backend/database/n8n.

## Build / tests

| Kiểm tra thực thi | Kết quả |
|---|---|
| Baseline `npm --prefix frontend run test:rebuild` | PASS21/21 trước thay đổi demo |
| Tests mới trước triển khai demo | FAIL3 yêu cầu dashboard/search/n8n chưa tồn tại, đúng kỳ vọng |
| `npm --prefix frontend run build` | PASS — Vite production bundle |
| `npm --prefix frontend run format:check` | PASS sau format các file thay đổi |
| ESLint / unit runner riêng | N/A — repository chưa có ESLint config/script hoặc unit runner frontend riêng |
| `npm --prefix frontend run test:rebuild` | PASS32/32 (1.2m), API mock, gồm các regression PdfUpload/dialog cuối |
| Responsive / screenshot | PASS375/768/1440, không tràn viewport; sidebar/mobile/search/dialog/các routes mới và PDF/chat/memory/run được kiểm tra |
| `npm --prefix frontend test` (suite cũ) | BLOCKED launcher do thiếu PostgreSQL test cô lập; không khởi tạo DB/migration |
| `npm --prefix backend test` | BLOCKED ở preload: PGDATABASE test không được cấu hình; không chạy against production |
| `node backend/test/researchos-workflows.test.js` | PASS5/5 contract/topology/security tests offline; không gọi n8n hoặc provider |
| Docker local Frontend build | PASS — `researchos-frontend-reference:local`; chỉ build image từ Dockerfile hiện có, không chạy stack |
| Protected hashes | PASS151/151 code Backend/n8n/reference và Docker config giữ nguyên; bốn ảnh copy trùng SHA-256 với mẫu |
| `git diff --check` | PASS |

Playwright dùng API mocks **chỉ trong tests**. Coverage: auth/session restoration/register validation/401 return path; create/resume/refresh/retry-idempotency/cancel/Partial run; evidence gaps/source-version fields/report preview/public PDF export; PDF upload/drop/processing/failed; chat/clientToken/citations; Memory approve/reject; schedules/API404/429 dialog; four live stats/five cards; global search/keyboard/notifications; responsive navigation. Không có mock fallback hoặc seed/localStorage demo trong production.

Artifacts tạm: `/tmp/researchos-demo-{build,format,tests-final,legacy-tests,backend-regression,backend-contract-tests,docker-build}.log`. Ảnh demo gốc: `/tmp/researchos-original-demo-{375,768,1440}.png`; ảnh React: `/tmp/researchos-reference-{dashboard,automations}-{375,768,1440}.png` và `/tmp/researchos-rebuild-{dashboard,run}-{375,768,1440}.png`. Đã xem ảnh và đối chiếu bố cục/màu/sidebar/header/hero/cards; chữ phụ được tăng nhẹ để dễ đọc. Các khác biệt về số liệu, trạng thái và nút thao tác xuất phát từ API thật, không sao chép dữ liệu mẫu.

## Tính năng chưa có public API / chưa kiểm thử live

- n8n connection health, executions, logs, run-now, credential editing: **BLOCKED**, không gọi internal/webhook từ browser.
- Sửa/xóa schedule, chọn cron/timezone, last dispatch/run lịch, quota remaining: **BLOCKED**. API hiện chỉ list/create/toggle enabled, cửa sổ ngày Asia/Ho_Chi_Minh.
- Chat theo nguồn/bằng chứng run v2: **BLOCKED ở retrieval Backend**; PDF/legacy research chat vẫn hoạt động. Không giả citations hoặc tự copy run context vào frontend.
- Tạo Memory thủ công/thu hồi approve về candidate: thiếu API; chỉ giữ approve/reject/delete/search thật. Không tự approve, không làm lộ user khác.
- Tổng mọi run/report/chat và biểu đồ theo tuần, notification unread/audit stream, global report search: thiếu API phù hợp. Sử dụng phạm vi danh sách và metric đang được cung cấp, ghi rõ giới hạn.
- POST tạo request chưa có idempotency contract; giữ xử lý cũ yêu cầu kiểm tra lịch sử nếu chính request POST mất phản hồi. Create-run/retry dùng key ổn định sau khi có requestId.
- Chưa kiểm thử provider live, PDF parsing/RAG thật với PostgreSQL/Worker, tenant isolation/CSRF qua browser live, DOCX binary thực, n8n Cloud transport/credentials, schedule dispatch thật hoặc production deployment. Không gọi Gemini/Tavily. Test mock và build **không chứng minh production E2E PASS**.

## File thay đổi trong lượt rebuild theo demo

Mới: `frontend/src/assets/reference/{hero,thumb1,thumb2,thumb3}.webp`, `components/workspace/{WorkspaceUI,WorkspaceDialog,WorkspaceSearch,WorkspaceNotifications,UploadDialog,FeatureCards,PanelHeading,ActivityList}.jsx`, `components/workspace/activity.js`, `pages/{WorkflowsPage,ResearchCatalogPage,ActivityPage,HelpPage}.jsx`, `styles/reference.css`, `tests/reference.spec.js`, báo cáo này.

Sửa trên nền dirty tree hiện có: `src/App.jsx`, `auth/AccountMenu.jsx` (presentation), `components/layout/{AppLayout,Header,Sidebar}.jsx`, `components/knowledge/PdfUpload.jsx`, `hooks/useResearchHistory.js`, `pages/{DashboardPage,NewResearchPage,RunWorkspacePage,SchedulesPage}.jsx`, `services/apiClient.js` (success event), `playwright.rebuild.config.js`, `README.md`. Các file Frontend khác và report trước lượt này là thay đổi đã tồn tại; không reset/xóa. Authentication logic không thay đổi trong lượt demo.

## Chạy và Docker

```sh
npm --prefix frontend run dev
npm --prefix frontend run build
npm --prefix frontend run format:check
npm --prefix frontend run test:rebuild
# Chỉ build image frontend cục bộ, không sửa cấu hình production
 docker build -t researchos-frontend-reference:local frontend
```

Cần Chrome hoặc `PLAYWRIGHT_CHROME_PATH` trỏ tới Chromium; mock browser tests dùng Vite4175, không cần database. Dev5173 dùng API config `VITE_API_BASE_URL` hiện có hoặc proxy tới127.0.0.1:3000. `FRONTEND_ORIGIN` Backend phải khớp browser origin để session/CSRF hoạt động; không đưa secrets vào Vite.

Docker image dùng Nginx proxy `backend:3000`. Nếu cần preview thủ công, chỉ sau khi xác định đúng network hiện hữu và origin được CSRF cho phép, chạy **riêng frontend**:

```sh
# Thay network và port bằng cấu hình phù hợp; lệnh hướng dẫn, chưa thực thi
 docker run --rm --name researchos-ui-preview --network <existing-backend-network> -p 127.0.0.1:8088:80 researchos-frontend-reference:local
```

Không chạy compose up/down, recreate, migrate, xóa volumes hoặc triển khai Backend/Worker/PostgreSQL/n8n. Không commit/push/merge; branch hiện tại `feat/researchos-ui-rebuild`.
