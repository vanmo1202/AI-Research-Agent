# Auto Research Chat — 07/11/2026

## Phạm vi và luồng xử lý

Đã đọc working tree và giữ các thay đổi Source Relevance/Knowledge UX trước đó; bản diff đầu phiên được lưu ở `/tmp/auto-chat-baseline.patch`. Không thay đổi `.env` thật, dữ liệu người dùng, Docker/n8n; không commit, push hoặc deploy.

Trước đây Chat cần nguồn được chọn trước. Nay giao diện tạo hội thoại mặc định **Auto + Internet bật**, cho phép bắt đầu không có PDF hoặc Research Plan. Backend tự giải quyết câu hỏi tiếp nối, tìm bằng chứng riêng phù hợp, quyết định tìm web, đọc/lọc nguồn rồi tổng hợp tiếng Việt với trích dẫn. Không tạo Research Plan ngầm.

1. Kiểm tra quyền sở hữu, nguồn được chọn, client token và lease độc quyền của lượt chat.
2. Tìm đoạn PDF/nguồn nghiên cứu/Memory được cho phép. Nếu chưa chọn PDF hoặc Memory và không giới hạn nghiên cứu, có thể tìm trong tối đa 12 PDF ready của chính tài khoản. Memory vẫn phải được người dùng chọn rõ ràng.
3. Khi Internet bật: Gemini tạo câu hỏi độc lập và tối đa hai truy vấn từ câu hỏi hiện tại, hai câu hỏi trước của người dùng và số lượng đoạn riêng tìm được. Không gửi nội dung PDF/Memory hoặc câu trả lời AI vào bước định tuyến/Tavily.
4. Truy vấn lệch chủ đề được thay bằng câu hỏi đã neo ngữ cảnh. Tìm web khi cần cập nhật/bằng chứng mới hoặc thiếu dữ liệu riêng. Nếu trả lời từ tài liệu riêng không tạo được claim hợp lệ, cho phép một lần bổ sung web có giới hạn.
5. Lọc metadata, đọc nội dung raw từ Tavily hoặc tải trang qua bộ chống SSRF hiện có; kiểm tra lại nội dung thực, loại trang quá ngắn/login/access denied, sai chủ đề và nội dung trùng. Ưu tiên đa dạng host, tối đa bốn nguồn đọc mỗi lượt.
6. Kết hợp tối đa tám đoạn/10.000 ký tự; Gemini trả lời với quote và reference hợp lệ. Prompt yêu cầu giải thích, ví dụ/so sánh khi có căn cứ và nêu khác biệt giữa nguồn mâu thuẫn. Không có bằng chứng hợp lệ thì thông báo thiếu bằng chứng, không tạo Memory giả.
7. Lưu snapshot nội dung, URL, hash, thời điểm đọc và usage; xác minh lại quyền/provenance trước khi lưu câu trả lời. Citation mở URL và hiển thị tiêu đề, đoạn trích, thời điểm đọc.

Cache web chỉ cho cùng câu hỏi, hội thoại và tài khoản, trong 30 phút, từ lượt đã hoàn tất; yêu cầu thông tin mới bỏ qua cache. Tắt Internet không chạy planner web, Tavily hoặc lấy web cache. Nguồn web đã được chủ tài khoản duyệt thành Memory và chọn rõ ràng vẫn là kiến thức riêng được phép dùng.

## Chất lượng và bảo mật

Bộ lọc dùng chung source relevance hiện có, chuẩn hóa Việt có/không dấu và khái niệm Anh–Việt; loại các từ chỉ dẫn chung khỏi profile câu hỏi. Trùng “giải thích” không đủ để coi tài chính phù hợp vật lý. Kiểm tra cả câu hỏi gốc và câu hỏi đã giải quyết, metadata và body. Title đúng nhưng body sai bị loại. Không thêm nhánh định tuyến riêng cho từng ví dụ kiểm thử.

Đã sửa tình huống dedup: kết quả sai chủ đề xuất hiện trước không được chiếm URL khiến kết quả hợp lệ cùng URL bị bỏ. Nguồn chỉ có snippet không được dùng như nội dung trang. Tavily giữ `basic`, tắt answer tự sinh, yêu cầu raw content; tham khảo [Tavily Search reference](https://github.com/tavily-ai/skills/blob/main/skills/tavily-best-practices/references/search.md).

Giữ Auth/session cookie/CSRF, owner checks, DNS pinning, chặn IP riêng và redirect SSRF, timeout/concurrency hiện có. Không bổ sung endpoint công khai đọc snapshot. Memory web dùng reference `web:` có owner và phiên bản hash; approval/recall vẫn qua xác minh nguồn hiện có. Không tự phê duyệt Memory.

## Ngân sách backend

Reservation SQLite nguyên tử trước khi gọi provider, tồn tại qua restart và không được hoàn lại bằng cách xóa chat. Không tự retry provider trong Auto, không tự retry POST từ trình duyệt. Deadline toàn lượt 90 giây; lease hiện có 120 giây. Tìm kiếm timeout 12 giây, tải trang 8 giây, concurrency đọc trang 2.

| Giới hạn | Mỗi lượt | Mỗi user/ngày UTC | Toàn ứng dụng/ngày UTC |
|---|---:|---:|---:|
| Tavily calls | 2 | 20 | 200 |
| Gemini calls | 3 | 30 | 300 |
| Input UTF-8 bytes dự trù | 60.000 | 600.000 | 6.000.000 |
| Output tokens dự trù tối đa | 5.000 | 50.000 | 500.000 |
| Tải trang trực tiếp | 4 | 80 | 800 |

Các biến operator có thể cấu hình: `AUTO_CHAT_DAILY_SEARCH_LIMIT`, `AUTO_CHAT_DAILY_GEMINI_LIMIT`, `AUTO_CHAT_GLOBAL_SEARCH_LIMIT`, `AUTO_CHAT_GLOBAL_GEMINI_LIMIT`. Giá trị phải là số nguyên dương; server áp trần lần lượt 100/100/1000/1000. Không nhận ngân sách từ request. Không sửa `.env` thật trong triển khai này.

Đây là giới hạn vận hành bảo thủ cho Auto Chat, không phải đồng hồ tiền chính xác: input tính byte kèm phần dự phòng, output giữ chỗ theo max tokens, lỗi/timeout vẫn giữ reservation. Mock cũng đi qua ledger. Research Workflow và chat private cũ giữ chính sách hiện có; operator vẫn cần quota/billing alert ở tài khoản provider cho toàn hệ thống.

## Migration và tương thích

Migration `007-auto-research-chat` thêm `auto_research`, `internet_enabled`, `research_json`, bảng snapshot `chat_web_sources` và hai bảng usage. Migration nguyên tử, idempotent; đã kiểm thử lỗi giữa chừng rollback rồi chạy lại, bảo toàn message cũ. Chưa áp dụng lên database thật trong phiên này.

Hội thoại cũ giữ Internet tắt để tránh phát sinh chi phí ngoài ý muốn; chủ tài khoản có thể bật qua giao diện/PATCH preferences. API tạo chat không gửi mode/scope mặc định Auto. Client cũ gửi explicit scope nhưng không gửi mode tiếp tục chế độ private tương thích. Giao diện mới gửi mode rõ ràng, bao gồm chat theo nghiên cứu. Chat PDF trực tiếp và request_id nullable từ migration 006 được giữ nguyên.

Snapshot web có thể tồn tại sau khi xóa hội thoại để citation của Memory đã duyệt không hỏng; vẫn chỉ chủ sở hữu được resolve. Usage không cascade xóa nhằm tránh lách quota. Không tự xóa hay viết lại nghiên cứu cũ.

## File của tính năng này

- Mới: `backend/src/knowledge/auto-research.js`, `auto-budget.js`, `backend/src/migrations/007-auto-research-chat.js`.
- Mở rộng: `backend/src/config/database.js`, `backend/src/knowledge/chat.js`, `memory.js`, `routes.js`.
- Truyền timeout/signal/retry có kiểm soát: `backend/src/services/content.service.js`, `search.service.js`, `providers/tavily.provider.js`.
- Giao diện: `frontend/src/pages/DocumentChatPage.jsx`, `ResearchChatPage.jsx`, `frontend/src/components/knowledge/ChatPanel.jsx`, `ChatMessage.jsx`, `CitationCard.jsx`.
- Test mới: `backend/test/auto-research-chat.test.js`, `auto-chat-migration.test.js`, `frontend/tests/auto-chat.spec.js`.

Các file khác đang có trong git status thuộc những thay đổi trước đó; không quy toàn bộ working tree cho tính năng này.

## Kiểm thử

Baseline trước tính năng: 126 backend tests và 35 E2E PASS. Sau tính năng: **136/136 backend PASS**, không skip; **36/36 E2E PASS** (2,1 phút). Frontend build, format check và `git diff --check` PASS. Các lệnh đã chạy: `npm --prefix backend test`, `npm --prefix frontend run build`, `npm --prefix frontend run test`, `npm --prefix frontend run format:check`.

Log kiểm chứng cục bộ: `/tmp/auto-chat-backend-final.log`, `/tmp/auto-chat-build-verified.log`, `/tmp/auto-chat-e2e-verified.log`, `/tmp/auto-chat-format-verified.log`. Log E2E có HTTP 401/404 dự kiến từ các test Auth/đường dẫn lỗi; kết quả toàn bộ suite exit 0. Đối chiếu các phần diff cũ ngoài nhóm file được mở rộng cho tính năng: không có thay đổi ngoài phạm vi.

Regression bao gồm vật lý con lắc lò xo so với chứng khoán/WTI/EUR/USD, tài liệu vật lý hợp lệ, Dijkstra, AI, lịch sử và kinh tế; Việt/Anh, title đúng/body sai, tất cả nguồn sai, fetch nội dung thật qua HTTP stub, redirect vào IP riêng, hai truy vấn riêng biệt, lỗi provider không retry, cache/freshness, privacy của định tuyến, fallback local→web, Memory approval/ownership, reservation cạnh tranh và persistence đọc từ tiến trình SQLite độc lập. Test dùng database tạm và provider giả, không API trả phí.

Trong quá trình thực hiện, test đã phát hiện và dẫn đến sửa dedup URL, nhận dạng câu nối tiếng Việt, lựa chọn Memory bị PDF tự động lấn át và checkbox Internet phản hồi chậm. Không bỏ test hay đổi expected để che lỗi.

## Kiểm tra thủ công

1. Operator cấu hình provider ở môi trường thử riêng, tắt MOCK nếu muốn kiểm tra Internet thật; kiểm tra ngân sách tài khoản trước. Automated tests không xác minh chất lượng đầu ra live Gemini/Tavily.
2. Mở `/chat`, giữ Auto và Internet bật, không chọn tài liệu; tạo hội thoại rồi hỏi lý thuyết/bài tập dao động điều hòa con lắc lò xo.
3. Kiểm tra các trạng thái tìm/đọc/tổng hợp, tiêu đề/URL/đoạn trích. Nguồn tài chính sai chủ đề không được thành citation. Hỏi tiếp về chu kỳ để kiểm tra ngữ cảnh.
4. Tạo chat mới cho giải thuật, AI, lịch sử, kinh tế; mở nguồn đối chiếu nội dung. Hỏi câu cần cập nhật để kiểm tra bỏ cache.
5. Tắt Internet, chờ lưu xong, hỏi nội dung có trong PDF đã ready; kiểm tra citation theo trang. Nếu không có bằng chứng phải báo thiếu dữ liệu. Reload vẫn giữ Internet tắt.
6. Duyệt Memory có trích dẫn, chọn rõ Memory cho chat mới; tài khoản khác không được đọc. Kiểm tra responsive 375/768/1024/1440px.

## Giới hạn còn lại

Lọc relevance và chất lượng là heuristic kết hợp khái niệm, không bảo đảm mọi lĩnh vực/ngôn ngữ đều hoàn hảo. Giới hạn hai truy vấn/bốn nguồn có thể bỏ sót nguồn tốt ở phía sau. Citation kiểm tra provenance và đoạn trích, chưa phải bộ chứng minh entailment độc lập cho mọi diễn giải. Phát hiện mâu thuẫn do Gemini thực hiện theo prompt, chưa có contradiction engine riêng. Thời điểm đọc không đồng nghĩa ngày xuất bản. Chưa chạy provider thật có phí hoặc kiểm chứng trên VPS; đây không phải kết luận production GO.
