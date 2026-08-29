# EcoRisk AI

Ứng dụng React + Vite + Tailwind CSS đánh giá nhanh nguy cơ sạt lở từ dữ liệu địa hình.

## Chạy local

```bash
npm install
npm run dev
```

Đặt `VITE_GEMINI_API_KEY` trong file `.env` để app tự động sử dụng Gemini mà người dùng không cần nhập key. Khi không có key, app dùng mô hình heuristic tại chỗ để vẫn trả kết quả.

## Cấu hình đăng nhập

Tạo một Web App trong Firebase Console, bật Email/Password và Google tại Authentication > Sign-in method, sau đó sao chép các giá trị `VITE_FIREBASE_*` từ `.env.example` vào file `.env`. Thêm `http://localhost:5173` vào danh sách Authorized domains khi chạy local.

Để bật bản đồ ghim vị trí, thêm `VITE_GOOGLE_MAPS_API_KEY` vào `.env` và bật Maps JavaScript API, Geocoding API trong Google Cloud Console. Nếu chưa có key, nút bản đồ vẫn cho phép dùng định vị trình duyệt.

## Deploy Cloud Run

```bash
docker build -t ecorisk-ai .
docker run -p 8080:8080 ecorisk-ai
```
