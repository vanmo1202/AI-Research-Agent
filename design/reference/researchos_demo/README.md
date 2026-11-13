# ResearchOS — Interactive UI Demo

Bản dựng frontend tham khảo theo ảnh người dùng cung cấp, chạy offline với HTML, CSS, JavaScript thuần.

## Mở demo

- Cách nhanh nhất: mở file `ResearchOS_Interactive_Demo.html` đã đóng gói tài nguyên.
- Bản mã nguồn: mở `index.html` cùng các ảnh `.webp` trong cùng thư mục.

## Các màn hình và thao tác

- Dashboard với 5 nhóm chức năng, nghiên cứu gần đây, hoạt động và truy cập nhanh.
- Tạo nghiên cứu, theo dõi tiến độ, duyệt bước; tạo và xuất báo cáo `.md` minh họa.
- Chọn PDF từ thiết bị: chỉ lưu metadata trong localStorage, không đọc PDF hoặc gửi lên server.
- Chat tài liệu với phản hồi giả lập, ghi rõ citation là minh họa.
- Memory: thêm ghi nhớ, duyệt, hủy duyệt, loại bỏ.
- n8n: tạo lịch giả lập, bật/tắt và chạy thử giả lập.
- Tìm kiếm toàn cục `Ctrl+K`, tạo nghiên cứu `Ctrl+N`, điều hướng trên desktop/mobile.

Dữ liệu mẫu và thao tác được lưu trong localStorage. Có thể đặt lại từ phần Cài đặt.

## Tích hợp dự án thật

Chưa kết nối Express/SQLite/PostgreSQL, RAG/AI, hay webhook n8n. Các giao diện và hành động này cần được nối với API thực trong dự án AI-Research-Agent sau khi đối chiếu route, DTO, quyền đăng nhập và workflow hiện hành.
