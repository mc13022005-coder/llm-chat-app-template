# Stock API Backend

Backend Python hỗ trợ lấy dữ liệu cổ phiếu Việt Nam từ thư viện `vnstock`.
Được sử dụng như một vệ tinh dữ liệu cho Chatbot phân tích cổ phiếu của bạn.

## Cài đặt

Mở terminal và trỏ vào thư mục `backend`:
```bash
cd backend
```

Cài đặt các thư viện cần thiết:
```bash
pip install -r requirements.txt
```

## Chạy Server

Khởi động server FastAPI:
```bash
uvicorn main:app --reload --port 8000
```

Server sẽ lắng nghe tại `http://localhost:8000`.

## API Endpoints

- `GET /stock/{symbol}/company`: Lấy thông tin tổng quan của một mã cổ phiếu.
  - Ví dụ: `http://localhost:8000/stock/FPT/company`
  - Ví dụ: `http://localhost:8000/stock/VIB/company`
