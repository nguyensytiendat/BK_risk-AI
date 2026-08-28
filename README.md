# EcoRisk AI

Ứng dụng React + Vite + Tailwind CSS đánh giá nhanh nguy cơ sạt lở từ dữ liệu địa hình.

## Chạy local

```bash
npm install
npm run dev
```

Có thể đặt `VITE_GEMINI_API_KEY` trong file `.env`, hoặc nhập key trực tiếp trong giao diện. Khi không có key, app dùng mô hình heuristic tại chỗ để vẫn trả kết quả.

## Deploy Cloud Run

```bash
docker build -t ecorisk-ai .
docker run -p 8080:8080 ecorisk-ai
```
