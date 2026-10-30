namespace ChuaOnline.Api.Models;

public sealed class HealthProbe
{
    public int Id { get; set; }
    public string Name { get; set; } = "initial";
    public DateTime CreatedAtUtc { get; set; }
}
