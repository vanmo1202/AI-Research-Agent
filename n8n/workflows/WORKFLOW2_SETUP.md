# Workflow 2 - Search & Collect

1. Chạy backend bằng `npm run dev`, với `MOCK_LLM=true` và `MOCK_SEARCH=true`.
2. Chạy Workflow 1 trước và lấy `requestId` trong kết quả.
3. Import `workflow-2-search-collect.json` vào n8n.
4. Mở node **02 - Research Request ID**, thay placeholder bằng requestId thật.
5. Execute Workflow. Node cuối trả `searchResult` gồm requestId, status, queryCount, sourceCount và sources.

JSON dùng Set v3.4, HTTP Request v4.2. Chưa kiểm chứng import trên mọi phiên bản n8n. Nếu import không tương thích, tạo các node thủ công:

| Node | Cấu hình |
| --- | --- |
| 01 - Start Search | Manual Trigger |
| 02 - Research Request ID | Edit Fields, Manual Mapping, field String `requestId`, giá trị UUID thật; Include Other Input Fields = off |
| 03 - Search & Collect | HTTP Request, Method POST, Authentication None, Send Body off; URL expression `{{ 'http://host.docker.internal:3000/api/research/' + encodeURIComponent($json.requestId) + '/search' }}`; Timeout 300000 ms |
| 04 - Search Result | Edit Fields, field Object `searchResult`, value expression `{{ $json.data }}`; Include Other Input Fields = off |

Nối bốn node đúng thứ tự. Để kiểm tra sources, thêm HTTP Request GET tới `http://host.docker.internal:3000/api/research/<requestId>/sources`.

## Nối Workflow 1 → Workflow 2

Trong Workflow 1, nối node **Create Research Plan** trực tiếp vào HTTP Request Search & Collect, bỏ Manual Trigger và node nhập ID của Workflow 2. URL dùng `$json.data.requestId` thay cho `$json.requestId`. Nếu nối sau **Output Research Plan**, dùng `$json.researchPlan.requestId`. Kết quả sources có thể đưa sang Workflow 3 sau này.

Mock tạo nội dung có nhãn MOCK DATA và provider `mock`; đây là dữ liệu thử nghiệm. Khi dùng Tavily thật, cấu hình key ở backend `.env`, không đặt key trong n8n. HTTP node chạy đồng bộ; nếu timeout ở n8n, backend có thể vẫn đang xử lý — dùng GET request/sources để kiểm tra trước khi chạy lại.
