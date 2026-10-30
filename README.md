# CHUA ONLINE – 3D Multiplayer

Dự án được tách thành Unity client, ASP.NET Core backend, Fusion dedicated server, infrastructure và tests.

Xem [ARCHITECTURE.md](ARCHITECTURE.md) và [DEVELOPMENT_PLAN.md](DEVELOPMENT_PLAN.md) trước khi triển khai code.

## Cấu trúc thư mục

- `Client/` – Unity 6 LTS client (Windows/Android/iOS)
- `Backend/` – ASP.NET Core API và test
- `DedicatedServer/` – Unity headless/dedicated server
- `Infrastructure/` – PostgreSQL, local/staging deployment và observability config
- `Tests/` – load, integration và test data
- `Art/` – asset source/import notes (không commit asset có license chưa rõ)
- `Tools/` – công cụ build/profile/validation
- `Docs/` – tài liệu bổ sung
