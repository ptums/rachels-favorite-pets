using Api.Data;
using Api.Options;
using Api.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.Azure.Cosmos;
using Microsoft.EntityFrameworkCore;
using Azure.Storage.Blobs;
using Microsoft.Azure.Cosmos.Linq;

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


var blob = builder.Configuration.GetSection(BlobStorageOptions.SectionName).Get<BlobStorageOptions>() ?? new BlobStorageOptions();
builder.Services.AddSingleton(new BlobServiceClient(blob.ConnectionString));

var app = builder.Build();

using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    await db.Database.EnsureCreatedAsync();
}


var blobService = app.Services.GetRequiredService<BlobServiceClient>();
var photosContainer = blobService.GetBlobContainerClient(blob.PhotosContainer);
await photosContainer.CreateIfNotExistsAsync();

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

    var container = blobService.GetBlobContainerClient(blob.PhotosContainer);
    var blobClient = container.GetBlobClient(photo.Id);
    await using var file = File.OpenRead(Path.Combine(app.Environment.ContentRootPath, "..", "cat1.jpg"));
    await blobClient.UploadAsync(file, overwrite: true);

    return Results.Ok(photo.Id);
});

app.MapGet("/photos", async (AppDbContext db) => 
{ 
   var photos = await db.Photos.ToListAsync();

   return Results.Ok(photos);
});



app.MapGet("/photos/{id}/image", async (string id, AppDbContext db, BlobServiceClient blobService) => 
{ 
    var photo = await db.Photos.FindAsync(id);

    if (photo == null) 
    {
        return Results.NotFound();
    }

    var container = blobService.GetBlobContainerClient(blob.PhotosContainer);
    var blobClient = container.GetBlobClient(photo.Id);
    var stream = await blobClient.OpenReadAsync();

    return Results.File(stream, photo.ContentType);
    
});

app.Run();

