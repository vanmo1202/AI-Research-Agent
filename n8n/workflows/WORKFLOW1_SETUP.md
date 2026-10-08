# Thiết lập Workflow 1

Backend phải chạy với `MOCK_LLM=true`. Mở http://localhost:5678, chọn **Import from File** và chọn `workflow-1-research-planning.json`, rồi **Execute Workflow**.

JSON dùng Set v3.4 và HTTP Request v4.2. Compose hiện dùng image `latest`; chưa kiểm chứng import trên instance Docker hiện tại. Nếu phiên bản của bạn không nhận JSON, tạo các node sau bằng giao diện.

1. **Manual Trigger**: không cần field; chạy khi chọn Execute Workflow.
2. **Edit Fields (Set)**, tên `Research Input`: Mode = Manual Mapping; tạo bốn field kiểu String:
   - `topic`: `Ứng dụng AI trong quản lý tồn kho siêu thị`
   - `goal`: `Tìm hiểu ứng dụng, dữ liệu cần có, lợi ích và hạn chế`
   - `scope`: `Tài liệu web công khai`
   - `outputLength`: `medium`
   - Include Other Input Fields = off (phiên bản cũ: Keep Only Set = on).
3. **HTTP Request**, tên `Create Research Plan`:
   - Method = POST; Authentication = None.
   - URL = `http://host.docker.internal:3000/api/research`.
   - Send Body = on; Body Content Type = JSON; Specify Body = Using JSON.
   - JSON chuyển sang Expression: `{{ JSON.stringify($json) }}` (trong file export có tiền tố `=`).
   - Content-Type được node tự đặt là `application/json` khi chọn JSON.
   - Options → Timeout = `90000` ms; Response Format = JSON nếu phiên bản có field này.
   - Giữ mặc định báo lỗi khi HTTP không thành công.
4. **Edit Fields (Set)**, tên `Output Research Plan`:
   - Mode = Manual Mapping; field `researchPlan`, kiểu Object.
   - Value chuyển sang Expression: `{{ $json.data }}`.
   - Include Other Input Fields = off.

Nối đúng thứ tự bốn node. Kết quả node HTTP gồm `success` và `data`; node Output hiển thị `requestId`, `topic`, `status`, `researchQuestions`, `searchQueries`.

Backend xử lý đồng bộ nên HTTP Request chờ plan hoàn thành. Khi cần xem lại, dùng GET `http://host.docker.internal:3000/api/research/<requestId>`.

Compose đã có `extra_hosts: host.docker.internal:host-gateway`; giữ cấu hình này. Nếu không kết nối được, kiểm tra backend chạy ở port 3000 và thử node HTTP GET `/health` trước.

Tài liệu node: https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-base.httprequest/
