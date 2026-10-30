using ChuaOnline.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace ChuaOnline.Api.Data;

public sealed class ChuaOnlineDbContext(DbContextOptions<ChuaOnlineDbContext> options) : DbContext(options)
{
    public DbSet<HealthProbe> HealthProbes => Set<HealthProbe>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<HealthProbe>(entity =>
        {
            entity.ToTable("health_probes");
            entity.HasKey(x => x.Id);
            entity.Property(x => x.Name).HasMaxLength(100).IsRequired();
            entity.Property(x => x.CreatedAtUtc).IsRequired();
        });
    }
}
