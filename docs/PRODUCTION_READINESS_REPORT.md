# Báo cáo kiểm tra khả năng triển khai ResearchOS

Ngày kiểm tra: **06/11/2026**, múi giờ Asia/Ho_Chi_Minh.

**Kết luận: NO-GO cho production public ở thời điểm kiểm tra.** Các bộ kiểm thử chức năng cuối cùng đạt, những lỗi xác nhận được đã sửa trong working tree. Tuy nhiên, cổng n8n của một container có sẵn đang bind mọi interface; cấu hình HTTPS/secrets/quota và quy trình backup/khôi phục trên VPS chưa được chứng minh. Các điều kiện này phải được xử lý hoặc xác minh trước khi mở public. Có thể tiếp tục staging cô lập.

## 1. Phạm vi, commit và bảo toàn dữ liệu

- Branch: `main`; HEAD ban đầu và cuối đợt kiểm tra: `42aa543286758acb4fcdd6d04da6b76222496dde`.
- Working tree ban đầu sạch. Kết quả “sau sửa” áp dụng cho HEAD **cộng các thay đổi chưa commit** được liệt kê bên dưới, không phải nguyên commit ban đầu.
- Không commit, push, merge hoặc deploy. Không đọc/hiển thị giá trị `.env` thật; không sử dụng secrets production để chạy test.
- Backend/Playwright sử dụng SQLite và thư mục PDF tạm. Docker dùng project `researchos-audit-b17056e0`, ports loopback riêng, images/volumes riêng và credentials giả sinh riêng. Provider được mock; không gọi Gemini/Tavily trả phí.
- Không reset, chỉnh sửa hoặc xóa database/volumes người dùng. Không restart/recreate các container có sẵn. Chỉ stop/start worker thuộc project audit để thử recovery.
- Đã kiểm tra routes/controllers/services/models/config/workers, test suites, frontend/pages/components/styles/tests, Docker/nginx, n8n và CI. Kiểm tra source và kiểm thử không tương đương chứng minh hết mọi đường chạy, tải thực tế hoặc mọi lỗ hổng.

## 2. Môi trường và dependencies

| Thành phần | Môi trường đã dùng |
| --- | --- |
| OS host | Linux 7.0.0-42-generic, x86_64 |
| Node.js / npm host | v24.21.0 / 11.19.0 |
| Docker / Compose | 29.8.2 / v5.6.0 |
| Engine backend | Node >=22, <25 |
| Engine frontend | Node >=22.12 |
| Build Docker ứng dụng | node:22.14.0-alpine3.21; frontend runtime nginx:1.28.0-alpine3.21 |
| SQLite driver | sqlite3 6.0.1 |
| n8n kiểm thử cô lập | 2.46.1, xác nhận bằng CLI và chạy workflow thực tế |
| RAM host | Khoảng 15 GiB; không phải VPS 4 GiB |

`npm ls --depth=0` của hai package không báo dependency thiếu/invalid; lockfiles hiện diện. Backend bổ sung dependency trực tiếp `undici@6.29.1` cho DNS pinning; phiên bản này đã có trong lockfile dưới dạng dependency gián tiếp. Không nâng cấp dependencies diện rộng.

## 3. Kết quả chạy thực tế

| Bộ kiểm tra | Trước sửa | Sau sửa | SKIPPED / giới hạn |
| --- | --- | --- | --- |
| `npm --prefix backend test` | 104 PASS, 0 FAIL | **109 PASS, 0 FAIL, 0 cancelled, 0 skipped** | Không skip test |
| `node --test backend/test/search-workflow.test.js` | — | **14 PASS**, 0 FAIL/skip | Nằm trong 109 backend tests, không cộng hai lần |
| `npm --prefix frontend run test:e2e` | Đã chạy trong đợt audit | **33 PASS**, 0 FAIL | Chrome; providers mock |
| `npm --prefix frontend run build` | PASS | PASS | Không xác nhận mọi browser |
| `npm --prefix frontend run format:check` | FAIL: 14 file | PASS | Chỉ format file bị báo và test vừa sửa |
| `npm --prefix backend audit --omit=dev --json` | 0 advisory | 0 advisory | Chỉ dependency production npm |
| `npm --prefix frontend audit --json` | 0 advisory | 0 advisory | Bao gồm dependency dev npm |
| Compose base `config --quiet` | PASS | PASS | Dùng environment giả, không xuất rendered secrets |
| Compose base + validation `config --quiet` | PASS | PASS | Không chạy validation stack có sẵn |
| Docker build, `up -d --wait` project riêng | PASS | PASS | Cả backend, worker, frontend, n8n healthy |
| HTTP integration qua nginx trong Docker | — | **9 nhóm kiểm tra PASS** | Xem mục 7; không cộng vào số Node tests |
| n8n import/publish/execution thực tế | — | PASS | Hai workflow; full pipeline kết thúc `partial` |
| Chrome trên bản production qua nginx | — | PASS | Register/session refresh/logout; 375/768/1024/1440; không uncaught JS error |
| `git diff --check` | — | PASS | Không thay thế review code |
| GitHub Actions mới trên GitHub | — | CHƯA CHẠY | Không push; đã chạy các lệnh tương đương cục bộ |
| HTTPS/domain, paid providers, tải production, restore dữ liệu thật | — | CHƯA CHẠY | Không có staging VPS/domain và không được dùng production secrets/data |

Số test tự động của hai runner cuối: **109 backend + 33 Playwright**. Các smoke checks Docker/n8n/browser là kiểm tra bổ sung, không tính gộp thành test runner để tránh báo số sai.

Một lần chạy backend giữa đợt ghi nhận lỗi concurrency ở `workflow23.test.js` (actual 1, expected 2), đã sửa cơ chế đồng bộ test và chạy lại toàn bộ. Một lần chạy trong sandbox hạn chế không thực thi đầy đủ các test cần HTTP/process con; không dùng kết quả đó làm kết luận ứng dụng hỏng. Lần chạy cuối có quyền mở loopback và process con đạt đủ 109 tests. Một lần chạy harness Docker đầu tiên lỗi đường dẫn import `pdfkit` do dependency hoisting; sửa harness tạm, chạy lại thành công, không sửa ứng dụng để né lỗi.

## 4. Lỗi tìm thấy, bằng chứng và bản sửa

| Mức | Vấn đề và bằng chứng | Bản sửa / trạng thái |
| --- | --- | --- |
| P1 | Collector kiểm tra DNS public trước nhưng `fetch` tự phân giải lại. Regression dựng private HTTP server chứng minh trước sửa có **1 request vào loopback**, expected **0**. | Pin các địa chỉ đã kiểm tra vào Undici Agent cho kết nối socket; kiểm tra lại từng redirect, hủy body/dispatcher. Regression sau sửa không truy cập private server. |
| P1 | Các webhook điều phối v2 không yêu cầu inbound authentication; người gọi có thể kích hoạt thao tác qua internal credential của n8n. Không kết luận đã có người khai thác. | Cả 9 webhook nodes trong v2/knowledge yêu cầu `headerAuth`; credential placeholder bắt buộc cấu hình. Secret inbound tách khỏi key backend. Test kiểm tra tất cả nodes. |
| P0 | Compose pin n8n 2.0.3, thuộc phạm vi ảnh hưởng advisory Critical RCE đã công bố. | Source pin 2.46.1, kiểm tra image và chạy smoke workflow trên volume mới. **Chưa nâng cấp instance có sẵn**; cần backup và thử migration trước khi deploy. |
| P1 | Server/worker tự load `.env` repository ngay trong test, có thể đưa secrets/config thật vào process kiểm thử. Không có bằng chứng secrets đã bị xuất ra. | Loader chung bỏ qua `.env` khi Node test runner, NODE_ENV=test hoặc RESEARCH_LOAD_ENV=false; Playwright đặt cờ explicit. Regression kiểm tra cả chế độ isolated và production. |
| P2 | Workflow concurrency test giả định hai công việc chồng nhau trong `wait(3)`. Dưới tải, peak translation chỉ 1 dù không chứng minh limiter sai. | Rendezvous chờ hai công việc cùng vào, timeout lỗi rõ ràng; giữ expected peak bằng 2 và kiểm tra số calls/cache/dữ liệu. |
| P2 | CI cũ chưa có bộ gate backend/frontend/compose cho `main`. | Thêm workflow read-only, push/PR main và manual, chạy test/audit/build/format/E2E/config. Chưa chạy trên GitHub. |
| P2 | Chưa có cap bộ nhớ frontend/n8n trong compose. | Thêm frontend 128 MiB, n8n 1024 MiB; giữ backend 512 MiB và worker 768 MiB. Tổng cap 2432 MiB; không phải kết quả load test. |
| P3 | Prettier báo lỗi 14 file frontend. | Format đúng các file bị báo; không thiết kế lại UI hoặc sửa API contracts. |

Cơ sở đánh giá n8n: [Critical RCE GHSA-vpcf-gvg4-6qwr](https://github.com/n8n-io/n8n/security/advisories/GHSA-vpcf-gvg4-6qwr), [code nodes GHSA-9p7v-45m2-wxgj](https://github.com/n8n-io/n8n/security/advisories/GHSA-9p7v-45m2-wxgj), [OAuth GHSA-426f-xmcv-g8pg](https://github.com/n8n-io/n8n/security/advisories/GHSA-426f-xmcv-g8pg). Đây là kiểm tra các advisory liên quan, không phải chứng nhận image 2.46.1 không còn mọi lỗ hổng.

## 5. File thay đổi

- `backend/src/services/content.service.js`: DNS pinning, redirect validation và cleanup; `backend/package.json`, `backend/package-lock.json`: Undici trực tiếp.
- `backend/src/config/environment.js` mới; `backend/src/server.js`, `backend/src/workers/index.js`: loader môi trường dùng chung.
- `backend/test/content-security.test.js` mới: DNS rebinding, redirect/private/mixed addresses, protocol/credentials và giới hạn body.
- `backend/test/environment-isolation.test.js` mới: không load `.env` trong test/isolated process.
- `backend/test/n8n-v2.test.js`: xác nhận cả 9 webhook có auth và workflow không tự active.
- `backend/test/auth-transfer.test.js`: backup SQLite bằng VACUUM được process read-only độc lập đọc lại đúng ownership trước transfer.
- `backend/test/workflow23.test.js`: đồng bộ concurrency test, không đổi expected.
- `frontend/tests/auth-fixture.js`, `auth.spec.js`: bắt uncaught JavaScript errors; `start-backend.cjs`: tắt đọc `.env` thật.
- Format các file đã bị Prettier báo: `ChatPanel.jsx`, `PdfUpload.jsx`, `ResearchStepper.jsx`, `SourceCard.jsx`; `index.css`, `knowledge.css`, `researchos.css`; `knowledge-editorial.css`, `research-workspace.css`, `workflow-editorial.css`; `flow-v2.spec.js`, `knowledge.spec.js`, `research.spec.js`, `workflow-ux.spec.js`. Không thay đổi chức năng giao diện.
- `docker-compose.yml`: n8n version và memory caps; không sửa volumes/schema.
- 7 JSON trong `n8n/workflows/v2/` và 2 JSON trong `n8n/workflows/knowledge/`: inbound header credential; hai README tương ứng hướng dẫn cấu hình.
- `.github/workflows/production-readiness.yml` mới; báo cáo này và liên kết trong README.

## 6. Backend, database và security verification

Các test cuối bao phủ:

- Auth: đăng ký mật khẩu 5/6/12/128/129 ký tự theo policy hiện tại; login thành công/thất bại, scrypt hash, tương thích mật khẩu tài khoản cũ; change-password cạnh tranh, session revocation/logout/expiration. Kiểm tra HttpOnly/SameSite và Secure ở cấu hình secure; không suy từ đó rằng VPS đang có HTTPS.
- CSRF/origin, CORS allowlist, rate limiting và proxy header spoofing; lỗi được redacted. Internal API thiếu/sai key bị từ chối; owner service lấy từ cấu hình, không tin client owner ID.
- User B không đọc/sửa research, sources/evidence, reports/exports, document/PDF, chat và memory của User A. Không tắt ownership hoặc Auth để test qua.
- SQLite: WAL, migrations idempotent, rollback lỗi được tiêm, indexes, commit và process độc lập đọc lại; đường dẫn sai không tạo DB rỗng. Giữ kiểm tra expected source count **8** trong search workflow. Backup VACUUM được process độc lập đọc lại trước khi chuyển owner.
- Workflow v1/v2: validation, planner schema, dedupe, source persistence/cache, bounded concurrency, retry/backoff/timeout/rate-limit/quota, partial states, job leases/fencing/recovery và idempotency.
- PDF: loại file/kích thước/số trang, corrupt/encrypted/scan PDF có lỗi cụ thể; ingestion, chunks/FTS, provenance, chat citations, memory approve/reject/recall. Không tự OCR PDF scan khi tính năng chưa có.
- Reports: evidence mapping, safe Markdown, export PDF/DOCX là binary thật, filename/content type và Unicode fonts; cross-user export bị từ chối.
- Collector SSRF: private destinations, redirects, credentials/protocol, DNS rebinding và giới hạn body sau giải nén.

`npm audit` cuối trả 0 advisory cho backend production và frontend. Không có full container/OS image scanner hoặc pentest bên ngoài; npm audit không kiểm tra n8n image, nginx, Alpine, TLS/firewall hoặc bí mật runtime. Không xác nhận “không có secrets ở mọi log/bundle”; các regression kiểm tra rò rỉ ở các đường chạy được bao phủ, không đọc secret thật để đối chiếu.

## 7. Docker và tích hợp n8n thực tế

Topology: browser → frontend nginx → backend; backend và worker dùng cùng named volumes SQLite/PDF; n8n → backend qua internal API có key. Nginx từ chối `/internal`; backend endpoint tương ứng vẫn yêu cầu key. Compose source bind host ports vào loopback, frontend proxy có IP/CIDR tin cậy cụ thể.

Project audit riêng đã build, boot đủ bốn services healthy và chạy:

1. Nginx health/app, `/internal` bị 404; gọi backend internal thiếu key 401, đúng key thành công.
2. FLOW A: register → login → me/dashboard → logout/revocation → login lại.
3. FLOW B: tạo nghiên cứu → search/collect → evidence → report → tải binary PDF `%PDF` và DOCX `PK`.
4. FLOW C: tạo PDF tổng hợp, upload → worker ingestion ready → xem/tải → gắn PDF → RAG chat; citation trỏ đúng document.
5. FLOW D: tạo memory candidate → approve → recall qua hội thoại → reject candidate khác.
6. FLOW E: tài khoản thứ hai không truy cập research/evidence/report/export/PDF/chat và không approve memory của tài khoản đầu.
7. Knowledge Chat internal endpoint hoạt động với owner service cấu hình.
8. FLOW F: dừng worker audit, enqueue run, replay cùng idempotency key giữ cùng run, bật lại worker và đạt trạng thái terminal. Đây là restart khi job đang queued; không phải kill container đúng giữa một SQLite write. Lease/fencing được kiểm tra riêng bằng backend tests.
9. n8n version 2.46.1 và health endpoint hoạt động.

Trong n8n audit, đã tạo credentials giả, import và publish **create-run** cùng **full-research-pipeline** từ JSON source. Webhook thiếu/sai credential trả **403**; đúng credential thực thi thành công; replay giữ cùng run ID. Full pipeline đạt terminal **`partial`**, không báo thành `completed`: đây là partial workflow hợp lệ với dữ liệu/provider mock, không chứng minh chất lượng nghiên cứu thật. Bảy workflow còn lại được static/regression validation; không tuyên bố đã kích hoạt và chạy riêng cả bảy. Knowledge workflow vẫn gọi `/internal/knowledge/chats/:id/messages`.

Chrome còn chạy trực tiếp trên bundle production phục vụ qua nginx: đăng ký, cookie session sau refresh, logout, bốn viewport 375/768/1024/1440, không tràn ngang và không uncaught JavaScript errors trong kịch bản này. 33 Playwright tests chạy riêng qua Vite với backend thật và providers mock; bao phủ các màn hình, protected routes, loading/empty/error/retry, bàn phím và tương tác chính. Chưa làm WCAG audit toàn diện bằng screen reader hoặc nhiều trình duyệt.

Sau kiểm thử, đã chạy `down` **chỉ project audit**, không dùng `-v`; giữ lại toàn bộ audit volumes và images. Các container có sẵn vẫn chạy, những container có healthcheck vẫn healthy. Snapshot bộ nhớ sau smoke: backend 57.62 MiB, worker 45.34 MiB, frontend 12.85 MiB, n8n 405.9 MiB; đây không phải peak dưới tải. Bằng chứng: `/tmp/readiness-docker-stats-final.log`, `/tmp/readiness-docker-cleanup.log`, `/tmp/readiness-host-containers-after.log`.

## 8. Các vấn đề còn tồn tại

| Mức | Bằng chứng / giới hạn | Việc cần hoàn tất |
| --- | --- | --- |
| P1 | Container có sẵn `ai-research-n8n` publish `0.0.0.0:5678` và `[::]:5678`. Chưa kiểm tra firewall hoặc internet reachability; không kết luận cổng thực sự truy cập được từ Internet. | Operator kiểm tra image/runtime, đóng direct ingress hoặc giới hạn firewall/VPN/reverse proxy có TLS/auth. Không thay đổi instance này trong audit. |
| P1 | Source n8n được vá nhưng các instance có sẵn chưa được nâng cấp trong nhiệm vụ này. Chỉ thử volume mới. | Inventory phiên bản từng instance, backup DB/credentials/encryption key; thử nâng cấp trên bản sao trước khi rollout. |
| P1 | Chưa xác minh domain production, HTTPS, FRONTEND_ORIGIN, COOKIE_SECURE và secrets thực tế vì không đọc `.env` hoặc deploy. | Cấu hình trên VPS bằng secret manager/operator; test secure cookies, Origin/CORS và TLS từ bên ngoài. Không dùng defaults/example credentials. |
| P1 | Đăng ký mở; rate limits HTTP và giới hạn từng request không thay thế ngân sách provider, dung lượng lưu trữ và quota job theo user. | Trước public rộng: giới hạn truy cập/đăng ký hoặc thiết kế quota bền vững theo user, giới hạn queue/storage/token/cost; thử abuse và exhaustion. Không tự áp policy sản phẩm trong audit. |
| P1 | Có test backup SQLite, nhưng chưa diễn tập backup/restore đồng bộ SQLite + PDFs + n8n + encryption key trên VPS. | Thiết lập backup ngoài máy, retention, mã hóa, restore drill và rollback migration. Không chỉ copy file `.db` đang WAL hoạt động. |
| P2 | Base ứng dụng vẫn pin Node 22.14.0/Alpine 3.21 và nginx 1.28.0/Alpine 3.21; npm audit không scan OS images. | Rà image được hỗ trợ, scan CVE, cập nhật có kiểm thử và pin digest theo quy trình release. |
| P2 | Backend/worker Dockerfile chưa chuyển sang USER không đặc quyền. | Hardening user/capabilities/read-only phù hợp, thử quyền SQLite/PDF trên bản sao volume; không tự chown dữ liệu người dùng. |
| P2 | Rate limiter nằm trong RAM; reset khi restart, không chia sẻ giữa replicas. Reverse proxy ngoài Docker cần cấu hình trust boundary chính xác. | Chốt mô hình single instance hoặc shared limiter; test client IP qua ingress thực tế và spoofing. |
| P2 | Tổng cap 2432 MiB không chứng minh VPS 4 GiB chịu concurrency PDF/LLM/n8n; chưa có benchmark tải dài hạn. | Load/soak test trên cấu hình đích, giới hạn queue/concurrency, theo dõi RSS/OOM/disk/WAL/provider latency. |
| P2 | Có healthchecks và logs, chưa chứng minh alert/metrics/backup-failure monitoring vận hành. | Bổ sung uptime, error rate, queue age, disk free, provider cost và backup age alerts. |
| P2 | Workflow CI mới chưa chạy trên GitHub; chưa cấu hình branch protection/release gate. | Chạy CI sau review/commit do người dùng thực hiện; yêu cầu checks trước merge. |
| P3 | Chưa audit screen reader, Safari/Firefox và accessibility tự động toàn diện. | Bổ sung trước các yêu cầu tiếp cận/chứng nhận cụ thể. |

Không còn test failure đã biết ở lần chạy cuối. Các mục trên là rủi ro/điều kiện vận hành chưa được giải quyết, không được đổi thành PASS chỉ vì unit/E2E xanh.

## 9. Bằng chứng và khả năng chạy lại

Log cục bộ được lưu dưới `/tmp`; có thể mất khi máy dọn temporary files:

- `/tmp/readiness-backend-baseline.log`: 104 tests ban đầu.
- `/tmp/readiness-ssrf-before.log`: regression DNS rebinding thất bại trước sửa.
- `/tmp/readiness-backend-verified.log`: lần bắt được concurrency test failure.
- `/tmp/readiness-backend-authorized-final.log`: bộ backend cuối đủ 109 tests.
- `/tmp/readiness-search-final.log`: chạy riêng 14 tests search workflow/persistence.
- `/tmp/readiness-e2e-final.log`: 33 Playwright tests cùng assertions uncaught JS errors.
- `/tmp/readiness-format-verified.log`, `/tmp/readiness-build-verified.log`: format/build cuối.
- `/tmp/readiness-backend-audit-final.json`, `/tmp/readiness-frontend-audit-final.json`: npm audit.
- `/tmp/readiness-docker-rebuild-final.log`, `/tmp/readiness-docker-reup-final.log`: build/health sau sửa cuối.
- `/tmp/readiness-docker-scenarios-final.log`, `/tmp/readiness-smoke-results.json`: HTTP flows Docker.
- `/tmp/readiness-n8n-activation.log`, `/tmp/readiness-n8n-execution-final.log`, `/tmp/readiness-n8n-execution-results.json`: import/publish/live webhook.
- `/tmp/readiness-docker-browser-final.log`, `/tmp/readiness-docker-browser.json`: Chrome production.

Harness tạm và environment audit nằm dưới `/tmp/researchos-readiness-smoke/`, không đưa vào Git vì chứa credentials giả dành riêng cho audit. Chạy lại test source bằng các lệnh ở mục 3; cần browser Chrome, quyền mở loopback/process con, và Docker khi chạy smoke. Không chạy test trên volumes người dùng. Audit compose có overrides riêng để bỏ env_file thật, dùng secrets giả và đổi project/network/ports/images.

## 10. Checklist trước triển khai VPS

- [ ] Review diff và chạy CI trên commit cuối do người dùng tạo; không triển khai trực tiếp working tree chưa review.
- [ ] Inventory và vá mọi n8n instance, thử migration trên bản sao; cấu hình cả inbound webhook credential và outbound internal API credential đúng owner service.
- [ ] Đóng/giới hạn cổng 5678 đang wildcard; chỉ expose ingress cần thiết, xác minh firewall từ máy ngoài.
- [ ] Cấu hình HTTPS/domain, FRONTEND_ORIGIN, Secure cookies, proxy trust và secrets production; kiểm tra không bật mock providers ngoài ý muốn.
- [ ] Áp chính sách đăng ký/quota/cost/storage và giới hạn queue trước public rộng.
- [ ] Diễn tập backup/restore SQLite nhất quán với WAL, PDFs và n8n/encryption key; thử rollback version/migration trên dữ liệu sao chép.
- [ ] Scan/cập nhật base images, hardening container và kiểm tra quyền volumes.
- [ ] Load test trên cấu hình VPS đích, thiết lập monitoring/alerts và headroom RAM/disk.
- [ ] Chạy lại A–F trên staging HTTPS với keys thử nghiệm có ngân sách được phê duyệt; kiểm tra chất lượng/citations thật. Chưa gọi provider trả phí trong audit này.

**Quyết định cuối: NO-GO cho public production; staging cô lập đã kiểm thử thành công.** Các sửa lỗi source đã sẵn sàng để review, nhưng chưa có bằng chứng đáp ứng các gate P1 về runtime/ingress, HTTPS/secrets, quota và khôi phục dữ liệu. Không có thao tác deploy trong đợt kiểm tra.
