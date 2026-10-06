using Api.Data;
using Api.Options;
using Api.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.Azure.Cosmos;
using Microsoft.EntityFrameworkCore;

var builder = WebApplication.CreateBuilder(args);

// Add services to the container.
// Learn more about configuring OpenAPI at https://aka.ms/aspnet/openapi
builder.Services.AddOpenApi();

builder.Services.Configure<CosmosOptions>(builder.Configuration.GetSection(CosmosOptions.SectionName));
builder.Services.Configure<BlobStorageOptions>(builder.Configuration.GetSection(BlobStorageOptions.SectionName));

var cosmos = builder.Configuration.GetSection(CosmosOptions.SectionName).Get<CosmosOptions>() ?? new CosmosOptions();
builder.Services.AddDbContext<AppDbContext>(options =>
    options.UseCosmos(cosmos.Endpoint, cosmos.Key, cosmos.DatabaseName,
        cosmosOptions => cosmosOptions.ConnectionMode(ConnectionMode.Gateway)));

var app = builder.Build();

using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    await db.Database.EnsureCreatedAsync();
}



// Configure the HTTP request pipeline.
if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
}

app.MapGet("/health", () => "ok");
app.MapPost("/photos", async (AppDbContext db) => 
{ 
    var photo = new Photo
    {
        FileName = "cat1.jpg",
        ContentType = "image/jpeg"
    };

    db.Photos.Add(photo);
    await db.SaveChangesAsync();

    return Results.Ok(photo.Id);
});

app.MapGet("/photos", async (AppDbContext db) => 
{ 
   var photos = await db.Photos.ToListAsync();

   return Results.Ok(photos);
});



app.Run();

