# Vận hành stack ResearchOS hardening

Các cấu hình này là chuẩn bị source, **không phải lệnh cho phép triển khai ngay**. Không chạy `up`, `restart`, `stop`, `down`, firewall hoặc DNS trên stack hiện có khi chưa được operator phê duyệt. Không trộn file production với `docker-compose.yml` phát triển. Compose >=2.24.4 cần cho `!override` staging.

## Ingress n8n hiện có

Đã quan sát `ai-research-n8n` (`n8nio/n8n:latest`) publish 0.0.0.0/[::]:5678, volume `n8n_n8n_data`; một instance khác `ai-research-flow-v2-check-n8n-1` chạy 2.0.3 ở loopback:15678. Tag latest không chứng minh phiên bản binary hay trạng thái vá. Không đổi hai instance này trong hardening.

Phương án operator xem xét:

1. Trước mắt: giới hạn ingress tại security group và firewall nhận biết Docker DNAT/DOCKER-USER, cho phép VPN/management CIDRs; kiểm tra cả IPv4/IPv6 từ máy ngoài. UFW INPUT đơn thuần có thể không đủ với published Docker ports. Cần lịch thay đổi, backup rules và phương án giữ SSH; tài liệu này không áp rule thật.
2. Sau backup/restore drill: recreate đúng project n8n với loopback binding hoặc chuyển sang stack mới không publish n8n. Port binding không đổi tại chỗ được; bước này gây thay đổi runtime, chỉ operator thực hiện trong maintenance window.
3. Không route editor/webhook n8n qua edge public hiện tại. Operator dùng mạng quản trị/VPN hoặc một loopback admin proxy riêng được phê duyệt; credential webhook header vẫn bắt buộc khi gọi nội bộ. Không expose trực tiếp backend `/internal`.

## Staging và production

`compose.production.yml` độc lập: duy nhất edge publish TLS 8443 bên trong; host port mặc định 443, **bind loopback mặc định**. Chỉ đổi HTTPS_BIND_IP sau review ingress/firewall. Không có HTTP:80; certificate issuance/renewal dùng quy trình DNS-01 hoặc PKI ngoài stack do operator thực hiện, không tự thay DNS. `compose.staging.yml` giữ loopback và bật toàn bộ mock providers. Hai môi trường cần project name, secrets, TLS, volumes và host port riêng. Hai network proxy dùng subnet cố định; kiểm tra overlap trên VPS, nếu đổi phải sửa đồng bộ IP/nginx trusted proxy và regression tests. Không chạy staging và production đồng thời trên cùng subnet khi không đổi network plan.

Topology: edge có network ingress riêng để Docker publish HTTPS; edge → frontend → backend; worker/n8n dùng research network không có host ports. Proxy networks internal; research bridge cho phép provider egress. Không coi private bridge là egress firewall; nếu cần outbound allowlist, triển khai tại host/network layer được phê duyệt. Không mount Docker socket trong service.

Edge yêu cầu mTLS: `ssl_verify_client on`; không tắt khi quota chưa được thực thi. Client certificate chỉ là điều kiện ingress, không thay login/ownership. CA client phải riêng khỏi CA server trong production, có cấp phát/thu hồi/expiry; kiểm tra quy trình thu hồi trước release. Không dùng self-signed test CA trên Internet. Edge xóa forwarding headers từ client; frontend chỉ nhận client IP từ edge 172.29.242.2; backend chỉ trust frontend 172.29.243.2/32. Host header giữ nguyên port để origin checks khớp. COOKIE_SECURE luôn true.

Copy `deploy/release.env.example` ra một đường dẫn operator quản lý **ngoài repo**, không ghi đè `.env`. Chỉ chứa interpolation không bí mật; tất cả images phải digest pinned, origin HTTPS chính xác và existing service user UUID. Không đặt API keys vào frontend/VITE variables, compose environment, shell history hoặc logs.

Tạo bốn files trong secrets directory: internal_api_key, gemini_api_key, tavily_api_key, n8n_encryption_key. Directory host 0700; files không world-readable, owner phù hợp UID1000, mode0400/0600. Rootless/userns Docker cần map UID khác và thử trên staging. Compose secrets dạng file là bind mount, **không phải encrypted secret store**; dùng encrypted host filesystem/secret manager, quyền Docker daemon tối thiểu. Backend/worker đọc `_FILE`, fail nếu file rỗng/quá lớn hoặc cùng lúc cấu hình secret inline. Rotate key cần rollout có kiểm soát; không tự sửa key của n8n cũ vì mất khả năng decrypt credentials.

TLS directory: fullchain.pem, privkey.pem, client-ca.pem. Owner private key UID101, mode0400; certs readable UID101; host directory không mở public. Không mount CA signing private key vào edge. Renew certificate ngoài stack rồi reload edge chỉ sau approval; kiểm tra expiry chủ động. Cấu hình HSTS một năm nên chỉ dùng domain HTTPS đã kiểm tra, không thêm includeSubDomains/preload tự động.

Backend image build bằng `deploy/Dockerfile.backend` với context `backend`, Node22/24 digest được duyệt. Frontend build bằng `deploy/Dockerfile.frontend` với context `frontend`, NODE_IMAGE và NGINX_IMAGE digest được duyệt. Không dùng image app cũ có `/app/data` root-owned rồi giả định user1000 ghi được. Fresh named volumes nhận ownership từ image; volume đã có phải kiểm tra ownership trên **bản sao**, không tự chown dữ liệu thật. Backend/frontend/edge rootfs read-only, cap_drop ALL, no-new-privileges, tmpfs bounded. n8n dùng non-root và writable data volume; chưa ép read-only rootfs để tránh phá runtime chưa kiểm chứng.

Kiểm tra source mà không deploy (trong shell quản trị riêng, không export secrets):

```bash
docker compose --env-file /srv/researchos-staging/release.env -f compose.production.yml -f compose.staging.yml config --quiet
docker compose --env-file /srv/researchos-staging/release.env -f compose.production.yml -f compose.staging.yml config --format json | python3 scripts/ops/preflight.py
```

Không bỏ phần pipe rồi in toàn bộ config khi có overrides chứa inline secrets. Preflight kiểm tra cấu trúc/digest/TLS origin/file refs, không chứng minh firewall, secret content, registry signature hoặc certificate hợp lệ. Chỉ operator được chạy up sau khi mọi gate được chấp thuận; tài liệu cố ý không tự chạy release.

## Backup / restore

Yêu cầu Python >=3.10, sqlite3 chuẩn và GnuPG >=2.2. Không cần Gemini/Tavily keys. `scripts/ops/backup.py` không có lệnh điều khiển Docker, không tìm đọc volumes thật tự động, không xóa source và không restore vào đường dẫn đã tồn tại.

SQLite backup API đọc committed WAL và tạo standalone DB; **không copy một mình file .db**. Để có nhất quán giữa hai DB và PDF files, operator phải chặn writes và drain workers/n8n trước hoặc tạo coordinated offline filesystem snapshot. `--quiesced` là attestation của operator, script không chứng minh writers đã dừng. Một online DB snapshot riêng không tạo atomic snapshot toàn bộ volumes. Không dừng container trong nhiệm vụ hiện tại.

Đầu vào backup: snapshot/safe mounts của DB Research, PDF directory và toàn bộ n8n home (bao gồm database.sqlite và config/binaryData), cùng encryption key đúng instance. Nếu key n8n nằm trong config tự sinh, operator trích xuất an toàn sang key file không log; không sinh key mới thay key cũ. Script kiểm tra key trùng config nếu có. Bản n8n dùng Postgres cần pg_dump riêng: script này chỉ hỗ trợ SQLite.

Backup password/key mã hóa file riêng >=16 bytes, mode0600, quản lý ngoài backup host/archive; không truyền giá trị trong argv. Nên dùng random >=32 bytes. n8n encryption key **khác** backup password. Cần dung lượng staging plaintext + tar + encrypted archive; dùng encrypted disk hoặc private tmpfs đủ lớn. Temporary files được xóa khi kết thúc thông thường nhưng không đảm bảo secure erase trên SSD/swap/crash; mã hóa filesystem và kiểm soát swap là trách nhiệm operator.

Ví dụ chỉ trên **snapshot đã được operator xác nhận**, đường dẫn giả:

```bash
python3 scripts/ops/backup.py backup \
  --database /srv/snapshots/release/research/research.db \
  --documents /srv/snapshots/release/documents \
  --n8n /srv/snapshots/release/n8n \
  --encryption-key /srv/snapshots/release/secrets/n8n_encryption_key \
  --password-file /srv/backup-keys/researchos.pass \
  --output /srv/backups/researchos-REPLACE_TIMESTAMP.gpg --quiesced

python3 scripts/ops/backup.py restore \
  --archive /srv/backups/researchos-REPLACE_TIMESTAMP.gpg \
  --password-file /srv/backup-keys/researchos.pass \
  --target /srv/restore-drills/REPLACE_NEW_DIRECTORY
```

Output restore: research/research.db, documents/, n8n/, secrets/n8n_encryption_key và manifest.json. SHA256 mọi file và integrity_check của cả DB được kiểm tra trước khi publish target. Không chấp nhận archive traversal/symlink/duplicate members; không ghi đè directory đã có. Không tự upload, prune, xoá backup cũ hoặc restore vào volume production. Operator cần upload encrypted archive off-host, retention, kiểm tra checksum và test mất host/password recovery. RPO/RTO phải được đo, không suy ra từ smoke fixtures.

Restore drill:

1. Chọn archive đã seal, restore vào directory mới; xác nhận manifest/integrity, row counts, owners, PDF checksums và key đúng.
2. Tạo project **mới**, network plan không xung đột, ports loopback mới; tạo **volumes mới** hoặc bind mount bản sao restore với UID phù hợp. Không trỏ về named volumes production hoặc mount thư mục restore duy nhất theo cách có thể bị migration làm thay đổi.
3. Disable external ingress/webhook publication, tắt active workflows/schedules trên **bản sao** trước boot n8n; dùng `N8N_DISABLE_PRODUCTION_MAIN_PROCESS=true` chỉ sau xác minh version hỗ trợ, không tin một cờ chưa test. Quan trọng hơn: cô lập egress ở network/host để workflow khôi phục không gửi email/call API/charge provider. Mock keys/providers backend và không đưa keys thật vào drill.
4. Boot app từ đúng image digest của backup trước, xác nhận login/ownership, PDF viewer/RAG fixture, exports, memory; n8n decrypt credential test chỉ trên fake fixture hoặc phương thức không dispatch mạng. Đo RTO, ghi kết quả và kiểm tra không có outbound side effects.
5. Thử upgrade trên một bản sao thứ hai. Chỉ khi operator review đầy đủ mới lên kế hoạch production. Không `down -v` hoặc xóa volumes trong hướng dẫn này.

## Nâng cấp và rollback

Inventory image digest, version binary, schema và external storage của mỗi instance; tag latest không đủ. Xem advisory chính thức n8n, release notes và migration notes. n8n 2.46.1 đã được smoke ở audit trước, không tự coi là latest/sạch mọi CVE. Chuyển 2.0.3 → candidate mới cần thử trên bản sao data và key; inventory community/custom nodes, Python/JS runners và breaking changes.

Node22 maintenance LTS có hạn hỗ trợ; ưu tiên patch mới của dòng hỗ trợ hiện tại hoặc Node24 sau compatibility suite, sqlite native bindings và PDF worker smoke. nginx/Alpine cần bản supported + image scan, không chỉ npm audit. Hai Dockerfile hardening nhận base bằng digest thay vì tự đổi Dockerfile cũ. Lưu SBOM/CVE scan, provenance, digest, lockfile và build/test logs trong release record.

Rollback không phải đổi image cũ trên DB đã migrate. Giữ backup pre-upgrade đã restore-verified, image digest trước và compose/env non-secret version. Trong maintenance window được duyệt: chặn writes, restore vào **volumes mới**, boot image cũ trên schema cũ, xác nhận rồi chuyển ingress; giữ volume lỗi để điều tra. Không chạy downgrade migrations mù hoặc làm mất writes sau cutover: cần quyết định data reconciliation/RPO trước.

## Monitoring

`scripts/ops/monitor.py --project NAME` chỉ đọc Docker labels/status/health/restarts/OOM, JSON và exit1 nếu thiếu/unhealthy service. Có thể thêm `--backup-file /srv/backups/LAST.gpg --max-backup-age-hours 24 --data-directory /srv/researchos --min-free-bytes 2147483648` để báo stale/missing backup và thiếu disk; mtime chỉ là freshness, không chứng minh archive restore được. Chạy bằng host timer/monitoring user có quyền Docker được kiểm soát; Docker socket quyền cao, không expose qua HTTP. Không in env hoặc credentials. Edge healthcheck là nginx config check, **không thay TLS request thực tế**.

Operator phải cấu hình probe HTTPS bên ngoài bằng CA và client cert, certificate expiry/renewal, auth availability, disk free/inodes, backup freshness/offsite/restore age, SQLite busy/WAL growth, queue depth/oldest lease, worker heartbeat, process restarts/OOM và provider budget alerts. Chưa có exporter usage/quota vì ledger chưa được triển khai; không báo dashboard cost chính xác từ ước lượng. Log rotation 10 MiB x3/service; không log prompts/keys/PDF content. Việc gửi alert hoặc cài systemd/cron chưa được thực hiện.
