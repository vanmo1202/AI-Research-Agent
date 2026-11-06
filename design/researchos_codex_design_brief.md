# ResearchOS — Editorial Research Studio

## Handoff cho Codex — giao diện React/Vite thật

**Repository:** `vanmo1202/AI-Research-Agent`, nhánh hiện hành `feat/user-session-auth` (nếu bạn đã ở nhánh khác, kiểm tra Git trước khi sửa).  
**Tài liệu mẫu:** `researchos_editorial_prototype.html` đi kèm là một prototype độc lập, không kết nối API, có dữ liệu minh họa. **Không được nhúng nguyên prototype bằng iframe**, không sao chép logic demo vào ứng dụng production.

### Ý đồ sáng tạo

Thiết kế ResearchOS như một **Editorial Research Studio** — sản phẩm nghiên cứu trí tuệ, cảm hứng từ thư viện, tạp chí nghiên cứu, giấy và mực. Ấn tượng ngay từ lần mở đầu, nhưng không được hi sinh khả năng đọc và thao tác. Không có màu tím/lavender/magenta, neon AI gradients, blur khắp nơi, icon robot/chatbot đại trà, hình 3D làm nhiễu nội dung.

**Palette cố định:**

| Token | HEX | Vai trò |
| --- | --- | --- |
| `--canvas` | `#F7F6F2` | nền ứng dụng, không phải trắng gắt |
| `--paper` | `#FFFEFA` | thẻ, ô nhập, nội dung |
| `--forest-900` | `#103027` | sidebar, điều hướng |
| `--forest-800` | `#173B32` | hero, thành phần nhấn mạnh |
| `--ink` | `#202E29` | nội dung chữ |
| `--terracotta` | `#CC6545` | CTA chính, mục quan trọng |
| `--sage` | `#E6EEE6` | background phụ, badges |
| `--border` | `#E8E8E2` | đường phân cách |
| `--secondary` | `#748078` | chú thích, metadata |
| `--teal` | `#477E86` | dữ liệu khoa học / nguồn tham khảo |

**Typography:** tiêu đề editorial serif (ưu tiên `Newsreader`, fallback `Georgia` / `Noto Serif`), body sans (ưu tiên `DM Sans`, fallback `Inter` / `Lato`). Không phải font chữ nhỏ như screenshot prototype nếu đưa vào app thật: body >=14px desktop; text hỗ trợ >=12px; đảm bảo WCAG AA. H1 40–60px desktop / 34–40px mobile. Dùng tối đa 2 font. Giãn dòng 1.55–1.8. Không lạm dụng uppercase.

**Hình khối:** radius card 12–16px, radius nút 8–10px; border `1px` ấm, bóng rất nhẹ; spacing scale 4/8/12/16/24/32/48; chuyển động 160–240ms với `prefers-reduced-motion`. Ưu tiên tính đọc, nhịp trắng, microinteraction chính xác.

### Thiết kế theo trang

1. **Shell + Navigation:** sidebar xanh rừng rộng ~250px, logo ResearchOS, điều hướng nhóm Tổng quan / Nghiên cứu / Knowledge / Lab / Cấu hình. Active item thanh accent cam đất. Header trắng giấy hơi trong, breadcrumb rõ ràng, command search `Ctrl/Cmd+K`, menu tài khoản thật từ `AuthProvider`, mobile drawer + backdrop + Escape.
2. **Dashboard:** heading serif độc đáo; hero xanh rừng minh họa quỹ đạo trừu tượng bằng SVG/CSS (không phải robot), CTA cam đất. 4 metric cards **lấy từ API/history thật**, hiển thị loading/empty/error, tuyệt đối không dùng dữ liệu 12/148/36/24 trong prototype. Danh sách nghiên cứu gần đây, lộ trình 4 bước, dữ liệu trạng thái thực, cánh cửa trực tiếp vào nghiên cứu đang làm.
3. **Research Workflow:** form tạo research topic/goal/scope, step progress, planning, collecting, source results, evidence, report; trạng thái pending/running/failed/partial/success; khả năng quay lại; bảo toàn mọi API và workflow thực tế.
4. **Document Library / Detail:** vùng upload đẹp, bộ lọc, tìm kiếm, thẻ tài liệu, ngày upload, số trang, trạng thái ingestion, lỗi và retry; trang chi tiết + viewer PDF thực tế (blob/cookie) + citations.
5. **AI Chat:** nhịp đọc như sách, vùng conversation thoáng, từng câu trả lời có citation cards truy xuất được; input luôn khả dụng; giữ session/auth và cancel; không cho mẫu trả lời giả khi backend chưa trả dữ liệu.
6. **Evidence:** trích đoạn nổi bật bằng serif, nguồn, độ tin cậy có giải thích, góc nhìn khác, trạng thái verification; tránh dùng % độ tin cậy bịa đặt.
7. **Report:** bố cục như trang tài liệu học thuật, mục lục, citations, export PDF/DOCX vẫn hoạt động; có số liệu thật và fallback nếu chưa có báo cáo.
8. **Agent Memory:** verified/candidate/stale status, review actions rõ ràng; thao tác không ngầm tự xác minh nội dung.
9. **Auth + Settings:** login/register đồng bộ phong cách editorial; giữ mật khẩu >=6 ký tự nếu chính sách đã được user yêu cầu cập nhật, vẫn scrypt, session, CSRF; settings lấy profile thật, không hiện “demo”.

### Quy tắc kỹ thuật bắt buộc

- **Không thay React 19 + Vite + React Router**, không thay backend Express, SQLite, worker, n8n.
- **Không sửa logic nghiệp vụ, API contracts, auth/session, migrations, database hoặc Docker** chỉ để đổi UI.
- Bảo toàn đường dẫn: `/`, `/login`, `/register`, `/workflow-1`, `/workflow-2`, `/workflow-3`, `/workflow-4`, `/research/:requestId`, `/documents`, `/documents/:id`, `/chat`, `/memories`, `/sources`, `/settings` và các deep links.
- Refactor CSS thành tokens chung trong `frontend/src/styles/`; tránh chồng nhiều selector specificity; tạo component dùng lại cho Card, EmptyState, SectionHeading, MetricCard, PageHeader, StatusBadge, Skeleton...
- Thay các màu tím/gradient tím/blue-violet cũ trong tất cả trang, kể cả hover, focus, status, charts và Auth.
- Không dùng số liệu hoặc chatbot reply giả trong bản production. Có skeleton/empty/error states. Không tạo nút trông có thể click nhưng không làm gì.
- Duy trì `credentials: 'include'`, ownership, export, upload PDF, pagination và polling; không ghi đè thay đổi local chưa commit.
- Các kích thước cần xác minh: **375, 390, 768, 1024, 1440px**, hỗ trợ keyboard, focus visible, contrast WCAG AA, touch targets >=44px cho thao tác chính, không có horizontal overflow.
- Chỉ dùng CSS/SVG/Tailwind hiện có, tránh thêm thư viện animation/dashboard nặng nếu không cần.

### Quy trình Codex

1. Đọc `frontend/src/App.jsx`, `frontend/src/components/layout/{Sidebar,Header,AppLayout}.jsx`, CSS hiện tại, `frontend/src/pages/`, `frontend/src/auth/` và services liên quan. Kiểm tra `git status` trước.
2. Xem prototype HTML và tái hiện **ngôn ngữ thị giác**, không copy hardcoded data/demo event handlers.
3. Làm lần lượt: **(A)** tokens + shell + Dashboard; **(B)** auth + research flow; **(C)** library/PDF/chat; **(D)** evidence/report/memory/settings; kiểm tra sau mỗi nhóm.
4. Mỗi khi sửa một trang, giữ nguyên API binding và business behavior, bổ sung empty/loading/error states, cleanup effect và keyboard semantics.
5. Chạy `npm --prefix frontend run build`, `npm --prefix frontend run test:e2e`; chạy `npm --prefix backend test` nếu điều chỉnh code liên quan đến Auth/API (bình thường không cần sửa backend). Test khó chạy vì môi trường thì báo cụ thể, không được giả nhận pass.
6. Báo cáo file sửa, pages hoàn thành, chức năng giữ nguyên, test results, vấn đề còn lại. **Không tự commit, push, merge, deploy hay reset dữ liệu**.

### Tiêu chí nghiệm thu

- Cảm nhận: cao cấp, nghiên cứu, nguyên bản; **0 màu tím** trong toàn UI.
- Tính nhất quán: sidebar/header/cards/CTA/forms/dialog/charts cùng bộ design tokens.
- Tính năng: login/register/logout, research, documents, RAG chat, memory, evidence, report/export vận hành như trước, không dùng dữ liệu giả.
- Responsive: không ngang tràn ở mobile, drawer/focus/keyboard chuẩn.
- Không có regression đáng kể trong build/E2E; nếu có phải báo và sửa.
