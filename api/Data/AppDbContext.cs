using Api.Models;
using Api.Options;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

namespace Api.Data;

public class AppDbContext(DbContextOptions<AppDbContext> options, IOptions<CosmosOptions> cosmos)
    : DbContext(options)
{
    public DbSet<Photo> Photos => Set<Photo>();
    public DbSet<User> Users => Set<User>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<Photo>(photo =>
        {
            photo.ToContainer(cosmos.Value.PhotosContainer);
            photo.HasKey(p => p.Id);
            photo.HasPartitionKey(p => p.Id);
        });

        modelBuilder.Entity<User>(u =>
        {
            u.ToContainer("users");
            u.HasKey(x => x.Id);
            u.HasPartitionKey(x => x.Id);
        });
    }  
}