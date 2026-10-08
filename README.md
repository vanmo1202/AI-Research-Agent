# AI Research Agent

AI Research Agent là dự án nghiên cứu có điều phối bằng AI. Người dùng gửi yêu cầu qua n8n; backend lập kế hoạch gồm các câu hỏi nghiên cứu và search query, sau đó lưu kế hoạch vào SQLite.

## Mục tiêu dự án

Xây dựng từng bước một research agent có thể nhận yêu cầu, lập kế hoạch, tìm nguồn, tổng hợp và tạo báo cáo. Phiên bản hiện tại hoàn thành Workflow 1 - Research Request & Planning. Tavily, RAG và Agent Loop chưa được triển khai.

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

1. Workflow 2: tìm kiếm và thu thập nguồn từ các search query.
2. Lưu metadata, nội dung và trạng thái từng nguồn.
3. Workflow 3: trích xuất, kiểm tra và tổng hợp bằng citation.
4. RAG cho truy vấn trên các tài liệu đã thu thập.
5. Agent Loop, retry và theo dõi toàn bộ tiến trình nghiên cứu.

Nếu backend bị dừng giữa planning, request có thể còn trạng thái `planning`; phiên bản đầu chưa có cơ chế tự chạy lại.
