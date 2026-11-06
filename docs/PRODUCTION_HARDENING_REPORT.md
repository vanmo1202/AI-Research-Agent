# Báo cáo Production Hardening ResearchOS

Ngày: **06/11/2026**. Branch `main`, HEAD `42aa543286758acb4fcdd6d04da6b76222496dde`. Kết quả áp dụng cho HEAD cùng working tree chưa commit, gồm các bản sửa của đợt readiness trước và hardening hiện tại.

**Kết luận: NO-GO cho public production.** Đã chuẩn bị và kiểm thử stack hardening cô lập; chưa áp dụng thay đổi cho các container có sẵn. Quota mới ở mức thiết kế; firewall/DNS/TLS thực, secrets, migration/restore dữ liệu thật và monitoring vận hành vẫn cần operator xác minh. Không được coi các mục này đã đạt chỉ vì test xanh.

## 1. Bảo toàn bản sửa trước

Đã đọc `docs/PRODUCTION_READINESS_REPORT.md`, lưu baseline diff vào `/tmp/hardening-baseline.patch` và danh sách untracked vào `/tmp/hardening-baseline-untracked.txt` trước khi sửa. Working tree có các thay đổi của đợt audit trước, không sạch; không reset/revert hoặc ghi đè chúng.

So sánh patch cho thấy **mọi phần diff tracked có sẵn được giữ nguyên byte-for-byte**, ngoại trừ README chỉ được bổ sung liên kết tài liệu. `backend/src/config/environment.js` và CI vốn là untracked ở baseline được mở rộng có chủ đích: secret file loader và job kiểm thử ops. Các thay đổi frontend cũ không bị sửa thêm trong giai đoạn này. Test backend tăng từ 109 lên **110** nhờ một regression mới; 33 E2E được chạy lại thành công. Không thay API contracts, database schema, session/Auth hoặc ownership.

Không commit/push/merge/deploy. Không thay DNS/firewall, không sửa `.env` thật, không dùng paid provider keys. Không restart/stop/recreate/xóa container hoặc volume có sẵn trước nhiệm vụ. Docker smoke chỉ tạo project `researchos-hardening-check` mới, secret/cert giả, image/volumes riêng và loopback port 18443.

## 2. n8n ingress thực tế — chỉ đọc, không sửa runtime

| Container | Image quan sát | Host binding | Trạng thái |
| --- | --- | --- | --- |
| `ai-research-n8n` | `n8nio/n8n:latest` | **0.0.0.0:5678 và [::]:5678** | Đang chạy; không đổi |
| `ai-research-flow-v2-check-n8n-1` | `n8nio/n8n:2.0.3` | 127.0.0.1:15678 | Healthy; không đổi |

Inspect container đầu xác nhận HostIp rỗng cho 5678/tcp và volume `n8n_n8n_data`. Tag latest không xác định được phiên bản binary hoặc trạng thái vá. Chưa kiểm tra firewall/internet reachability; không kết luận cổng đã bị khai thác. Source `n8n/docker-compose.yml` không khớp tag runtime latest, cần operator inventory project/config thực tế trước mọi thay đổi.

**Đề xuất, chưa thực hiện:** giới hạn ingress bằng security group/DOCKER-USER hoặc VPN với cả IPv4/IPv6; giữ SSH, lưu và kiểm tra rollback rules. Sau backup/restore drill và approval maintenance window, recreate đúng project với loopback hoặc chuyển sang private network của stack mới. Đổi Compose source không đổi port của container đang chạy. Không thể sửa port mapping tại chỗ an toàn bằng việc chỉ chỉnh file.

Chi tiết thao tác và giới hạn ở [runbook](PRODUCTION_OPERATIONS.md). Không cung cấp lệnh firewall áp dụng tự động hoặc tự động restart instance cũ.

## 3. Đã sửa / chuẩn bị trong source

| Nhóm | File | Nội dung |
| --- | --- | --- |
| Production topology | `compose.production.yml` | Standalone, explicit project name bắt buộc; chỉ edge publish HTTPS, loopback mặc định. Backend/worker/n8n không publish host ports; private proxy networks và research bridge có egress cho providers. |
| Staging | `compose.staging.yml` | Override chỉ loopback, bật toàn bộ mock providers; project/secrets/volumes riêng. Không trộn với Compose phát triển. |
| TLS boundary | `deploy/nginx/edge.conf`, `frontend.conf` | TLS1.2/1.3, mTLS bắt buộc, HSTS, deny internal/webhook public, bounded upload/timeouts và rate limit. Edge ghi đè forwarding headers; frontend chỉ trust IP edge, backend chỉ trust IP frontend. |
| Least privilege | `deploy/Dockerfile.backend`, `Dockerfile.frontend`, Compose mới | Backend/worker UID1000, nginx UID101; cap_drop ALL, no-new-privileges, bounded pids/RAM/tmpfs, log rotation. App/frontend/edge rootfs read-only; n8n non-root, data volume writable. Không chown volumes người dùng. |
| Secret management | `backend/src/config/environment.js`, `backend/test/secret-files.test.js` | Hỗ trợ INTERNAL_API_KEY_FILE, GEMINI_API_KEY_FILE, TAVILY_API_KEY_FILE. Fail closed khi conflict/rỗng/quá lớn/không đọc được, lỗi không chứa secret/path. Giữ chế độ test không load `.env`. |
| Release variables | `deploy/release.env.example` | Template không chứa secrets; images/origin/UID/path cần operator điền. Compose secrets là file mounts, không tự mã hóa secret at rest. |
| Legacy local n8n helper | `n8n/docker-compose.yml` | Source đổi 2.0.3 → 2.46.1, bind loopback và thêm cảnh báo cần approval trước apply. Không tác động container đang chạy. |
| Quota | `docs/PRODUCTION_QUOTA_DESIGN.md` | Thiết kế ledger/reserve/settle theo user/global, concurrency, PDF bytes, Gemini tokens/cost và Tavily credits; API lỗi additive. **Chưa có runtime enforcement/migration**. |
| Backup/restore | `scripts/ops/backup.py`, `test_backup.py` | SQLite backup API đọc WAL committed; PDF+n8n files+key cùng encrypted archive GPG AES256. Manifest SHA256, integrity_check, fsync và publication không ghi đè. Restore chỉ directory mới, chặn traversal/symlink/duplicates. |
| Monitoring | `scripts/ops/monitor.py`, `test_monitor.py` | Read-only Docker health/restarts/OOM, tùy chọn backup freshness và disk thresholds; JSON + nonzero exit. Không expose socket hoặc env qua HTTP. |
| CI và hướng dẫn | `.github/workflows/production-readiness.yml`, `.gitignore`, README và `docs/PRODUCTION_OPERATIONS.md` | Thêm ops tests và hardened topology preflight, bỏ qua secret/runtime artifacts; runbook ingress/TLS/secrets/backup/restore/upgrade/rollback. Chưa chạy CI GitHub. |
| Preflight | `scripts/ops/preflight.py` | Bắt buộc digest pins, private services không publish port, non-root/caps/health/resource caps/file secrets, HTTPS origin và trust boundary. Không chứng minh registry/CVE/certificate/firewall thật. |

mTLS là admission control tạm cho nhóm được duyệt, **không thay quota theo user**, provider account budget hay Auth ứng dụng. Không tắt mTLS để mở public trong khi quota chưa được thực thi.

## 4. Đã kiểm thử thực tế trong giai đoạn này

Môi trường host: Node v24.21.0, npm 11.19.0, Python 3.14.4, Docker 29.8.2, Compose v5.6.0; Linux x86_64. Không sử dụng secrets/volumes production.

| Kiểm thử | Kết quả cuối | Phạm vi / bằng chứng |
| --- | --- | --- |
| `npm --prefix backend test` | **110 PASS, 0 FAIL, 0 skipped** | `/tmp/hardening-backend-final.log`; bảo toàn 109 tests trước + secret-file regression |
| `npm --prefix frontend run test:e2e` | **33 PASS** | `/tmp/hardening-e2e.log`; Chrome, app backend thật/providers mock |
| Frontend build / format:check | **PASS / PASS** | `/tmp/hardening-build.log`, `/tmp/hardening-format.log` |
| Python ops tests | **12 PASS** | `/tmp/hardening-ops-tests-final.log`: 9 backup/restore + 3 monitoring |
| Compose production/staging config | **PASS** | Render không đọc `.env` thật, `/tmp/hardening-rendered-final.json` chỉ fake credentials references |
| Hardened preflight / negative cases | **PASS** | Structural config dùng placeholder digests; từ chối local tags và việc publish backend/worker/n8n/frontend. Không xác minh registry app image digest trong test này. |
| Docker builds | **PASS** | `/tmp/hardening-docker-build.log`; build hai image mới bằng digest-pinned Node/nginx |
| `up -d --wait` project mới | **PASS: 5 services healthy** | `/tmp/hardening-docker-up.log`; duy nhất host binding loopback HTTPS |
| Docker HTTP A–F | **9 nhóm kiểm tra PASS** | `/tmp/hardening-docker-flows.log`, `/tmp/hardening-smoke-results.json`; qua mTLS HTTPS, không paid API |
| TLS/security smoke | **7 nhóm kiểm tra PASS** | `/tmp/hardening-tls.log`, `/tmp/hardening-tls-results.json` |
| Monitor live stack mới | **PASS** | `/tmp/hardening-monitor.json`; 5 services healthy; không phải monitoring VPS đã cài đặt |
| `git diff --check`, Python compile | **PASS** | Source không có whitespace lỗi; script parse được |
| CI trên GitHub, public TLS/firewall, restore dữ liệu production | **CHƯA CHẠY** | Không push/deploy, không có approval thao tác runtime thật |

110 và 33 là số từ hai runner riêng; 12 ops tests bổ sung. Không tính lại các subchecks smoke như backend tests.

Docker A–F xác nhận register/login/dashboard/logout/relogin; research→collect→evidence→report→binary PDF/DOCX; PDF upload/worker ingestion/file/RAG citation đúng document; memory candidate/approve/recall/reject; cross-user denied; internal Knowledge Chat đúng configured owner; async run và idempotent replay; n8n health. **Không dừng/restart worker để thử recovery ở giai đoạn này**; recovery stop/start đã được kiểm tra trong audit trước và regression backend hiện vẫn qua. Cũng không lặp lại import/publish live n8n workflows ở giai đoạn này; bằng chứng live workflow 2.46.1 thuộc báo cáo readiness trước.

Bảy nhóm TLS kiểm tra: thiếu client certificate bị từ chối; server CA không tin cậy bị từ chối; mTLS hợp lệ tới backend qua hai proxy; Secure/HttpOnly/SameSite session hoạt động; cross-origin write 403; public `/internal` và `/webhook` 404; X-Forwarded-For/Forwarded giả không bypass edge rate limit (429). CA giả chỉ phục vụ kiểm thử localhost, không phải chứng thư public.

Sau kiểm tra đã dọn **chỉ containers/networks của project hardening mới** bằng `down` không `-v`; giữ lại toàn bộ volumes và images. Các container có sẵn trước nhiệm vụ vẫn chạy với bindings ban đầu, những container có healthcheck vẫn healthy. Bằng chứng cuối: `/tmp/hardening-runtime-invariants.json`, `/tmp/hardening-health-final.json`, `/tmp/hardening-monitor-final.json`, `/tmp/hardening-cleanup.log`, `/tmp/hardening-existing-containers-after.log`. Logs/harness ở `/tmp` có thể bị hệ thống dọn, không phải hồ sơ release lưu bền.

## 5. Lỗi phát hiện trong lúc xây dựng hardening, đã sửa

Không che các lần thử thất bại:

- YAML flow-list tmpfs chưa quote làm Docker tách `mode=1777` thành mount path; config quiet không phát hiện, runtime từ chối. Đã quote đúng chuỗi options và boot lại riêng stack mới.
- Nginx cố tạo fastcgi/uwsgi/scgi temp dưới rootfs read-only; frontend thử nghiệm restart. Đã chuyển toàn bộ temp paths về bounded tmpfs `/tmp`, không nới rootfs/capabilities.
- Edge chỉ có internal network: Docker không publish TLS port dù health/config đạt. Thêm ingress network riêng cho edge; app proxy networks vẫn internal và private services không có host ports. HTTPS end-to-end sau sửa đạt.
- CA fixture ban đầu thiếu keyUsage, Python strict TLS từ chối. Đã sửa CA test, **không tắt certificate validation**. Smoke mTLS/negative cuối đạt.
- Một yêu cầu quyền kiểm thử bị timeout automatic approval; retry được chấp thuận và kiểm thử chạy thành công. Không còn phần việc bị chặn do approval.

Restart count frontend trong project test có thể còn ghi các lần lỗi cấu hình trên; đó là container audit mới, không phải service người dùng. Kết quả cuối dựa trên HTTP smoke thực tế, không chỉ `nginx -t`.

## 6. Backup/restore: điều đã chứng minh và giới hạn

Đã kiểm thử encrypted round-trip, PDF bytes/key/config giữ đúng, process độc lập đọc hai SQLite backups có dữ liệu committed trong WAL; output/target có sẵn không bị ghi đè. Key mismatch, permissions sai, symlink/traversal, sai password, manifest sai, output nằm trong source đều bị từ chối. Monitoring kiểm tra missing/stale/symlink backup và disk threshold.

**Chưa thực hiện backup/restore volumes người dùng hoặc decrypt credentials thật.** Script hỗ trợ n8n SQLite, không hỗ trợ PostgreSQL. `--quiesced` yêu cầu operator đã chặn mọi writer/drain jobs hoặc dùng coordinated offline snapshot; script không tự dừng service và không chứng minh quiescence. Online snapshot từng DB không đảm bảo nhất quán giữa PDFs, research DB và n8n DB. Input phải là snapshot/mount đã được operator duyệt.

Archive gồm n8n encryption key và settings nên bắt buộc giữ encrypted, password backup riêng/off-host. Temporary plaintext cần encrypted disk/private tmpfs đủ dung lượng; không hứa secure erase trên SSD/swap/crash. Restore chỉ vào directory mới; operator phải tạo volumes/project riêng, vô hiệu hóa schedules/webhooks và cô lập egress để workflow khôi phục không phát sinh side effects. Runbook mô tả drill, retention, offsite và rollback; chưa có timer/cron hoặc upload/prune tự động.

## 7. Phiên bản và kế hoạch nâng cấp có rollback

Binary thực tế trong stack cô lập: **Node v22.23.4**, **nginx 1.30.6**, **n8n 2.46.1**. Hai Dockerfile hardening pin base amd64 đã dùng:

- Node: `sha256:947e5454e08bfe0b8ddda604915ad76275276c774f47da90d0137252c793a778`.
- nginx: `sha256:bb8f722b4be005fcd7827816a136ab779fd40185d85b5171be915cc7fc0575c7`.
- n8n image cache có RepoDigest `n8nio/n8n@sha256:67cb2970ded37cc40a8f91ce3325f44e88a1bf58e0f75d1fa2e0a5f6fc8a972a`; smoke dùng tag 2.46.1 từ cache này. Release production phải pin digest, cả app images đã publish; local test tags bị preflight production từ chối đúng thiết kế.

Không thay Dockerfiles phát triển cũ hoặc tự nâng instance có sẵn. Node22 vẫn maintenance LTS theo [release schedule chính thức](https://github.com/nodejs/Release); cần kế hoạch Node24 tương thích trước EOL của dòng 22. n8n 2.0.3 nằm trong affected range của [advisory Critical RCE](https://github.com/n8n-io/n8n/security/advisories/GHSA-vpcf-gvg4-6qwr). 2.46.1 đã smoke không đồng nghĩa là latest hoặc sạch mọi CVE; cần kiểm tra lại [advisories n8n](https://github.com/n8n-io/n8n/security/advisories) và scan image tại thời điểm release. Không chạy full OS image scanner ở giai đoạn này.

Nâng cấp phải thử bản sao DB/PDF/n8n/key trước; inventory custom/community nodes/runners. Giữ image digest cũ, config non-secret version và pre-upgrade backup đã restore được. Rollback dùng **schema cũ + image cũ trên volumes mới**, không gắn image cũ vào DB đã migrate. Chưa diễn tập migration/rollback dữ liệu thật; phải chốt maintenance window, RPO/RTO và xử lý writes sau cutover.

Secret file pattern và key preservation tham khảo [n8n configuration](https://docs.n8n.io/hosting/configuration/configuration-methods/), [n8n encryption key](https://docs.n8n.io/hosting/configuration/configuration-examples/encryption-key/); snapshot SQLite dùng [Online Backup API](https://sqlite.org/backup.html). Các tài liệu này không thay chứng minh restore trên dữ liệu cụ thể.

## 8. Còn cần operator cấu hình

- Chọn đúng project/runtime n8n, inventory binary/digest và sửa ingress sau approval; không áp legacy helper mù vào container latest hiện có.
- Domain/cert fullchain/key, CA client riêng và quy trình cấp/thu hồi/renewal; DNS-01/PKI ngoài stack. Không dùng cert giả của smoke.
- FRONTEND_ORIGIN HTTPS chính xác, existing service owner UUID; secrets trong secret manager/encrypted host filesystem, file ownership UID1000/101 đúng Docker userns mapping. Không dùng mẫu `.env` làm secrets thật.
- Pin app/n8n/edge images từ registry, scan CVE/SBOM/provenance, lưu release record và chạy CI GitHub sau review do người dùng thực hiện.
- Lịch backup phối hợp writers, encrypted offsite/retention, password/key recovery, restore drill và đo RPO/RTO.
- Host timer/alerts cho health/restarts/OOM/disk/backup freshness, external mTLS TLS probe/cert expiry, queue/WAL/provider usage; script đã có không có nghĩa alert đã được cài.
- Phê duyệt plan/quota/provider account caps, policy đăng ký và ngân sách; triển khai ledger và tests theo [quota design](PRODUCTION_QUOTA_DESIGN.md). mTLS chỉ hạn chế admission trong lúc này.

## 9. Còn cần xác minh trên VPS

- Firewall/security group IPv4/IPv6 và Docker DNAT từ máy ngoài; chỉ TLS ingress được phép, management qua VPN. Giữ SSH và kiểm tra rollback rules.
- TLS public chain, browser mTLS, CORS/CSRF, Secure cookie, client IP qua đúng trust boundary; cấu hình IP/subnet không overlap. Không chạy hai project dùng cùng static subnet mà không đổi network plan đồng bộ.
- UID permissions và fresh/restored volumes; backup consistency, n8n credential decrypt và upgrade migration trên bản sao có egress isolation.
- Load/soak trên RAM/disk VPS đích, PDF concurrency/OOM/queue latency/SQLite busy/WAL. Cap tổng app+edge là 2560 MiB, không phải bằng chứng VPS 4 GiB chịu tải production.
- Monitoring alerts thực sự gửi tới operator, backup offsite restore được, certificate renewal chạy thành công; không tự gửi thông báo tới người khác trong nhiệm vụ này.

## 10. Những vấn đề vẫn ngăn production

| Mức | Gate chưa đạt | Trạng thái |
| --- | --- | --- |
| P0 | Instance n8n 2.0.3 có sẵn thuộc affected range advisory Critical; chưa migrate/patch runtime | Operator cần backup + thử upgrade bản sao + rollout được duyệt |
| P1 | `ai-research-n8n` vẫn bind mọi interface; version latest và external reachability chưa xác minh | Chưa đổi firewall/container theo ràng buộc |
| P1 | Public TLS/domain/secrets và ingress config thật chưa xác minh | Chỉ test CA/keys giả ở localhost |
| P1 | Durable per-user quota/storage/provider budget chưa thực thi | Thiết kế hoàn tất, không báo đã bảo vệ chi phí public |
| P1 | Backup/restore/migration/rollback dữ liệu thật chưa diễn tập | 12 ops tests/fixtures không thay restore drill thực tế |
| P2 | Image scan, load test VPS, monitoring/alerts và CI release gates chưa vận hành | Có source/runbook, chưa chứng minh runtime |

**NO-GO cho public production tiếp tục có hiệu lực.** Source hardening và staging smoke đã sẵn sàng để review; việc mở ingress, migrate n8n, cấu hình secrets/TLS và triển khai cần operator thực hiện sau các gate trên. Không có deployment trong nhiệm vụ này.
