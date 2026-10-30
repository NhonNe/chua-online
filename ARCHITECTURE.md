# CHUA ONLINE – Kiến trúc hệ thống

## Phạm vi giai đoạn khởi tạo

Tài liệu này là baseline kiến trúc cho game 3D multiplayer lấy bối cảnh một ngôi chùa. Giai đoạn hiện tại chỉ chốt ranh giới hệ thống và giao tiếp; chưa triển khai gameplay, tài khoản, database hay Photon session.

## Sơ đồ thành phần

```text
[Unity Client: Windows / Android / iOS]
          | HTTPS (Auth, profile, friends, persistence)
          v
[ASP.NET Core API] ---- [PostgreSQL]
          |
          | allocation / room metadata
          v
[Photon Fusion 2 Dedicated Server / Host]
          ^
          | Fusion networking: movement, emotes, interactions, chat events
          |
       [Unity Clients]
```

### Client

- Unity 6 LTS, URP, C#.
- Các lớp dự kiến: Bootstrap, Presentation/UI, Player, World/Interaction, Networking, Services, Persistence cache.
- Client không được tự quyết định dữ liệu quan trọng: xác thực, quyền sở hữu tài khoản, bạn bè, lưu tiến trình và các luật chống gian lận phải nằm ở backend hoặc server authoritative.
- Mục tiêu render: bản đồ duy nhất, low-poly chibi, LOD, baked lighting nơi phù hợp, giới hạn draw call/material và texture memory để phù hợp GPU 4 GB VRAM.

### Backend

- ASP.NET Core Web API, chia module Auth, Users/Profile, Friends, Room/Match metadata và Health.
- PostgreSQL là nguồn dữ liệu bền vững. Mật khẩu chỉ lưu dưới dạng hash có salt bằng thư viện chuẩn đã được kiểm chứng; không log password/token.
- JWT hoặc session token ngắn hạn cho API; refresh token phải được lưu/thu hồi an toàn. Secrets lấy từ environment/secret store, không commit vào Git.
- Backend không thay thế simulation của Fusion; nó cung cấp danh tính, quyền, dữ liệu tài khoản và orchestration.

### Dedicated server / Fusion

- Fusion 2 dùng mô hình Server/Client authoritative cho gameplay cạnh tranh và tính nhất quán.
- Dedicated server chạy build Unity headless riêng, không dùng scene/render code không cần thiết.
- Networked state tối thiểu: player transform/input đã được xác thực, trạng thái posture/emote, interaction result và chat message/event cần thiết. Không đồng bộ mọi UI hoặc dữ liệu hồ sơ.
- Room target là 100 người; phải xác nhận giới hạn thực tế bằng benchmark trước khi cam kết production. Có thể cần interest management/area-of-interest, tick rate và snapshot budget riêng.

## Ranh giới dữ liệu

- HTTP API: đăng ký/đăng nhập, refresh/revoke token, profile, friend requests, danh sách bạn, room discovery/allocation, persistence.
- Fusion: session join/leave, input prediction/reconciliation, spawn/despawn player, posture/emote, authoritative interaction và chat transport thời gian thực.
- PostgreSQL: account identity, password hash, profile, friend relation, audit tối thiểu và dữ liệu lưu game đã định nghĩa.
- Không đưa database credential, Photon App ID hoặc production secret vào client repository.

## Tích hợp Photon Fusion 2

1. Tạo Photon application và quản lý App ID theo môi trường (dev/staging/prod) qua cấu hình ngoài source.
2. Import package Fusion 2 vào Unity project theo phiên bản được Photon hỗ trợ cho Unity 6 LTS; khóa phiên bản trong tài liệu/package manifest.
3. Tạo `NetworkRunner` bootstrap riêng, session/lobby service và scene registration; không để UI tự khởi tạo runner.
4. Dựng vertical slice trước: một player, join/leave, movement authoritative, reconnect/timeout.
5. Sau khi slice ổn định mới thêm posture, interaction, chat, room capacity và interest management.
6. Dedicated build dùng cùng simulation code với client nhưng cấu hình headless/server riêng. Tất cả RPC/state authority phải có validation và rate limit.

## NFR và rủi ro chính

- Hiệu năng: profile CPU/GPU/network ở Android thiết bị mục tiêu và Windows GPU 4 GB; đặt ngân sách frame time, memory và bandwidth trước khi mở rộng content.
- 100 người chơi: rủi ro lớn nhất là bandwidth, replication frequency, physics/animation và hotspot interaction. Không suy luận capacity từ local test.
- Mobile: touch controls, suspend/resume, reconnect, thermal throttling, notch/safe area.
- Bảo mật: chống replay/token theft, server-side validation, chat moderation/rate limit, không tin client.
- Vận hành: logs có correlation ID nhưng loại bỏ secrets/PII không cần thiết; health checks cho API, database và server allocation.

## Định nghĩa hoàn thành kiến trúc

Kiến trúc được xem là baseline, chưa phải production-ready, khi các module có contract rõ ràng, vertical slice chạy được, test tự động tối thiểu có kết quả, và benchmark 100 client có số liệu CPU/RAM/bandwidth/latency được ghi lại.
