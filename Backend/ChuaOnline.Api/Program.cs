using ChuaOnline.Api.Data;
using ChuaOnline.Api.Hubs;
using Microsoft.EntityFrameworkCore;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddCors(options =>
{
    options.AddDefaultPolicy(policy =>
    {
        policy.SetIsOriginAllowed(_ => true)
              .AllowAnyHeader()
              .AllowAnyMethod()
              .AllowCredentials();
    });
});

builder.Services.AddSignalR();
builder.Services.AddControllers();
builder.Services.AddOpenApi();

var connectionString = builder.Configuration.GetConnectionString("Default");
if (string.IsNullOrWhiteSpace(connectionString))
{
    builder.Services.AddDbContext<ChuaOnlineDbContext>(options =>
        options.UseNpgsql("Host=localhost;Port=5432;Database=chua_online;Username=postgres;Password=__SET_LOCALLY__"));
}
else
{
    builder.Services.AddDbContext<ChuaOnlineDbContext>(options => options.UseNpgsql(connectionString));
}

var app = builder.Build();

app.UseCors();

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
}

app.MapGet("/", () => Results.Ok(new
{
    service = "Chùa Online API & Realtime Server",
    status = "Active",
    endpoint = "/hub/chanhdien",
    time = DateTime.UtcNow
}));

app.MapGet("/health/live", () => Results.Ok(new { status = "Healthy" }))
    .WithName("LiveHealth");

app.MapGet("/health/ready", async (ChuaOnlineDbContext db, CancellationToken cancellationToken) =>
{
    try
    {
        var canConnect = await db.Database.CanConnectAsync(cancellationToken);
        return canConnect
            ? Results.Ok(new { status = "Healthy", database = "Healthy" })
            : Results.Json(new { status = "Unhealthy", database = "Unhealthy" }, statusCode: StatusCodes.Status503ServiceUnavailable);
    }
    catch (Exception ex) when (ex is Npgsql.NpgsqlException or InvalidOperationException)
    {
        return Results.Json(new { status = "Unhealthy", database = "Unhealthy", error = "Database connection failed." },
            statusCode: StatusCodes.Status503ServiceUnavailable);
    }
}).WithName("ReadyHealth");

app.MapControllers();
app.MapHub<ChanhDienHub>("/hub/chanhdien");

app.Run();

public partial class Program;
