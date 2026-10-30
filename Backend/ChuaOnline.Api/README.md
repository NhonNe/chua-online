# ChuaOnline.Api

## Cấu hình connection string an toàn

Không ghi password vào `appsettings.json`, source code, Git hoặc chat.

### User Secrets (local development)

Từ thư mục repository:

```powershell
$dotnet = 'C:\Program Files\dotnet\dotnet.exe'
$env:DOTNET_CLI_HOME = (Join-Path (Get-Location) '.dotnet-home')
& $dotnet user-secrets --project Backend\ChuaOnline.Api\ChuaOnline.Api.csproj init
& $dotnet user-secrets --project Backend\ChuaOnline.Api\ChuaOnline.Api.csproj set 'ConnectionStrings:Default' 'Host=localhost;Port=5432;Database=chua_online;Username=postgres;Password=<nhập-cục-bộ-trên-máy>'
```

Thay placeholder bằng password trực tiếp trong terminal cục bộ; không gửi giá trị đó vào chat và không commit thư mục secrets.

### Environment variable

```powershell
$env:ConnectionStrings__Default = 'Host=localhost;Port=5432;Database=chua_online;Username=postgres;Password=<nhập-cục-bộ-trên-máy>'
```

Biến môi trường chỉ tồn tại trong process hiện tại. Trong CI/staging, dùng secret store của môi trường triển khai.

## Chạy và kiểm tra

```powershell
$env:DOTNET_CLI_HOME = (Join-Path (Get-Location) '.dotnet-home')
& 'C:\Program Files\dotnet\dotnet.exe' run --project Backend\ChuaOnline.Api\ChuaOnline.Api.csproj --urls http://localhost:5080
```

- `GET http://localhost:5080/health/live`: kiểm tra process.
- `GET http://localhost:5080/health/ready`: kiểm tra kết nối PostgreSQL; trả HTTP 503 nếu chưa có connection string hợp lệ hoặc database không truy cập được.
- OpenAPI development endpoint: `/openapi/v1.json`.
