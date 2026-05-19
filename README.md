<div align="center">
# Mangalens AI Comic Translator

Mangalens AI Comic Translator là một ứng dụng web giúp dịch thuật truyện tranh tự động bằng trí tuệ nhân tạo (AI).

## Tính năng chính
* **Dịch thuật tự động:** Sử dụng sức mạnh của Google Gemini để dịch nội dung văn bản trong truyện tranh.
* **Giao diện thân thiện:** Được xây dựng bằng React, mang lại trải nghiệm mượt mà.

## Cấu hình
Ứng dụng yêu cầu các biến môi trường sau (xem file `.env.example`):
* `GEMINI_API_KEY`: Khóa API để truy cập dịch vụ Gemini AI.
* `APP_URL`: URL của ứng dụng.

## Cài đặt và Chạy
1.  **Cài đặt các phụ thuộc:**
    ```bash
    npm install
    ```
2.  **Cấu hình biến môi trường:**
    Sao chép file `.env.example` thành `.env` và điền các giá trị thực tế của bạn.
3.  **Chạy ứng dụng:**
    ```bash
    npm start
    ```

## Cấu trúc dự án
* `/dist`: Chứa các tệp đã được build để triển khai (production build).
* `/.env.example`: File mẫu để cấu hình môi trường.
* `/.gitignore`: File quy định các tệp/thư mục không đưa lên Git.



1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`
