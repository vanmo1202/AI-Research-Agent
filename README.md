# AI Research Agent

AI Research Agent là dự án nghiên cứu có điều phối bằng AI. Người dùng gửi yêu cầu qua n8n; backend lập kế hoạch gồm các câu hỏi nghiên cứu và search query, sau đó lưu kế hoạch vào SQLite.

## Mục tiêu dự án

Xây dựng từng bước một research agent có thể nhận yêu cầu, lập kế hoạch, tìm nguồn, tổng hợp và tạo báo cáo. Phiên bản hiện tại hoàn thành Workflow 1 - Research Request & Planning và Workflow 2 - Search & Collect. RAG và Agent Loop chưa được triển khai.

## Technology stack

- Node.js, Express.js và CommonJS
- dotenv và nodemon
- SQLite, không dùng ORM
- n8n chạy bằng Docker
- OpenAI Chat Completions hoặc `MOCK_LLM=true` để phát triển không cần API credit
- Git/GitHub

## Kiến trúc hiện tại

```text
User → n8n → POST /api/research → Validation → Research Planner
     → Research Questions → Search Queries → SQLite → Response
```

Backend tạo UUID và lưu request với trạng thái `planning` trước khi gọi planner. Planner tạo 3–5 câu hỏi, mỗi câu hỏi có ít nhất một query. Sau khi lưu plan, trạng thái thành `planned` và trả HTTP 201. Nếu planner hoặc bước lưu plan lỗi, trạng thái thành `failed` và API trả lỗi cùng `requestId`.

## Cấu trúc thư mục

```text
backend/
├── src/
│   ├── config/database.js
│   ├── routes/research.routes.js
│   ├── controllers/research.controller.js
│   ├── services/research.service.js
│   ├── services/llm.service.js
│   ├── models/request.model.js
│   ├── models/plan.model.js
│   ├── middlewares/validateResearch.js
│   └── utils/logger.js
├── data/research.db
├── test/workflow1.test.js
├── .env.example
└── package.json
n8n/
├── docker-compose.yml
└── workflows/
    ├── workflow-1-research-planning.json
    └── WORKFLOW1_SETUP.md
```

## Workflow 1 - Research Request & Planning

### Cài đặt và chạy backend

Yêu cầu Node.js 22 trở lên vì backend sử dụng `fetch` và `AbortSignal.timeout`.

```bash
cd ~/projects/AI-Research-Agent/backend
npm install
cp .env.example .env # chỉ cần làm một lần nếu chưa có .env
npm run dev
```

Database tự tạo tại `backend/data/research.db` khi backend khởi động. Database và `.env` được bỏ qua trong Git.

Mặc định `.env` dùng `MOCK_LLM=true`. Mock không gọi OpenAI, không cần API key và tạo kế hoạch mẫu dựa trên input. Để gọi LLM thật, đặt `MOCK_LLM=false`, `OPENAI_API_KEY` và `OPENAI_MODEL` trong `.env`, rồi restart backend. Không đưa key vào workflow n8n.

### API kiểm tra

Health check:

```bash
curl http://localhost:3000/health
```

Tạo research plan:

```bash
curl -i -X POST http://localhost:3000/api/research \
-H "Content-Type: application/json" \
-d '{
  "topic": "Ứng dụng AI trong quản lý tồn kho siêu thị",
  "goal": "Tìm hiểu ứng dụng, dữ liệu cần có, lợi ích và hạn chế",
  "scope": "Tài liệu web công khai",
  "outputLength": "medium"
}'
```

Lấy lại plan đã lưu, thay UUID bằng `data.requestId` từ response POST:

```bash
curl http://localhost:3000/api/research/UUID
```

POST thành công trả `success`, `requestId`, `topic`, `status`, `researchQuestions` và `searchQueries`. GET trả request cùng research questions và search queries. UUID không tồn tại trả HTTP 404 với `Research request not found`. Input sai hoặc JSON sai trả HTTP 400.

### SQLite

Bảng `requests` lưu topic, goal, scope, output length, status và timestamps. Bảng `plans` lưu từng search query cùng research question tương ứng. SQL dùng parameter binding; không cần migration hoặc ORM. Restart backend vẫn giữ dữ liệu.

### Test

```bash
cd ~/projects/AI-Research-Agent/backend
npm test
```

Test dùng database tạm và port ngẫu nhiên. Bộ test kiểm tra `/health`, validation, mock không gọi OpenAI, POST 201, GET plan, 404, JSON lỗi, lỗi planner và persistence qua restart process. Nhánh OpenAI được kiểm tra bằng fetch giả lập.

### n8n

Import [workflow JSON](n8n/workflows/workflow-1-research-planning.json), sau đó Execute Workflow. Workflow gồm:

```text
Manual Trigger → Research Input → Create Research Plan → Output Research Plan
```

HTTP node gửi JSON đến `http://host.docker.internal:3000/api/research` và chờ kết quả. Nếu phiên bản n8n không nhận file import, làm theo [hướng dẫn từng node](n8n/workflows/WORKFLOW1_SETUP.md). Compose đã cấu hình `host.docker.internal` để container n8n gọi backend trên host.

## Workflow 2 - Search & Collect

Research Plan → Search Queries → Tavily / Mock Search → Normalize → Deduplicate → Fetch Content → SQLite Sources

### Cấu hình

Thêm vào `backend/.env` nếu chưa có (file mẫu đã có đầy đủ):

```dotenv
TAVILY_API_KEY=your_tavily_api_key_here
SEARCH_PROVIDER=tavily
MOCK_SEARCH=true
SEARCH_CONCURRENCY=2
MAX_SOURCE_CONTENT_CHARS=20000
```

`MOCK_SEARCH=true` mặc định và không gọi Tavily hoặc fetch trang web: mỗi query sinh hai nguồn `example.com` với title, snippet, content dựa trên query và provider `mock`. Nội dung có nhãn MOCK DATA, không phải evidence thật. Không cần API key để test.

Để dùng thật, đặt `MOCK_SEARCH=false` và cấu hình `TAVILY_API_KEY` trong `.env`, rồi restart backend. Provider hiện hỗ trợ Tavily; các provider khác có thể thêm qua `search.service.js`. Tavily dùng fetch, POST `/search`, `query`, `max_results=5`, `include_raw_content=text`, timeout 30 giây. `content` của Tavily được dùng làm snippet; `raw_content` được ưu tiên làm nội dung trang. Xem [Tavily Search API](https://docs.tavily.com/documentation/api-reference/endpoint/search).

### API và curl

Chạy backend với `npm run dev`. Tạo request bằng POST Workflow 1 trước, rồi dùng UUID trả về:

```bash
# Thay giá trị này bằng data.requestId từ POST /api/research:
REQUEST_ID="YOUR_REQUEST_ID"

curl -i -X POST "http://localhost:3000/api/research/$REQUEST_ID/search"
curl "http://localhost:3000/api/research/$REQUEST_ID/sources"
curl "http://localhost:3000/api/research/$REQUEST_ID"
```

POST search trả HTTP 200 với `{success:true,data:{requestId,status:"collected",queryCount,sourceCount,sources}}`. Mỗi source có id, query, title, url, normalizedUrl, snippet, content, provider, collectedAt. GET sources trả `{success:true,data:{requestId,sourceCount,sources}}`; khi chưa có nguồn trả 200 với mảng rỗng. Request không tồn tại trả 404. Plan không có query trả 400. GET research phản ánh status `searching`, `collected` hoặc `failed`.

### Chuẩn hóa, nội dung và persistence

URL chỉ chấp nhận HTTP/HTTPS, loại hash, dấu slash cuối path, các `utm_*`, `fbclid`, `gclid`; hostname lowercase và giữ query parameter có ý nghĩa. Dedup theo normalizedUrl; ưu tiên content dài hơn, nếu bằng nhau giữ nguồn đầu tiên. Invalid URL bị bỏ và log warning. Một source trùng giữa nhiều query chỉ giữ query của nguồn được chọn.

Content có sẵn được làm sạch và truncate. Nếu chưa có content, backend tải trang với User-Agent rõ ràng, timeout 15 giây, tối đa ba redirect và HTML 2 MB. Cheerio bỏ script/style/tags và normalize whitespace; text lưu tối đa `MAX_SOURCE_CONTENT_CHARS`. Fetch lỗi giữ nguồn với content rỗng. HTML/text được hỗ trợ; PDF và trang cần JavaScript chưa được trích xuất ở phiên bản này. Địa chỉ nội bộ/loopback bị chặn khi kiểm tra URL và redirect.

Bảng `sources`: `id TEXT PRIMARY KEY`, `request_id` foreign key tới requests, `query`, `title`, `url`, `normalized_url`, `snippet`, `content`, `provider`, `collected_at`; UNIQUE `(request_id, normalized_url)`. Khởi tạo tự động, không xóa dữ liệu Workflow 1. Lưu nhiều nguồn và status collected trong một transaction. Chạy lại cập nhật nguồn cùng URL, giữ id và các nguồn cũ; `sourceCount` là tổng nguồn đã lưu của request. Nếu lần chạy lại thất bại, dữ liệu nguồn trước đó vẫn còn.

### Concurrency và lỗi

Search và content collection dùng tối đa `SEARCH_CONCURRENCY` worker (mặc định 2, cho phép 1–10). Hai lần search đồng thời cho cùng request trong một backend trả 409. Thiết kế hiện dành cho một process backend, chưa có queue phân tán. Sau restart có thể chạy lại request còn status searching.

Một query thất bại được log warning và các query khác vẫn tiếp tục. Nếu tất cả query thất bại hoặc không có nguồn hợp lệ, status failed và HTTP 502. Database/configuration lỗi cũng trả 502; fetch nội dung lỗi riêng không làm fail toàn workflow. Không log key hoặc phản hồi lỗi thô chứa secret.

### n8n và test

Import [Workflow 2 JSON](n8n/workflows/workflow-2-search-collect.json), điền requestId ở node 02, Execute Workflow. [Hướng dẫn từng node và cách nối Workflow 1 → 2](n8n/workflows/WORKFLOW2_SETUP.md).

Chạy `cd backend && npm test`. Test Workflow 2 kiểm tra API, mock không gọi mạng, dedup, invalid URL, partial/all failures, concurrency, 409, content cleaning, truncation, transaction rollback và persistence từ process khác. Tavily được kiểm tra bằng fetch giả lập, không dùng credit thật. Test Workflow 1 vẫn được giữ.

## Frontend

Frontend trong `frontend/` sử dụng React, Vite, JavaScript, Tailwind CSS, React Router, Lucide React và native fetch. Inter được đóng gói cục bộ nên không cần Google Fonts. Giao diện dashboard sáng với sidebar, form chính, panel tiến trình, responsive cho desktop/tablet/mobile.

### Chạy ứng dụng

Yêu cầu Node.js 22.12 trở lên (Node.js 24 hiện tại dùng được). Mở hai terminal từ project root:

```bash
# Terminal 1 — backend
cd backend
npm install
npm run dev

# Terminal 2 — frontend
cd frontend
npm install
# Chỉ khi chưa có .env: cp .env.example .env
npm run dev
```

Frontend: http://localhost:5173 — Backend: http://localhost:3000.

`frontend/.env.example` có `VITE_API_BASE_URL=http://localhost:3000`. Chỉ đặt cấu hình public trong biến `VITE_*`; không đặt API keys ở frontend. Nếu thay URL, restart Vite. Backend cho phép CORS origin `http://localhost:5173`; khi đổi domain/port frontend, cấu hình `FRONTEND_ORIGIN` trong `backend/.env` rồi restart backend. `npm run preview` dùng port 5173, nên cần dừng dev server trước khi preview. Khi deploy lên host tĩnh, cấu hình SPA fallback tới `index.html` để refresh route hoạt động.

### Trang và chức năng

| Route | Chức năng |
| --- | --- |
| `/` | Dashboard, thống kê và nghiên cứu gần đây từ metadata localStorage |
| `/workflow-1` | Form topic, goal, scope, outputLength; gửi POST `/api/research` |
| `/research/:requestId` | Đọc GET `/api/research/:id`, hiển thị request, questions và queries; copy nội dung; bắt đầu Search & Collect |
| `/workflow-2` | Chọn Research Plan hoặc nhập Request ID |
| `/workflow-2/:requestId` | Kết quả Search & Collect của request |
| `/research/:requestId/sources` | Đọc GET research và GET sources từ SQLite, hiển thị/filter/sort nguồn |
| `/sources` | Chọn nghiên cứu trong trình duyệt hoặc nhập ID từ n8n |
| `/settings` | Hồ sơ demo, API URL và kiểm tra kết nối `/health` |

Workflow 1: nhập form → POST `/api/research` → lưu requestId gần nhất → chuyển tới trang plan → GET research. POST response không có goal/scope nên trang plan dùng GET để lấy request đầy đủ. `outputLength` mặc định medium; số trang trên thẻ chọn là gợi ý cho báo cáo tương lai.

Workflow 2: click **Bắt đầu Search & Collect** → POST `/api/research/:id/search` → chuyển tới `/research/:id/sources` → GET research và GET sources. Refresh luôn đọc lại backend, không dùng source count/questions/sources giả. Provider badge lấy từ response, hỗ trợ Mock, Tavily và tên provider khác. Có tìm kiếm nội dung, lọc provider/trạng thái, sắp xếp, xem chi tiết và mở URL HTTP/HTTPS an toàn trong tab mới.

Nếu backend còn `planning`/`searching`, trang tự đọc lại GET mỗi 3 giây; refresh không tự gửi lại POST. Form/search có khóa chống gửi lặp, spinner, lỗi từ backend, lỗi kết nối, nút thử lại và empty state. Workflow 3 chỉ hiển thị Chưa triển khai.

LocalStorage: `aiResearch:lastRequestId`, `aiResearch:lastResearch`, `aiResearch:history` (tối đa 20 metadata nghiên cứu). Dashboard phản ánh lịch sử đã mở trong trình duyệt, không phải tổng server. Khi storage bị chặn, API và trang kết quả theo URL vẫn hoạt động. Hồ sơ Nguyễn Minh Anh là demo, chưa có auth.

Cấu trúc: `src/components/layout/`, `src/components/ui/`, `src/components/research/`, `src/pages/`, `src/hooks/`, `src/services/researchApi.js`, `src/config/api.js`, `src/utils/`. Backend chỉ thêm CORS, giữ nguyên business logic của Workflow 1/2.

### Kiểm tra frontend

```bash
cd backend
npm test
cd ../frontend
npm run build
npm run test:e2e
```

Browser tests dùng Playwright và Google Chrome cài sẵn. Nếu dùng Chromium riêng, đặt `PLAYWRIGHT_CHROME_PATH=/duong/dan/chromium` khi chạy test. Test tự mở frontend port 4173, backend port 4300, database tạm và bật cả hai chế độ mock; không ảnh hưởng database runtime hoặc gọi OpenAI/Tavily thật. Hai port test phải đang trống.

Test kiểm tra tạo plan bằng form, nội dung đúng response, POST search, refresh sources từ SQLite, lịch sử, filter, validation, network/HTTP errors, empty state, CORS, mobile drawer và overflow. File build, test artifacts, `.env`, database và node_modules được .gitignore loại bỏ.

Kiểm tra thủ công: mở `/workflow-1`, nhập chủ đề AI trong giáo dục đại học, mục tiêu và phạm vi; tạo plan → kiểm tra questions/queries → bắt đầu Search & Collect → xem sources → refresh trang, nguồn vẫn đọc từ SQLite. Mở Settings → Kiểm tra kết nối để xác nhận `/health`.

Tham khảo cấu hình: [Vite](https://vite.dev/guide/), [Tailwind với Vite](https://tailwindcss.com/docs/installation/using-vite), [React Router](https://reactrouter.com/start/declarative/installation).

## Tiến độ Week 1

- Node.js backend
- Express server
- GET `/health`
- dotenv
- nodemon
- Git/GitHub
- n8n với Docker
- n8n kết nối thành công tới Node.js
- Workflow 1 Research Request & Planning hoàn thành
- SQLite persistence và API GET research plan hoàn thành

## Các bước phát triển tiếp theo

1. Workflow 3: trích xuất, kiểm tra và tổng hợp bằng citation từ sources đã lưu.
2. RAG cho truy vấn trên các tài liệu đã thu thập.
3. Agent Loop, retry và theo dõi toàn bộ tiến trình nghiên cứu.

Nếu backend bị dừng giữa planning, request có thể còn trạng thái `planning`; phiên bản đầu chưa có cơ chế tự chạy lại.
