# CHUA ONLINE – Kế hoạch phát triển

## Nguyên tắc

- Phát triển theo module và vertical slice; mỗi phase có tiêu chí nghiệm thu và test riêng.
- Không dùng mock để báo hoàn thành tính năng thật. Stub chỉ được phép trong test unit/integration và phải ghi rõ.
- Không mở rộng scope sang phase sau nếu phase hiện tại chưa chạy thử và có số liệu.

## Phase 0 – Khởi tạo môi trường (hiện tại)

**Mục tiêu:** kiểm kê máy, tạo cấu trúc repo, chốt kiến trúc/kế hoạch.

**Đầu ra:** `ARCHITECTURE.md`, tài liệu này, thư mục module, danh sách công cụ còn thiếu.

**Nghiệm thu:** người phát triển cài Unity 6 LTS + URP, .NET SDK, PostgreSQL, Android/iOS toolchain phù hợp, Photon account/app config ở môi trường dev; Git clean và build smoke test được.

## Phase 1 – Skeleton và CI

- Tạo Unity project đúng Unity 6 LTS + URP; cấu hình Windows/Android/iOS.
- Tạo solution ASP.NET Core và test project; health endpoint.
- Tạo dedicated server project/build target.
- Thiết lập format/analyzer, secret policy, build pipeline và test pipeline.

## Phase 2 – Backend nền tảng

- PostgreSQL schema/migrations cho account, profile, friendships.
- Auth/password hashing/refresh-token rotation, validation và rate limit.
- Contract tests cho API; không ghi token/password vào log.

## Phase 3 – Photon vertical slice

- Tích hợp Fusion 2, runner lifecycle, session join/leave.
- Server-authoritative movement, spawn/despawn, reconnect/timeout.
- Chạy client Windows với dedicated server local/staging.

## Phase 4 – Core gameplay và bản đồ chùa

- Blockout một map; navigation/collision/interaction points.
- Player controller, quỳ, cúi lạy, animation state machine.
- Interaction authority, chat cơ bản, UI lỗi/kết nối.

## Phase 5 – Social và persistence

- Profile, friend request/accept/block, presence cơ bản.
- Lưu/đọc dữ liệu qua backend; retry/idempotency và migration test.

## Phase 6 – Tối ưu đa nền tảng

- LOD, occlusion/culling, atlas/material batching, texture compression, addressables nếu cần.
- Touch/controller/keyboard, safe area, suspend/resume, reconnect.
- Profile trên GPU 4 GB và ít nhất hai thiết bị Android/iOS mục tiêu.

## Phase 7 – Load, security và release candidate

- Load test tăng dần 1/10/25/50/75/100 client.
- Soak test, packet loss/latency test, reconnect storm, room full/leave/join.
- Security review API, rate limits, abuse/chat controls, backup/restore PostgreSQL.
- Tạo release checklist và rollback plan.

## Ma trận kiểm thử 100 người chơi

### Công cụ và topology

- Dedicated Fusion server chạy trên máy/VM staging có CPU/RAM/network được ghi rõ.
- Client load generator phải là build Unity thật hoặc harness được Fusion hỗ trợ; không đếm 100 bot giả là nghiệm thu nếu không đi qua replication path.
- Backend và PostgreSQL chạy riêng hoặc tài nguyên được giới hạn để đo đúng bottleneck.

### Kịch bản

1. Ramp: 1 → 10 → 25 → 50 → 75 → 100 người, mỗi nấc ghi join time, tick rate, RTT, packet loss, CPU/RAM/bandwidth.
2. Steady state: 100 người di chuyển trong các khu vực khác nhau và cùng khu vực; lặp posture/emote, interaction và chat ở tần suất thực tế.
3. Churn: rời/vào ngẫu nhiên, mất mạng 5–30 giây, reconnect, room full.
4. Stress hotspot: 100 người cùng nhìn/tương tác một điểm để đo replication và server tick.
5. Soak: giữ 100 người tối thiểu 30–60 phút để phát hiện leak, drift và degradation.

### Tiêu chí cần chốt trước khi đo đạt

Các ngưỡng FPS, tick rate, RTT, packet loss, memory, bandwidth và thời gian reconnect phải được product/technical owner phê duyệt. Không tự đặt ngưỡng tùy ý và gọi là pass. Mọi kết quả phải lưu cùng commit, build ID, cấu hình server/client và device profile.

## Tài nguyên 3D cần chuẩn bị

- Một kit kiến trúc chùa: cổng, chính điện, mái, cột, bậc thềm, sân, tường, lan can, tượng/phù điêu phù hợp phạm vi dự án.
- Props tương tác: chuông, hòm công đức, nến/hương, cây, ghế/bồ đoàn, bảng hướng dẫn; mỗi asset có collision và LOD.
- Player chibi modular: body/head/hair/clothing, rig humanoid, idle/walk/run, quỳ, cúi lạy, turn, hit/interaction nếu cần.
- VFX/UI/audio: bụi nhẹ, hương khói tiết chế, icon interaction, chat/emote, ambient/chime/footstep.
- Technical asset data: scale/meter convention, pivot, naming, collider, lightmap UV, material/shader budget, texture sizes/compression, LOD thresholds, license/source.
- Cần quyết định sớm: phong cách video tham chiếu, quyền sử dụng asset/âm thanh, mức độ tôn trọng biểu tượng tôn giáo, target devices và camera.

## Bước tiếp theo sau khi được xác nhận

Cài Unity 6 LTS + module cần thiết và .NET SDK/PostgreSQL, sau đó tạo skeleton Unity/ASP.NET Core và chạy smoke test. Không bắt đầu gameplay hoặc Photon integration trước xác nhận này.
