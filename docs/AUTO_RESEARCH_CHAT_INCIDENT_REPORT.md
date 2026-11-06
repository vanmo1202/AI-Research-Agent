# Điều tra Auto Research Chat — 07/11/2026

## Kết luận và mức độ xác minh

Đã xác nhận hai lỗi trong hợp đồng/validation trích dẫn của chính build backend đang chạy và sửa trong working tree. Không phải giả định backend chưa build đúng phiên bản. Chưa thể khẳng định response Gemini của từng lượt lỗi cũ mắc lỗi nào: bản cũ không lưu error code, finish_reason hay response lỗi; chỉ ghi HTTP 502. Không tuyên bố đã kiểm thử Gemini/Tavily live thành công.

### Bằng chứng thực tế, chỉ đọc

- `docker compose ps`: backend healthy, image `ai-research-agent-backend:2.0.0`, container `944abaa4b15b`, image digest bắt đầu `5297a436c92a`. Backend bind `127.0.0.1:3000`.
- Hash SHA-256 trong container của `chat.js`, `auto-research.js`, `auto-budget.js`, `llm.service.js` khớp hoàn toàn với working tree trước khi sửa. Không dùng GitHub main thay cho source thực tế.
- `MOCK_LLM=false`, `MOCK_SEARCH=false`; cả hai key được cấu hình (chỉ kiểm tra boolean, không xuất giá trị). Model cấu hình là `gemini-3.5-flash-lite`; việc có cấu hình model không chứng minh model hoạt động.
- Logs backend có hai `Request failed (HTTP 502)`, không có nguyên nhân chi tiết.
- SQLite mở `OPEN_READONLY`: đúng câu hỏi người dùng cung cấp có assistant `failed`, stage `answering`, warnings rỗng, `searched=true`, **4 snapshot nguồn**, **2 Tavily reservations**, **2 Gemini reservations**, input dự trù **19.496 bytes**, output dự trù **2.800 tokens**. Lượt Auto failed gần nhất khác có 3 snapshot và cùng hai loại counter bằng 2. Không xuất ID tài khoản, cookies, nội dung hội thoại khác hoặc body nguồn.
- Điều này chứng minh đã có nguồn đi qua bộ lọc/lưu snapshot và đã vào tổng hợp. Không phải tình huống Tavily không trả nguồn hoặc toàn bộ nguồn bị relevance loại bỏ. Reservation không tự chứng minh HTTP Gemini thành công, cũng không phải token thực dùng.

### Hai lỗi tái hiện được trên container đang chạy

Chạy `validateOutput` với dữ liệu tổng hợp trong SQLite `:memory:`, không mạng và không dữ liệu người dùng:

1. Prompt cũ chỉ dẫn citation có `sourceId: null`, nhưng validator yêu cầu ID `web:…` của nguồn Internet. Output làm đúng ví dụ trong prompt bị từ chối với **HTTP 502 — Citation integrity check failed**.
2. Sửa ID cho đúng thì integrity qua. Tuy nhiên một quote nguyên văn như “Số lượng phép tính tăng theo kích thước đầu vào.” không lặp từ khóa “độ phức tạp thuật toán” bị gate kiểm tra riêng quote loại bỏ, dù toàn context được đánh giá đúng chủ đề. Đây là lỗi dùng mức độ liên quan của câu trích ngắn thay cho mức độ liên quan của đoạn nguồn có provenance.

Hai lỗi này có thể trực tiếp gây đúng triệu chứng failed/citations=0 sau khi đã đọc web. Cần mã lỗi live mới hoặc một diagnostic được cấp phép để phân biệt lỗi cụ thể của response lịch sử với trường hợp Gemini HTTP 502/JSON/schema khác. Không suy ngược một response chưa được lưu.

### Hạn chế chẩn đoán live

Một yêu cầu chẩn đoán Gemini thủ công đã được đề xuất: dùng nguồn đã lưu, tối đa 2.200 output tokens, timeout 25 giây, không retry và không gọi Tavily lại. **Auto-review từ chối trước khi thực thi** vì chưa có ủy quyền rõ ràng gửi câu hỏi/nội dung nguồn đã lưu ra provider ngoài và phát sinh phí. Không lách cơ chế này; không có API trả phí nào được gọi trong phiên điều tra hoặc automated tests. Cần người dùng cho phép riêng nếu muốn thực hiện diagnostic đó.

## Thay đổi trong source

### Trích dẫn

Prompt mới chỉ yêu cầu `{contextId, quote}`. Backend ánh xạ referenceId, sourceId, documentId, page từ context đã được owner/retrieval kiểm tra. Không yêu cầu AI chép lại UUID/hash hoặc tự đoán null/page.

Client/model cũ vẫn có thể trả các ID cũ; nếu có trường ID/page thì giá trị phải khớp tuyệt đối. ID sai, quote bịa hoặc không nguyên văn vẫn bị chặn. Giữ điều kiện quote 12–1.000 ký tự; prompt khuyến khích trích ngắn để giảm nguy cơ output bị cắt. Không tăng output budget.

Trước khi commit câu trả lời: resolve lại nguồn theo owner, kiểm tra versionHash và attachment/Memory; với web, kiểm tra relevance trên **nội dung context gốc** thay vì bắt quote ngắn phải chứa lại tên chủ đề. Quote vẫn phải nằm nguyên văn trong context tương ứng.

### Truy vấn ngắn và relevance

Planner được hướng dẫn mở rộng câu ngắn bằng thuật ngữ kỹ thuật/bản dịch trung thực, không tự đổi lĩnh vực. Bộ thuật ngữ dùng chung bổ sung khái niệm thuật toán, độ phức tạp, Big O, thời gian và không gian. Quan hệ cha–con có hướng cho phép câu hỏi tổng quát dùng nguồn về khía cạnh cụ thể; câu hỏi space complexity không được chứng minh chỉ bằng một đoạn time complexity.

Đây là dữ liệu thuật ngữ dùng chung cho retrieval/relevance, không có nhánh `if question === ...`, đáp án AI hardcode hoặc ngưỡng riêng cho ví dụ. Giữ kiểm tra metadata, body thực, dedup và chống sai lĩnh vực. Regression tiếng Việt hỏi “độ phức tạp thuật toán” tìm được tài liệu Anh về Big O/time/space complexity; nguồn WTI/EUR/USD/chứng khoán và economic complexity không liên quan vẫn bị chặn. Regression vật lý trước đó giữ nguyên.

### Phân loại lỗi và trạng thái

Lưu chẩn đoán an toàn trong `research_json` hiện có; không cần migration mới, không viết lại message cũ.

| Tình huống | Mã/trạng thái mới |
|---|---|
| Tavily xác thực | `TAVILY_AUTH_FAILED` |
| Tavily 429/432/433 | `TAVILY_QUOTA_EXCEEDED` |
| Tavily mạng/response không hợp lệ/server | `TAVILY_NETWORK_ERROR` / `TAVILY_INVALID_RESPONSE` / `TAVILY_PROVIDER_ERROR` |
| Gemini xác thực/model | `GEMINI_AUTH_FAILED` / `GEMINI_MODEL_NOT_FOUND` |
| Gemini quota/throttle/mạng/server | `GEMINI_QUOTA_EXHAUSTED` / `GEMINI_RATE_LIMITED` / `GEMINI_NETWORK_ERROR` / `GEMINI_PROVIDER_ERROR` |
| JSON sai / output bị cắt / output bị chặn | `GEMINI_INVALID_JSON` / `GEMINI_OUTPUT_TRUNCATED` / `GEMINI_OUTPUT_BLOCKED` |
| Schema / citation / nguồn thay đổi | `CHAT_INVALID_SCHEMA` / `CHAT_CITATION_REJECTED` / `CHAT_SOURCE_CHANGED` |
| Budget / timeout | `AUTO_CHAT_BUDGET_EXCEEDED` / `CHAT_TIMEOUT` |

Phân loại mã quota Tavily theo [tài liệu lỗi chính thức](https://help.tavily.com/articles/8645538886-understanding-http-errors). Không in raw response của provider để phân loại.

`searchStatus` phân biệt `sources_ready`, `provider_error`, `no_results`, `filtered_out`, `unreadable`. Có counter attempts/successfulSearches/candidates/metadataRejected/contentRejected/readFailures/duplicates/acceptedSources. Bộ fetch SSRF hiện có trả chuỗi rỗng khi đọc lỗi; Auto nhận diện trường hợp này thành read failure, không gọi là sai chủ đề.

Khi tìm kiếm thành công nhưng không có nguồn phù hợp, trả “Không tìm được nguồn phù hợp” kèm thiếu bằng chứng, không gọi là provider failure. Nếu Tavily lỗi nhưng nguồn riêng còn đủ, có thể trả lời dựa trên nguồn riêng kèm cảnh báo; nếu không có nguồn riêng, kết quả chứa thông báo lỗi tìm kiếm và `outcome=search_failed`, không có citations. Request không tổng hợp được câu trả lời Gemini lưu message failed cùng mã/bước lỗi.

HTTP error bổ sung `code`, `stage` cho lỗi Knowledge an toàn. Đặc biệt Gemini 401/403 được trả thành HTTP 503 của dịch vụ, tránh khiến frontend tưởng session người dùng hết hạn và đăng xuất nhầm. Auth 401 của chính ứng dụng vẫn giữ nguyên.

Log có cấu trúc chỉ chứa code, stage, tên provider và HTTP status provider nếu có; không chứa prompt, query, IDs, key, token, cookie, URL hay body provider. Frontend lấy lỗi từ lịch sử đã lưu để refresh không mất nguyên nhân. Chỉ hiển thị thông báo tìm/đọc thành công khi `sources_ready`; nếu tổng hợp thất bại thì ghi “Đã đọc nguồn web; bước trả lời chưa hoàn tất.” Không tự retry POST hoặc tăng số lần gọi provider. Lỗi auth/quota planner dừng trước Tavily.

## File sửa trong lần điều tra này

- `backend/src/knowledge/chat.js`: hợp đồng citation, provenance/relevance, lưu lỗi/stage/usage và trạng thái tìm kiếm.
- `backend/src/knowledge/auto-research.js`: planner câu ngắn, counters, kết quả đọc/lọc và lỗi tìm kiếm.
- **Mới** `backend/src/knowledge/chat-errors.js`: taxonomy/log/thông báo an toàn.
- `backend/src/services/source-relevance.service.js`: thuật ngữ song ngữ và quan hệ khái niệm có hướng.
- `backend/src/services/llm.service.js`: nhận diện finish_reason, đánh dấu nguồn lỗi Gemini.
- `backend/src/services/providers/tavily.provider.js`: giữ status/code/provider khi lỗi, không xuất body.
- `backend/src/server.js`: HTTP code/stage an toàn.
- `frontend/src/components/knowledge/ChatMessage.jsx`, `ChatPanel.jsx`, `frontend/src/services/knowledgeApi.js`: trạng thái/lỗi nhất quán với lịch sử.
- **Mới** `backend/test/auto-chat-failures.test.js`, `frontend/tests/auto-chat-errors.spec.js`.

Đã đọc `auto-budget.js`, retrieval, relevance, migration 006/007 và test liên quan; không cần thay ngân sách, schema hoặc migration. Các thay đổi frontend/backend của các nhiệm vụ trước được giữ lại. Không sửa `.env`, không xóa/reset SQLite hoặc volumes, không restart/rebuild container đang chạy, không commit/push/merge/deploy.

## Kiểm thử trước/sau

Baseline cũ: **136 backend PASS, 36 E2E PASS**; chưa kiểm chứng provider live. Regression fixture trên chính build container tái hiện HTTP 502 của citation contract và việc quote hợp lệ bị gate loại.

Sau sửa, vòng xác nhận cuối: **145/145 backend PASS**, không skip; **39/39 Playwright E2E PASS** (2,2 phút); frontend build, format và `git diff --check` PASS. Các lệnh đã chạy: `npm --prefix backend test`, `npm --prefix frontend run build`, `npm --prefix frontend run test`, `npm --prefix frontend run format:check`. Các HTTP 401/404 trong E2E là tình huống Auth/đường dẫn lỗi có chủ đích; toàn suite exit 0.

Log cục bộ: `/tmp/auto-chat-fix-backend-final.log`, `/tmp/auto-chat-fix-e2e-final.log`, `/tmp/auto-chat-fix-build.log`, `/tmp/auto-chat-fix-format-check.log`. Vòng backend đầu với test mới có 144 PASS/1 FAIL ở trường hợp unreadable nêu dưới; giữ nguyên expected và sửa cách nhận diện kết quả fetch rỗng, sau đó cả 145 PASS.

Chín test backend mới bao phủ: thuật ngữ Việt/Anh và sai ngành, IDs server-owned/forgery, quote không lặp keyword, end-to-end transport Gemini/Tavily giả, auth/quota/model/network/timeout, JSON sai/truncated/blocked/schema/citation, empty/filtered/unreadable sources, planner dừng trước search, budget reservation và HTTP error/history/ownership. Ba E2E mới kiểm tra lỗi Gemini JSON, Tavily auth và tất cả nguồn bị loại; refresh/reload giữ thông báo đúng, không success notice sai và chỉ có một POST.

Trong quá trình regression có một test phát hiện fetcher nuốt lỗi thành chuỗi rỗng khiến Auto phân loại nhầm `filtered_out` thay vì `unreadable`; đã sửa source, giữ expected của test. Không xóa/skip test lỗi hoặc đổi expected chỉ để PASS.

## Kiểm tra lại trên frontend với provider thật

Container đang chạy chưa nhận bản sửa này; không thể reload trình duyệt để cập nhật backend. Operator cần đưa source đã kiểm tra vào môi trường staging/được phê duyệt theo quy trình riêng. Phiên này không tự triển khai.

1. Trong môi trường được phê duyệt, operator kiểm tra `MOCK_LLM=false`, `MOCK_SEARCH=false`, model/key hợp lệ qua cấu hình an toàn; không copy key vào log hoặc ảnh chụp. Giữ bộ giới hạn hiện có: mỗi lượt tối đa 2 Tavily calls, 3 Gemini calls, 5.000 output tokens dự trù, deadline 90 giây. Chọn giới hạn ngày thấp phù hợp trong môi trường thử, không thay `.env` thật trong phiên này.
2. Tạo chat mới, bật Internet; gửi **một lần** “độ phức tạp thuật toán”. Không gửi lại trong lúc pending hoặc kết quả HTTP chưa rõ. Quan sát planning → searching → reading → answering → validating.
3. Nếu thành công: kiểm tra URL/quote Big O, time/space complexity. Không chấp nhận nguồn tài chính sai ngành. Nếu failed: xem mã/bước lỗi trong message hoặc `research.error`, response HTTP `code/stage`, log `[AutoChat]`; không chụp Authorization/Cookie/request body riêng tư.
4. Nếu `no_results`/`filtered_out`/`unreadable`, UI phải nói không tìm được nguồn phù hợp; nếu auth/quota/network thì phải nêu đúng provider. Không có citation giả hoặc Memory tự verified. Reload kiểm tra trạng thái được giữ.
5. Dừng sau một lượt live để kiểm tra usage. Chỉ gửi lại thủ công sau khi hiểu nguyên nhân. Kiểm tra tắt Internet với PDF riêng bằng lượt riêng nếu cần.

Chưa xác minh live đầu ra Gemini/Tavily sau bản sửa; không coi automated provider stubs là bằng chứng live. Muốn chẩn đoán trực tiếp response gốc còn cần sự cho phép gửi payload ra Gemini như nêu trên.
