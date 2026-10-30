# Codex Prompt — Việt hóa Frontend + Bổ sung giao diện Bước 3 và Bước 4

Bạn đang tiếp tục chỉnh sửa frontend hiện tại của project:

```bash
~/projects/AI-Research-Agent
```

## 1. MỤC TIÊU

1. Giữ nguyên frontend hiện tại và architecture đang có.
2. Việt hóa TOÀN BỘ giao diện.
3. Không còn hiển thị các tên chung chung như:
   - Workflow 1
   - Workflow 2
   - Workflow 3
   - Workflow 4
4. Thay bằng tên chức năng rõ ràng, chuyên nghiệp.
5. Bổ sung đầy đủ giao diện cho bước 3 và bước 4.
6. Workflow 3 và 4 hiện chưa có backend thật nên CHỈ xây UI/UX, không fake kết quả.
7. Không thay đổi API của Workflow 1 và Workflow 2.
8. Không phá frontend hiện tại.

---

## 2. TÊN MỚI CHO TOÀN HỆ THỐNG

Sử dụng tên tiếng Việt sau:

```text
Dashboard
→ Tổng quan

Workflow 1
→ Lập kế hoạch nghiên cứu

Workflow 2
→ Tìm kiếm & Thu thập tài liệu

Workflow 3
→ Phân tích bằng chứng & RAG

Workflow 4
→ Tạo báo cáo nghiên cứu

Sources
→ Nguồn tài liệu

Settings
→ Cài đặt
```

Không hiển thị chữ:

```text
Workflow 1
Workflow 2
Workflow 3
Workflow 4
```

trên UI chính.

Có thể giữ khái niệm workflow trong code/internal logic nếu cần.

---

## 3. SIDEBAR MỚI

Sidebar phải hiển thị:

```text
AI Research Agent

Tổng quan

Lập kế hoạch nghiên cứu

Tìm kiếm & Thu thập

Phân tích bằng chứng

Tạo báo cáo

Nguồn tài liệu

Cài đặt
```

Icons:

```text
Tổng quan
→ House

Lập kế hoạch nghiên cứu
→ FileText

Tìm kiếm & Thu thập
→ Search

Phân tích bằng chứng
→ BrainCircuit hoặc Layers

Tạo báo cáo
→ FileOutput hoặc FileBarChart

Nguồn tài liệu
→ Link

Cài đặt
→ Settings
```

Active state:

```text
bg-blue-50
text-blue-600
border-blue-100
```

hoặc style tương thích frontend hiện tại.

---

## 4. BRANDING SIDEBAR

Giữ:

```text
AI Research Agent
```

Subtitle đổi sang tiếng Việt:

```text
Trợ lý nghiên cứu thông minh
```

Bottom card:

```text
Biến ý tưởng
thành tri thức giá trị
```

Subtext:

```text
AI đồng hành cùng hành trình nghiên cứu của bạn.
```

---

## 5. HEADER

Đổi toàn bộ sang tiếng Việt.

Search placeholder:

```text
Tìm kiếm dự án, chủ đề, tài liệu...
```

User demo:

```text
Nguyễn Minh Anh
Sinh viên
```

Các tooltip:

```text
Thông báo
Tìm kiếm
Tài khoản
```

Không còn text tiếng Anh không cần thiết.

---

## 6. ROUTES

Giữ route backend/API.

Frontend route có thể giữ để tránh phá code:

```text
/
```

Tổng quan

```text
/workflow-1
```

Lập kế hoạch nghiên cứu

```text
/research/:requestId
```

Kết quả kế hoạch nghiên cứu

```text
/workflow-2/:requestId
```

Tìm kiếm & Thu thập tài liệu

Thêm:

```text
/workflow-3/:requestId
```

Phân tích bằng chứng & RAG

Thêm:

```text
/workflow-4/:requestId
```

Tạo báo cáo nghiên cứu

Giữ:

```text
/sources
```

Nguồn tài liệu

```text
/sources/:sourceId
```

Chi tiết nguồn

```text
/settings
```

Cài đặt

Không bắt buộc đổi URL route sang tiếng Việt.

Chỉ đổi label/UI.

---

## 7. TRANG TỔNG QUAN

Route:

```text
/
```

Title:

```text
Tổng quan nghiên cứu
```

Subtitle:

```text
Theo dõi tiến độ nghiên cứu, quản lý nguồn tài liệu và các bước xử lý của AI Research Agent.
```

KPI cards:

```text
Kế hoạch đã tạo

Nguồn tài liệu đã thu thập

Bước đã hoàn thành

Nghiên cứu gần nhất
```

Không dùng:

```text
Research Plan
Sources
Workflow Completed
```

---

## 8. TIẾN TRÌNH NGHIÊN CỨU

Dashboard phải có section:

```text
Tiến trình nghiên cứu
```

Hiển thị 4 bước:

```text
1. Lập kế hoạch nghiên cứu

2. Tìm kiếm & Thu thập tài liệu

3. Phân tích bằng chứng & RAG

4. Tạo báo cáo nghiên cứu
```

Status:

```text
Hoàn thành

Đang xử lý

Sẵn sàng

Chưa triển khai
```

Ví dụ:

```text
✓ Lập kế hoạch nghiên cứu
  Hoàn thành

✓ Tìm kiếm & Thu thập tài liệu
  Hoàn thành

○ Phân tích bằng chứng & RAG
  Chưa triển khai

○ Tạo báo cáo nghiên cứu
  Chưa triển khai
```

---

## 9. TRANG LẬP KẾ HOẠCH NGHIÊN CỨU

Route:

```text
/workflow-1
```

Đổi title:

```text
Lập kế hoạch nghiên cứu
```

Subtitle:

```text
Nhập chủ đề, mục tiêu và phạm vi nghiên cứu để AI xây dựng kế hoạch phù hợp.
```

Fields:

```text
Chủ đề nghiên cứu *

Mục tiêu nghiên cứu *

Phạm vi nghiên cứu

Độ dài báo cáo mong muốn
```

Placeholder:

```text
Nhập chủ đề nghiên cứu của bạn...
```

Goal:

```text
Bạn muốn đạt được điều gì thông qua nghiên cứu này?
```

Scope:

```text
Giới hạn về lĩnh vực, thời gian, địa lý hoặc đối tượng nghiên cứu...
```

Output length:

```text
Ngắn
1–2 trang

Trung bình
3–5 trang

Dài
8–10 trang
```

Button:

```text
Tạo kế hoạch nghiên cứu
```

Loading:

```text
AI đang xây dựng kế hoạch nghiên cứu...
```

---

## 10. KẾT QUẢ KẾ HOẠCH NGHIÊN CỨU

Route:

```text
/research/:requestId
```

Title:

```text
Kế hoạch nghiên cứu
```

Badge:

```text
Đã lập kế hoạch
```

Đổi:

```text
Research Questions
```

thành:

```text
Câu hỏi nghiên cứu
```

Đổi:

```text
Search Queries
```

thành:

```text
Truy vấn tìm kiếm
```

Summary:

```text
Mã nghiên cứu

Chủ đề

Mục tiêu

Phạm vi

Độ dài đầu ra
```

Right panel:

```text
Kế hoạch đã hoàn thành
```

Stats:

```text
4 câu hỏi nghiên cứu

4 truy vấn tìm kiếm
```

Next step:

```text
Sẵn sàng tìm kiếm tài liệu
```

Button:

```text
Bắt đầu tìm kiếm & thu thập
```

Loading:

```text
Đang tìm kiếm và thu thập tài liệu...
```

---

## 11. TRANG TÌM KIẾM & THU THẬP

Route:

```text
/workflow-2/:requestId
```

Title:

```text
Tìm kiếm & Thu thập tài liệu
```

Subtitle:

```text
Các nguồn tài liệu liên quan đã được tìm kiếm, chuẩn hóa và lưu trữ phục vụ cho quá trình phân tích.
```

Badge:

```text
Đã thu thập
```

Summary cards:

```text
Mã nghiên cứu

Số truy vấn

Số nguồn tài liệu

Nhà cung cấp tìm kiếm
```

Không dùng:

```text
Request ID
Query Count
Source Count
Provider
```

---

## 12. DANH SÁCH NGUỒN

Đổi headers:

```text
#
Nguồn tài liệu
Nhà cung cấp
Trạng thái
Nội dung xem trước
Thao tác
```

Search:

```text
Tìm kiếm trong các nguồn tài liệu...
```

Filter:

```text
Nhà cung cấp
```

Sort:

```text
Mới nhất

Cũ nhất
```

Buttons:

```text
Xem chi tiết

Mở tài liệu
```

Badge:

```text
Đã thu thập
```

Nếu Tavily:

```text
Tavily
```

Nếu Mock:

```text
Dữ liệu thử nghiệm
```

---

## 13. NÚT CHUYỂN SANG BƯỚC 3

Ở cuối trang Tìm kiếm & Thu thập:

Card:

```text
Sẵn sàng phân tích bằng chứng
```

Description:

```text
Các tài liệu đã được thu thập và sẵn sàng cho bước phân tích bằng chứng và truy xuất thông tin.
```

Button:

```text
Tiếp tục phân tích bằng chứng
```

Hiện tại bước 3 chưa có backend.

Button này chỉ:

```js
navigate(`/workflow-3/${requestId}`)
```

Không gọi API chưa tồn tại.

---

## 14. GIAO DIỆN BƯỚC 3

Route:

```text
/workflow-3/:requestId
```

Tên:

```text
Phân tích bằng chứng & RAG
```

Subtitle:

```text
Phân tích các nguồn tài liệu đã thu thập, xác định bằng chứng quan trọng và chuẩn bị ngữ cảnh cho quá trình tạo báo cáo.
```

Đây là UI chuẩn bị cho bước 3.

KHÔNG triển khai backend.

KHÔNG fake kết quả AI.

---

## 15. LAYOUT TRANG PHÂN TÍCH BẰNG CHỨNG

Top progress:

```text
Lập kế hoạch
✓

Thu thập tài liệu
✓

Phân tích bằng chứng
3

Tạo báo cáo
4
```

Summary cards:

```text
Nguồn đã thu thập

Bằng chứng đã phân tích

Đoạn văn bản đã xử lý

Mức độ sẵn sàng
```

Vì backend chưa có:

```text
Bằng chứng đã phân tích
→ Chưa có dữ liệu

Đoạn văn bản đã xử lý
→ Chưa có dữ liệu

Mức độ sẵn sàng
→ Chưa triển khai
```

Không hiển thị fake number.

---

## 16. PANEL GIẢI THÍCH RAG

Tạo card giải thích:

Title:

```text
Phân tích bằng chứng hoạt động như thế nào?
```

Steps:

```text
1. Chia nhỏ nội dung tài liệu

2. Tạo biểu diễn ngữ nghĩa

3. Truy xuất các đoạn liên quan

4. Đánh giá bằng chứng

5. Chuẩn bị ngữ cảnh cho AI
```

Chỉ là phần giải thích UI.

Không fake rằng các bước đã chạy.

---

## 17. DANH SÁCH TÀI LIỆU TRONG BƯỚC 3

Hiển thị các sources thật đã thu thập từ:

```text
GET /api/research/:id/sources
```

Cards:

```text
Tên tài liệu

URL

Nhà cung cấp

Truy vấn nguồn

Nội dung xem trước
```

Status cho từng source:

```text
Sẵn sàng phân tích
```

Không ghi:

```text
Đã phân tích
```

nếu backend bước 3 chưa tồn tại.

---

## 18. TRẠNG THÁI BƯỚC 3

Hiển thị banner:

```text
Tính năng đang được phát triển
```

Description:

```text
Module phân tích bằng chứng và RAG sẽ được triển khai ở giai đoạn tiếp theo của dự án.
```

Có thể dùng icon:

```text
Construction
BrainCircuit
Sparkles
```

Button:

```text
Tiếp tục xem giao diện tạo báo cáo
```

Navigate:

```text
/workflow-4/:requestId
```

---

## 19. GIAO DIỆN BƯỚC 4

Route:

```text
/workflow-4/:requestId
```

Tên:

```text
Tạo báo cáo nghiên cứu
```

Subtitle:

```text
Tổng hợp kế hoạch, nguồn tài liệu và bằng chứng để tạo báo cáo nghiên cứu hoàn chỉnh.
```

Không triển khai report generation backend.

Chỉ UI.

---

## 20. LAYOUT BƯỚC 4

Top progress:

```text
✓ Lập kế hoạch

✓ Thu thập tài liệu

○ Phân tích bằng chứng

○ Tạo báo cáo
```

Main left:

```text
Cấu hình báo cáo
```

Fields UI only:

```text
Tiêu đề báo cáo

Độ dài báo cáo

Ngôn ngữ

Phong cách trình bày

Định dạng xuất
```

Options:

Độ dài:

```text
Ngắn

Trung bình

Chi tiết
```

Ngôn ngữ:

```text
Tiếng Việt
```

Default.

Phong cách:

```text
Học thuật

Chuyên nghiệp

Tóm tắt
```

Format:

```text
PDF

Word
```

Buttons phải disable nếu backend chưa có.

---

## 21. PREVIEW REPORT UI

Right side:

```text
Xem trước báo cáo
```

Hiển thị skeleton/template:

```text
1. Giới thiệu

2. Tổng quan vấn đề

3. Phân tích tài liệu

4. Kết quả và thảo luận

5. Kết luận

6. Tài liệu tham khảo
```

Đây chỉ là preview cấu trúc.

Không fake report content.

---

## 22. BANNER CHƯA TRIỂN KHAI BƯỚC 4

Banner:

```text
Tạo báo cáo tự động chưa được kích hoạt
```

Description:

```text
Bước tạo báo cáo sẽ được kết nối sau khi module phân tích bằng chứng và RAG hoàn thành.
```

Primary button:

```text
Tạo báo cáo
```

Disabled.

Tooltip:

```text
Cần hoàn thành bước Phân tích bằng chứng & RAG trước.
```

---

## 23. NGUỒN TÀI LIỆU

Route:

```text
/sources
```

Rename title:

```text
Nguồn tài liệu nghiên cứu
```

Subtitle:

```text
Quản lý và xem lại các nguồn tài liệu đã thu thập cho nghiên cứu hiện tại.
```

Empty:

```text
Chưa có nguồn tài liệu
```

Button:

```text
Bắt đầu nghiên cứu
```

---

## 24. CHI TIẾT NGUỒN

Route:

```text
/sources/:sourceId
```

Labels:

```text
Tên tài liệu

Địa chỉ nguồn

Nhà cung cấp

Truy vấn tìm kiếm

Tóm tắt

Nội dung

Thời gian thu thập

Mã nghiên cứu
```

Buttons:

```text
Mở tài liệu gốc

Sao chép liên kết

Sao chép nội dung
```

---

## 25. CÀI ĐẶT

Route:

```text
/settings
```

Title:

```text
Cài đặt hệ thống
```

Sections:

```text
Kết nối Backend

Mô hình AI

Công cụ tìm kiếm

Môi trường
```

Values:

```text
Backend:
http://localhost:3000

Mô hình AI:
Gemini

Công cụ tìm kiếm:
Tavily

Môi trường:
Phát triển
```

Không hiển thị API key.

---

## 26. VIỆT HÓA ERROR MESSAGES

Frontend phải map lỗi thành tiếng Việt.

Ví dụ:

```text
Backend offline
→ Không thể kết nối đến máy chủ.

Research not found
→ Không tìm thấy yêu cầu nghiên cứu.

Gemini failed
→ Không thể tạo kế hoạch nghiên cứu bằng AI.

Gemini rate limit
→ Dịch vụ AI đang quá tải hoặc đã vượt giới hạn sử dụng.

Search failed
→ Không thể tìm kiếm tài liệu.

No sources
→ Chưa tìm thấy nguồn tài liệu phù hợp.

Timeout
→ Yêu cầu mất quá nhiều thời gian. Vui lòng thử lại.
```

---

## 27. VIỆT HÓA LOADING

```text
Loading...
→ Đang tải...

Creating plan...
→ Đang tạo kế hoạch nghiên cứu...

Searching...
→ Đang tìm kiếm tài liệu...

Loading sources...
→ Đang tải nguồn tài liệu...

Processing...
→ Đang xử lý...
```

---

## 28. VIỆT HÓA STATUS

Map status backend:

```text
planning
→ Đang lập kế hoạch

planned
→ Đã lập kế hoạch

searching
→ Đang tìm kiếm

collected
→ Đã thu thập

failed
→ Thất bại
```

Future UI status:

```text
pending
→ Chưa thực hiện

ready
→ Sẵn sàng

processing
→ Đang xử lý

completed
→ Hoàn thành
```

---

## 29. COMPONENT TIẾN TRÌNH

Tạo reusable component:

```text
ResearchProgress.jsx
```

Hoặc giữ tên hiện tại nếu có.

Hiển thị 4 bước:

```text
1
Lập kế hoạch

2
Thu thập tài liệu

3
Phân tích bằng chứng

4
Tạo báo cáo
```

States:

```text
completed

active

available

locked
```

Sử dụng component này trên:

```text
Dashboard

Research Plan Result

Search & Collect Result

Evidence & RAG page

Report Generation page
```

---

## 30. SIDEBAR NAVIGATION CUỐI

```text
AI Research Agent
Trợ lý nghiên cứu thông minh

Tổng quan

Lập kế hoạch nghiên cứu

Tìm kiếm & Thu thập

Phân tích bằng chứng

Tạo báo cáo

Nguồn tài liệu

Cài đặt
```

---

## 31. FRONTEND FINAL FLOW

User flow cuối cùng phải nhìn như:

```text
Tổng quan
    ↓
Lập kế hoạch nghiên cứu
    ↓
Kế hoạch nghiên cứu
    ↓
Tìm kiếm & Thu thập tài liệu
    ↓
Nguồn tài liệu thật
    ↓
Phân tích bằng chứng & RAG
    ↓
Tạo báo cáo nghiên cứu
```

Backend thật hiện tại chỉ chạy:

```text
Lập kế hoạch nghiên cứu
        +
Tìm kiếm & Thu thập tài liệu
```

Các bước:

```text
Phân tích bằng chứng & RAG

Tạo báo cáo nghiên cứu
```

chỉ xây giao diện chuẩn bị.

Không fake AI processing.

---

## 32. KHÔNG THAY BACKEND

Không thay đổi:

```text
POST /api/research

GET /api/research/:id

POST /api/research/:id/search

GET /api/research/:id/sources
```

Không implement API bước 3/4 trong task này.

Không sửa database schema cho bước 3/4.

---

## 33. KHÔNG PHÁ CODE HIỆN TẠI

Trước khi sửa:

```bash
cd ~/projects/AI-Research-Agent
git status
```

Rà soát frontend hiện tại.

Reuse components.

Không rewrite toàn project nếu không cần.

---

## 34. BUILD

Sau chỉnh sửa:

```bash
cd ~/projects/AI-Research-Agent/frontend

npm install
npm run build
```

Build phải PASS.

Nếu có lint:

```bash
npm run lint
```

cũng phải PASS nếu script tồn tại.

---

## 35. BACKEND REGRESSION TEST

```bash
cd ~/projects/AI-Research-Agent/backend

npm test
```

Không được làm backend test cũ fail.

---

## 36. TEST UI FLOW

Test:

```text
/
```

→ Tổng quan

```text
/workflow-1
```

→ Lập kế hoạch nghiên cứu

Submit real API.

```text
/research/:id
```

→ Kế hoạch nghiên cứu

Click:

```text
Bắt đầu tìm kiếm & thu thập
```

```text
/workflow-2/:id
```

→ nguồn thật

Click:

```text
Tiếp tục phân tích bằng chứng
```

```text
/workflow-3/:id
```

→ UI bước 3

Click:

```text
Xem giao diện tạo báo cáo
```

```text
/workflow-4/:id
```

→ UI bước 4

---

## 37. BÁO CÁO CUỐI

Sau khi hoàn thành, báo:

1. Các text tiếng Anh đã được đổi sang tiếng Việt.
2. Sidebar mới.
3. Dashboard mới.
4. Trang Lập kế hoạch nghiên cứu.
5. Trang Kế hoạch nghiên cứu.
6. Trang Tìm kiếm & Thu thập.
7. Trang Phân tích bằng chứng & RAG.
8. Trang Tạo báo cáo nghiên cứu.
9. Trang Nguồn tài liệu.
10. Trang Cài đặt.
11. Các route mới.
12. Component progress mới.
13. Loading state tiếng Việt.
14. Error state tiếng Việt.
15. Status mapping tiếng Việt.
16. File mới.
17. File đã sửa.
18. `npm run build` result.
19. `npm test` backend result.
20. Git status cuối.

---

## 38. NGUYÊN TẮC CUỐI

Frontend phải nhìn giống một sản phẩm nghiên cứu AI hoàn chỉnh.

Không dùng các label kỹ thuật như:

```text
Workflow 1
Workflow 2
Workflow 3
Workflow 4
```

trên giao diện chính.

Thay bằng:

```text
Lập kế hoạch nghiên cứu

Tìm kiếm & Thu thập tài liệu

Phân tích bằng chứng & RAG

Tạo báo cáo nghiên cứu
```

Toàn bộ UI chính sử dụng tiếng Việt.

Không fake dữ liệu của bước 3 và 4.

Không phá API thật của bước 1 và 2.

Không over-engineer.

Ưu tiên:

- dễ nhìn
- dễ demo
- chuyên nghiệp
- thống nhất tiếng Việt
- thể hiện đầy đủ kiến trúc 4 bước của AI Research Agent.
