# Sửa chất lượng nguồn tìm kiếm ResearchOS

Ngày 06/11/2026. Branch `main`, HEAD khi bắt đầu: `49b448cb441ff0ff409cf4f1a146a42fd2a61e67`. Working tree ban đầu sạch; không sửa dữ liệu người dùng, frontend, Auth, Docker, n8n hoặc secrets. Không commit/push/deploy. Các thay đổi dưới đây chưa commit.

## Nguyên nhân và cách tái hiện

Đã đọc đủ chín file được yêu cầu cùng worker stages, report generation và research retrieval.

- Workflow truyền thống gọi Tavily → normalize URL → dedup → lấy nội dung → lưu nguyên bản vào SQLite → dịch. Không có gate kiểm tra đúng chủ đề trước khi `createSources`.
- Flow v2 có nhánh Tavily riêng trong `research.provider.js`; nhánh này cũng lưu mọi URL hợp lệ sau SSRF/dedup, không sử dụng source relevance. Trước sửa, snippet Tavily còn bị ghi đè bởi `raw_content` mà không giữ thành trường `snippet`.
- Planner kiểm tra schema và số lượng câu hỏi/truy vấn, nhưng không kiểm tra neo chủ đề/phạm vi của truy vấn sau khi model trả về. Prompt yêu cầu truy vấn ngắn, chưa ràng buộc rõ nghĩa chuyên ngành.
- `relevance.service.js` chỉ chấm chunk sau collection, không ngăn source sai vào database. Tokenizer cũ bỏ từ dưới ba ký tự, không chuẩn hóa `đ`; làm mất “lò”, “xo”, “cơ”. Điểm cộng cho một từ dài xuất hiện không chứng minh đúng chủ đề. Từ chung trong topic/goal/question có thể góp điểm.
- Report truyền thống đưa toàn bộ sources vào references/context. Một source đã lưu không tự động được tái kiểm tra khi tạo evidence/report mới.

Regression dùng đúng topic/goal/scope con lắc lò xo, stub HTTP response Tavily gồm chứng khoán, WTI, EUR/USD. **Trước sửa: 3 nguồn được lưu, status `collected`; assertion yêu cầu từ chối thất bại** (`Missing expected rejection`). Không gọi Tavily/Gemini thật, không kết luận đã biết chính xác truy vấn Gemini của nghiên cứu lịch sử do người dùng nêu: không có payload/log thực tế của lần đó. Đã chứng minh nguyên nhân backend tiếp nhận và lưu kết quả sai bằng fixture độc lập.

## Logic mới

Module chung `source-relevance.service.js` phục vụ cả hai workflow:

1. Chuẩn hóa Unicode, dấu tiếng Việt và `đ`; giữ thuật ngữ hai ký tự/số. Loại các từ tác vụ/boilerplate khỏi chủ đề, không coi “nghiên cứu”, “nguồn”, “phân tích”, “lý thuyết” là đủ liên quan.
2. So khớp cụm khái niệm, subject terms và scope; có lexicon tương đương Việt–Anh dùng chung nhiều lĩnh vực. Ví dụ spring-mass/con lắc lò xo, harmonic motion/dao động điều hòa, higher education/đại học, monetary policy/chính sách tiền tệ. Không có nhánh `if topic == con lắc` hoặc blacklist tài chính. Tài liệu WTI/chứng khoán vẫn được nhận khi chủ đề tương ứng là kinh tế/tài chính; từ mới như SQLite/WAL dùng cơ chế lexical chung, không cần alias riêng.
3. Goal hỗ trợ nguồn phương pháp luận cho chủ đề rộng; query agreement chỉ là thông tin hỗ trợ, không được dùng để cứu nội dung sai chủ đề. Một query đúng không chứng minh source đúng.
4. Gate nhanh đọc title/snippet và raw content nếu provider đã trả. Metadata mơ hồ không bị loại chỉ vì thiếu từ; cho phép kiểm tra nội dung sau fetch. Metadata có khái niệm khác rõ ràng hoặc raw body đủ thông tin nhưng sai chủ đề bị loại sớm.
5. Sau fetch/clean, đánh giá lại body. Title/snippet có vẻ đúng không cứu được body sai. Trang công thức ngắn hoặc bản ghi ít thông tin được giữ ở trạng thái `uncertain`, tránh loại cứng do thiếu văn bản; chúng không được coi là bằng chứng semantic đã xác nhận.
6. Chỉ sources qua gate mới được lưu/dịch. Truyền thống lọc trước dedup để một biến thể nội dung sai dài hơn không che mất bản hợp lệ cùng URL; v2 không để source bị loại chiếm slot và cache body fetch trong lần collection để không tải lặp URL.

Không nâng `RAG_MIN_RELEVANCE_SCORE` để che lỗi. Các tiêu chí “đủ văn bản”, độ dài từ và số term là heuristic cho độ chắc chắn lexical, không phải ngưỡng relevance được tuyên bố tối ưu trên mọi corpus. Bộ lọc có trạng thái `relevant / uncertain / rejected`; aliases không phải từ điển song ngữ đầy đủ, cũng không thay mô hình semantic đa ngôn ngữ. Nguồn chỉ diễn đạt bằng từ đồng nghĩa chưa biết, chủ đề đa nghĩa và nguồn liên ngành khó vẫn cần đánh giá corpus/false positives/false negatives thực tế. Không tuyên bố đã giải quyết mọi trường hợp semantic.

## Planner và truy vấn

Prompt mới yêu cầu giữ chủ thể chuyên ngành, goal/scope, tương đương thuật ngữ Việt–Anh và tránh từ đa nghĩa đứng một mình. Guard xác định query có neo subject/scope không; query hợp lệ, kể cả tiếng Anh, được giữ. Query lệch được **thay bằng topic/scope/goal**, không giữ thêm các từ như market/volatility chỉ bằng cách nối chúng sau topic vật lý. Query đã sửa được dedup trước gọi search, không gọi lại planner để sửa từng query.

Kiểm tra ở cả `generateResearchPlan`, planner v2 và lúc thực thi collection, bao gồm search-more. Vì vậy kế hoạch đã lưu từ trước cũng có guard khi người dùng chủ động chạy tìm kiếm mới, nhưng không rewrite plan/database lịch sử. Schema object arrays và question IDs giữ nguyên. API `queryCount` cũ vẫn là số query trong kế hoạch; metric additive `executedQueries` cho biết số query thực thi sau dedup ở workflow truyền thống.

## Evidence, RAG và reports

- Nguồn không phù hợp không vào chunks/context mới. `getEvidence` chỉ đọc evidence thuộc sources còn đủ điều kiện; không tự xóa historical source/evidence/report rows khi mở trang.
- Scorer chunk dùng normalization/khái niệm chung, bỏ điểm từ các từ tác vụ chung. Production không chọn chunk điểm 0 kể cả cấu hình min=0. Giữ tương thích chế độ mock RAG với min=0 đã được thiết kế cho fixture; **mock không được miễn source gate** và không gọi model thật.
- Cache evidence có version mới để không tái dùng verdict từ scorer cũ. Các ràng buộc sourceId/chunkId, ngôn ngữ và provenance hiện có được giữ.
- V2 kiểm tra source eligibility trước Gemini; quote phải là substring đúng chunk/source version và quote sai chủ đề bị từ chối dù nằm trong chunk có phần nội dung vật lý hợp lệ. Worker context và cơ chế giữ lại evidence sau retry chỉ thấy nguồn/chunks đủ điều kiện.
- Report truyền thống lấy eligible sources, remap citation labels nhất quán cho báo cáo mới. V2 composing loại evidence của nguồn không còn hợp lệ, verifying không đánh dấu completed khi analysis còn evidence nguồn bị loại. Research-mode chat retrieval dùng cùng gate; đường PDF attachment/FTS và ownership giữ nguyên.
- Model SQLite `source.model.js` vẫn làm UPSERT/COMMIT và giữ ID, không gắn một heuristic làm thay đổi dữ liệu khi đọc. Không có schema migration, bulk cleanup hoặc sửa kết quả cũ.

## Khi không có nguồn phù hợp

Truyền thống: request `failed`, HTTP 502 theo contract lỗi collection hiện có, thông báo tiếng Việt “Không tìm thấy nguồn phù hợp với chủ đề và phạm vi nghiên cứu. Hãy điều chỉnh truy vấn và thử tìm lại.” Không lưu các source mới sai chủ đề. Chỉ tìm lại khi người dùng thao tác; giữ khóa chống cùng request search đồng thời.

V2: warnings `SOURCE_OFF_TOPIC`, `NO_RELEVANT_SOURCES`; coverage `unavailable`, report nêu chưa có bằng chứng, run kết thúc `partial`, references rỗng. Nếu `searchMore=true`, giữ giới hạn cũ: tối đa hai vòng bổ sung, tối đa bốn query mỗi collection và durable search/LLM budgets. Regression ghi nhận tối đa 12 search calls trong ba vòng, **0 Gemini calls** khi tất cả nguồn bị loại. Đây không phải research thành công chỉ vì stage search đã thực thi xong.

## Chi phí và hiệu năng

Không có classifier Gemini hoặc embedding API mới, không thêm dependency. Lọc là xử lý cục bộ; nguồn bị loại trước dịch không tiêu tốn translation/evidence calls. Tavily v1/v2 đều explicit `search_depth=basic`, không gọi answer generation. Retry/timeout/concurrency/budgets hiện có giữ nguyên; V2 vẫn kiểm tra URL được chọn; các page fetch thực vẫn dùng DNS pinning/redirect validation cũ, không sửa `content.service.js`.

Benchmark tổng hợp: 1.000 candidates khoảng 9.360 ký tự/body, 500 hợp lệ + 500 không hợp lệ; khoảng **1.669,39 ms tổng** (~1,67 ms/candidate) trên host kiểm thử, **0 provider calls**. Đây là microbenchmark CPU, không phải SLA hoặc load test VPS. Query repair/dedup không tạo thêm planner call; regression mô phỏng planner sai chỉ có một planner call. Mixed collection truyền thống giữ bốn query gốc, không tự search mở rộng. V2 search-more vẫn có thể tiêu thêm ngân sách nếu được bật, trong giới hạn đã có; không hứa chi phí provider production bằng 0.

## File đã sửa

- Mới: `backend/src/services/source-relevance.service.js`, `backend/test/source-relevance.test.js`.
- Planner/collection: `backend/src/services/llm.service.js`, `research.service.js`, `backend/src/providers/research.provider.js`.
- Evidence/ranking/report: `backend/src/services/relevance.service.js`, `evidence.service.js`, `report.service.js`.
- V2 stages: `backend/src/workers/runner.js`, `backend/src/jobs/composing.job.js`, `verifying.job.js`.
- Research chat guard: `backend/src/knowledge/retrieval.js`.
- Báo cáo này. Không sửa frontend hoặc các bài test có sẵn để đổi expected/skip.

## Kết quả kiểm thử

| Lệnh / kịch bản | Trước | Sau |
| --- | --- | --- |
| Regression tái hiện ban đầu | FAIL, lưu 3 nguồn tài chính | PASS, 0 nguồn mới được lưu |
| `npm --prefix backend test` | 110 PASS + 1 regression FAIL | **121 PASS**, 0 FAIL/skip |
| `npm --prefix frontend run build` | Không thay UI | **PASS** |
| `npm --prefix frontend run test` | Script không tồn tại | **FAIL cấu hình: Missing script: test**; không thêm alias để che lỗi |
| `npm --prefix frontend run test:e2e` | Bộ hiện có | **33 PASS**; log lần cuối bên dưới |
| `git diff --check` | — | PASS |

11 regression tests mới gồm: vật lý vs chứng khoán/WTI/EURUSD; dấu/không dấu/Anh; title đúng body sai; trang công thức/metadata mơ hồ; nhiều lĩnh vực và tài chính đúng chủ đề; query repair không gọi model thêm; mixed Tavily/dedup/cache IDs; process độc lập đọc SQLite đã COMMIT; fetched body sai; v2 bounded retry và persistence; legacy rows không bị xóa khi tạo evidence/report mới; mock offline; source/quote gate trước Gemini cùng citation integrity. Một test method có nhiều assertions/fixtures; không cộng số fixture thành số tests.

Các lần chạy trung gian phát hiện false negatives ở fixture translation ít nội dung và nguồn phương pháp luận research chat. E2E còn phát hiện query hợp lệ bị collapse khi scope chung “nguồn web công khai” bị xem là chủ thể; đã loại scope boilerplate khỏi anchors, giữ intent query đúng và thêm regression bảo toàn bốn query khác nhau. Đã sửa xử lý uncertain/goal support và giữ semantics mock min=0; không sửa expected hoặc bỏ bài test cũ. Các bộ Auth, SSRF, worker, migrations, PDF RAG, n8n và report export hiện có vẫn nằm trong 121 tests cuối.

Logs `/tmp` có thể bị dọn: `relevance-before.log`, `relevance-baseline-backend.log`, `relevance-backend-release-check.log`, `relevance-frontend-build-final.log`, `relevance-frontend-requested-test.log`, `relevance-e2e-final.log`, `relevance-performance.log`. Không gọi Gemini/Tavily thật hoặc chạy tests trên DB người dùng. Không thay production readiness NO-GO của các báo cáo trước bằng kết quả của đợt sửa relevance này.

## Kiểm tra lại trên Frontend

1. Dùng backend source mới sau khi bạn tự khởi động trong môi trường thử nghiệm phù hợp; tôi chưa restart/deploy service đang chạy. Để kiểm tra transport offline, giữ mock providers; dữ liệu mock không chứng minh chất lượng Tavily thật.
2. Tạo **nghiên cứu mới**: topic “Dao động điều hòa của con lắc lò xo”; goal “Tìm hiểu lý thuyết và bài tập vật lý từ cơ bản đến nâng cao”; scope “Con lắc lò xo”. Không xóa/sửa nghiên cứu cũ để thử.
3. Xem kế hoạch: các query phải có chủ thể vật lý/spring-mass/harmonic motion và phạm vi phù hợp. Khi bạn cho phép dùng provider thật, dùng keys/ngân sách do bạn quản lý; tôi không thực hiện cuộc gọi trả phí này.
4. Chạy thu thập. Kiểm tra title **và nội dung nguồn**, không chỉ query. Các fixture chứng khoán, WTI, EURUSD bị loại; nguồn vật lý thật được giữ. API search có `metrics.candidates`, `rejectedSources`, `executedQueries`; dữ liệu Tavily live có thể khác fixtures, không hứa số nguồn cố định.
5. Nếu không có nguồn phù hợp, xác nhận thông báo rõ ràng/trạng thái failed hoặc partial; không có evidence/báo cáo khẳng định sai. Chỉnh topic/scope/query và chủ động thử lại. Tắt search-more nếu không muốn vòng search bổ sung khi kiểm tra provider thật.
6. Chạy phân tích, tạo report và export; citations phải trỏ tới source/chunk phù hợp. Các trang nghiên cứu cũ vẫn giữ dữ liệu lịch sử; không kỳ vọng đợt sửa này tự dọn các nguồn đã lưu từ trước.

Giới hạn còn lại: script `frontend test` chưa được định nghĩa; semantic relevance ngoài lexicon/corpus fixtures chưa được đánh giá bằng nguồn live. Cần thêm corpus đa lĩnh vực có nhãn và theo dõi precision/recall trước khi tuyên bố chất lượng tìm kiếm đã tối ưu trên mọi lĩnh vực.
