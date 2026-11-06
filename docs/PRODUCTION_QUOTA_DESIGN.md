# Thiết kế quota bền vững theo user

Trạng thái: **thiết kế, chưa thực thi trong application**. Không được mở public không giới hạn dựa trên tài liệu này. Stack hardening mặc định yêu cầu mTLS để hạn chế người truy cập trong giai đoạn này. mTLS không thay thế quota, ngân sách provider hoặc authorization ứng dụng.

## Phạm vi và contract

Giữ nguyên endpoint, cookie/session, ownership và payload thành công. Middleware/service lấy `user_id` từ session hoặc owner service đã được internal API xác thực, không lấy từ body. Lỗi hết quota dùng HTTP 429, body hiện có `{success:false,error:"Đã vượt hạn mức…"}`; có thể bổ sung `code`, `retryAfter` và header `Retry-After` mà không đổi kiểu `error`. Không tính /health, polling trạng thái và tải dữ liệu đã có như job/provider call mới.

Mỗi plan được operator phê duyệt: số research runs/ngày UTC, số run active, tổng jobs queued, bytes PDF đang dùng + reserved, số documents, Gemini input/output tokens/ngày, Tavily credits/search requests/ngày, chi phí dự phòng theo provider và user/ngày/tháng. Thêm global caps cho toàn hệ thống và provider. Không đưa giá bán provider vào code: operator duyệt rate card có version, đơn vị integer micro-USD hoặc đơn vị tín dụng gốc. Giá phải được cập nhật từ hợp đồng/provider; không coi token estimate là hóa đơn thật.

## Dữ liệu và atomicity

Migration mới, additive, kiểm tra rollback trên bản sao trước release:

- `quota_plans`: plan_id, version, limits_json, effective_at; không sửa lại lịch sử pricing.
- `user_quota_plans`: user_id FK users, plan_id, enabled; disabled user không tạo chi phí mới.
- `quota_buckets`: `(subject_type, subject_id, metric, period_start)` UNIQUE; limit, used, reserved INTEGER >=0; period UTC. Subject có user và global/provider.
- `quota_reservations`: id, user_id, resource_type, resource_id, operation_key UNIQUE, state, lease_token, expires_at, estimated_units_json, pricing_version, created_at.
- `usage_events`: event_id UNIQUE, reservation_id, provider_request_id, attempt, units_json, cost_micros, status, usage_source; append-only, không chứa prompt/key/nội dung PDF.

Reserve bằng **BEGIN IMMEDIATE** trong connection queue SQLite hiện có: đọc plan/buckets → kiểm tra mọi metric → tăng reserved → ghi reservation → tạo resource/job, cùng transaction nếu chung DB. Không gọi mạng trong transaction. Không thực hiện middleware kiểu SELECT rồi UPDATE rời nhau. Index user/time, operation_key, resource_id, state/expires_at; test parallel từ hai process chung WAL.

## Research jobs và provider calls

1. Reserve run/day và active slot khi tạo run, dựa trên request owner. Replay idempotency key trả cùng run/reservation; retry stage không tính thành run mới, nhưng mọi provider attempt có thể phát sinh usage mới.
2. Worker claim job theo lease/fencing hiện có. Reserve ngân sách **trước từng** Gemini/Tavily call, bao gồm retry/translation/search-more/chat/report. Context input bị giới hạn, max output tokens bắt buộc, Tavily search/max_results bị giới hạn. Không cho caller thay model/limits để vượt plan.
3. Chỉ gọi provider sau reserve thành công; dùng operation key duy nhất theo job/stage/provider/attempt. Settle usage thật từ response; chênh lệch estimate chuyển từ reserved sang used theo transaction. Nếu provider không trả usage, giữ khoản conservative upper bound và đánh dấu estimated để reconciliation, không tự coi là miễn phí.
4. Timeout/crash có thể đã bị provider tính phí: **không hoàn tiền tự động chỉ vì lease hết hạn**. Hold reservation, đối soát request ID/log provider nếu có, hoặc tính upper bound có audit trail. Fencing ngăn worker cũ settle hai lần, nhưng không chứng minh provider chưa nhận call; đây là lý do cần hold và global cap ở tài khoản provider.
5. Cancel giải phóng phần chưa dispatch; giữ usage của các calls đã dispatch. Active slot chỉ release ở transition terminal, idempotent. Tắt user không xóa usage. Internal n8n owner service cũng có quota riêng, không được bypass.
6. Chặn admission khi queue/global disk đạt ngưỡng; backpressure 429/503 có Retry-After. Rate limit IP ở nginx hiện có là bảo vệ ngắn hạn, không phải quota theo user.

## PDF storage

Trước upload reserve tối đa số bytes cho phép hoặc Content-Length đã kiểm tra, đồng thời reserve document count. Không tin Content-Length: stream kiểm tra bytes thực tế và dừng ở hard cap; dùng temp file cùng filesystem. Chỉ settle sau fsync/rename và DB metadata thành công. Nếu lỗi, cleanup temp rồi release reservation trong transaction bù có event idempotent. Job reconciliation kiểm tra orphan files/rows và pending reservations sau restart trước khi hoàn quota. Đừng xóa file referenced bởi document/report/chat còn sống; cần chính sách retention đã duyệt.

Deletion đánh dấu tombstone, hoàn bytes sau khi xóa file thực sự; không hoàn khi chỉ xóa metadata. Backups có quota dung lượng hệ thống riêng; disk free low-watermark chặn upload và tạo việc mới trước khi SQLite hết chỗ ghi WAL.

## Kiểm thử bắt buộc trước public

- Hai process cạnh tranh slot/budget/storage, không vượt giới hạn sau COMMIT; deadlock/busy có bounded retry.
- User A/B độc lập, global cap cộng đúng, internal owner không bypass.
- Replay tạo run/upload không trừ hai lần; retry provider có usage riêng.
- Worker crash sau reserve, trước call, sau call và trước settle; expiry/fencing không refund sai hoặc double spend.
- Quota rollover UTC, ngày/tháng, đổi plan/pricing, disabled user, provider usage thiếu.
- PDF upload ngắt kết nối, Content-Length giả, file lớn, concurrent upload/delete và reconciliation.
- Backward compatibility frontend: 429 có thông báo tiếng Việt và retry được; không lộ ngân sách người khác.

Gate release: implementation + migrations + các tests trên + approval plan/rate card + kiểm tra provider account caps. Hiện chưa đáp ứng; chỉ cho phép thử nghiệm hạn chế bằng mTLS và mock keys/providers hoặc ngân sách được operator duyệt.
