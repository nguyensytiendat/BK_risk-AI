# 🌍 BK_risk-AI — Nền tảng Đánh giá & Cảnh báo Rủi ro Sinh thái Thông minh

[![Build with Google AI](https://img.shields.io/badge/Build%20with-Google%20AI-4285F4?logo=google)](https://ai.google.dev/)
[![Powered by Gemini](https://img.shields.io/badge/Powered%20by-Gemini%20API-8E75FF?logo=google-gemini)](https://aistudio.google.com/)
[![Deployed on Firebase](https://img.shields.io/badge/Deployed%20on-Firebase-FFCA28?logo=firebase&logoColor=black)](https://firebase.google.com/)
[![Frontend](https://img.shields.io/badge/Frontend-React%20%2B%20Vite%20%2B%20Tailwind-blue)](https://react.dev/)

> **BK_risk-AI** là giải pháp ứng dụng trí tuệ nhân tạo hỗ trợ phân tích, đánh giá và dự báo nguy cơ rủi ro sinh thái, tai biến môi trường từ dữ liệu quan trắc và tọa độ địa lý. Dự án được nghiên cứu và phát triển nhằm giúp các nhà nghiên cứu và cơ quan quản lý đưa ra quyết định kịp thời, phòng chống thiên tai hiệu quả.

---

## 📌 Liên kết dự án (Google AI Riser Vietnam)
* 🌐 **Live Demo (Firebase Hosting):** https://ecorisk-ai-78d85.web.app/
* 🎥 **Video Demo:** [Dán link YouTube/Drive của bạn vào đây]

---

## 🚀 Tính năng nổi bật

* **Phân tích rủi ro đa biến (Multivariate Risk Assessment):** Xử lý nhanh các thông số môi trường, địa hình và khí tượng để phân loại cấp độ rủi ro sinh thái.
* **Tích hợp Google Gemini API:** Khai thác khả năng suy luận ngữ cảnh sâu sắc của Gemini để đưa ra báo cáo phân tích định tính, nguyên nhân tiềm ẩn và khuyến nghị hành động tức thì.
* **Cơ chế Dự phòng Thông minh (Hybrid/Heuristic Fallback):** Hệ thống tích hợp sẵn thuật toán phân tích heuristic cục bộ, đảm bảo ứng dụng vẫn trích xuất kết quả đánh giá ngay cả khi chưa cấu hình API Key.
* **Giao diện trực quan & Tốc độ cao:** Xây dựng trên nền tảng React + Vite và Tailwind CSS, cung cấp trải nghiệm mượt mà và tương tác dữ liệu trực tiếp trên trình duyệt.

---

## 🏗️ Kiến trúc & Công nghệ sử dụng

```text
[ Người dùng / Dữ liệu môi trường ]
                │
                ▼
      ┌──────────────────┐
      │  React + Vite UI │ (Tailwind CSS)
      └─────────┬────────┘
                │
        ┌───────┴────────┐
        ▼                ▼
┌──────────────┐   ┌───────────────────────────┐
│ Gemini API   │   │ Local Heuristic Engine    │
│ (AI Studio)  │   │ (Chạy khi offline/no-key) │
└──────────────┘   └───────────────────────────┘
