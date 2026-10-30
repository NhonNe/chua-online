# 🛕 Chùa Online (Sansa Virtual Temple 3D — PWA)

Dự án mô phỏng không gian Chùa Online 3D thời gian thực (Realtime Multiplayer), cho phép phật tử khắp nơi trên thế giới vào chiêm bái, tọa thiền, chắp tay, đảnh lễ (lạy Phật), gõ mõ và lần tràng hạt cùng nhau 24/7 trên điện thoại **iOS (iPhone) và Android** mà không cần qua App Store hay CH Play.

---

## 🌟 Tính Năng Nổi Bật

1. **Đồ họa 3D WebGL chân thực (Three.js):**
   * Tôn tượng Đức Bổn Sư Thích Ca Mâu Ni dát vàng trên bục Tam Bảo.
   * Ánh nến chập chờn, sàn gỗ chánh điện ấm cúng.
   * Chú tiểu Chibi đầu tròn, áo lam cà sa với hệ thống xương chuyển động (Ngồi thiền, Chắp tay, Cúi lạy).
   * 36 bồ đoàn (đệm ngồi thiền) tương tác chạm để đổi chỗ.
2. **Âm thanh & Rung Haptic:**
   * Tiếng gõ mõ gỗ tự nhiên có độ vang âm mộc.
   * Tiếng chuông khánh ngân vang.
   * Bản tụng kinh niệm Phật thanh tịnh (bật/tắt tùy ý).
   * Rung nhẹ điện thoại (Haptic) mỗi lần gõ mõ hoặc lăn một hạt bồ đề.
3. **Tràng Hạt Niệm Phật 108 Hạt:**
   * Popup vuốt hạt chuỗi tràng hạt bồ đề, đếm số hạt (/108) và số vòng chuỗi.
4. **Đồng bộ Đa người chơi Realtime (WebSocket):**
   * Người chơi vào phòng nhận pháp danh ngẫu nhiên (*Tâm An, Diệu Âm, Tuệ Minh...*).
   * Thấy các đồng tu khác đang ngồi trên các bồ đoàn, cùng lạy Phật và cùng chắp tay chào nhau.
   * Không có chat chữ để giữ gìn không gian trang nghiêm thanh tịnh.
5. **Cài đặt như App độc lập (PWA):**
   * **iPhone (Safari):** Bấm nút *Chia sẻ* -> *Thêm vào MH chính*.
   * **Android (Chrome):** Bấm menu 3 chấm -> *Cài đặt ứng dụng*.
   * Mở lên toàn màn hình (tràn viền, không có thanh địa chỉ web), 60 FPS mượt mà.

---

## 🚀 Hướng Dẫn Chạy Thử Ngay Trên Máy Tính (Local)

Mở terminal trong thư mục `C:\Chùa OL`:

```bash
# Cài đặt thư viện (nếu chưa cài)
npm install

# Khởi động máy chủ
npm start
```

* Mở trình duyệt máy tính: `http://localhost:3000`
* Mở trên điện thoại cùng Wi-Fi: `http://192.168.1.25:3000`

---

## 🌐 Hướng Dẫn Đưa Lên Cloud Server Chạy 24/7 Miễn Phí (Cách 2)

Để có một đường link **HTTPS toàn cầu** (ví dụ: `https://chua-online.onrender.com`) để bất kỳ ai ở bất kỳ đâu dùng 4G/5G cũng vào chơi được 24/7 kể cả khi bạn tắt máy tính:

### Bước 1: Đưa mã nguồn lên GitHub
1. Khởi tạo Git và đẩy thư mục `C:\Chùa OL` lên một kho lưu trữ (Repository) trên [GitHub](https://github.com):
```bash
git init
git add .
git commit -m "Khoi tao Chùa Online 3D"
git branch -M main
git remote add origin <URL-GITHUB-CUA-BAN>
git push -u origin main
```

### Bước 2: Triển khai lên Render.com (Miễn phí 100%)
1. Truy cập [render.com](https://render.com) và đăng ký/đăng nhập (bằng tài khoản GitHub).
2. Bấm nút **New +** $\rightarrow$ chọn **Web Service**.
3. Chọn kho lưu trữ GitHub của bạn (`chua-online`).
4. Điền cấu hình cơ bản:
   * **Name:** `chua-online` (hoặc tên bạn thích)
   * **Runtime:** `Node`
   * **Build Command:** `npm install`
   * **Start Command:** `node server.js`
   * **Instance Type:** `Free`
5. Bấm **Create Web Service**.

Render sẽ tự động xây dựng và cấp cho bạn một đường link HTTPS bảo mật vĩnh viễn (ví dụ: `https://chua-online.onrender.com`).

---

## 📱 Chia Sẻ Cho Đại Chúng
Chỉ cần gửi đường link trên cho bạn bè hoặc người thân:
* Họ mở link trên điện thoại iPhone hoặc Android.
* Bấm **"Thêm vào Màn hình chính"** để lưu icon Chùa lên điện thoại.
* Tất cả mọi người cùng vào một Chánh điện, tĩnh tâm niệm Phật cùng nhau!
