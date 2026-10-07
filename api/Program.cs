using Api.Data;
using Api.Options;
using Api.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.Azure.Cosmos;
using Azure.Storage.Blobs;
using Microsoft.Azure.Cosmos.Linq;
using Microsoft.AspNetCore.Authentication.Cookies;

var builder = WebApplication.CreateBuilder(args);

var hasher = new Microsoft.AspNetCore.Identity.PasswordHasher<string>();
Console.WriteLine(hasher.HashPassword("owner", "tiger-lily-42"));
Console.WriteLine(hasher.HashPassword("owner", "tiger-lily-42"));

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


builder.Services.AddAuthentication(CookieAuthenticationDefaults.AuthenticationScheme).AddCookie();
builder.Services.AddAuthorization();

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

app.MapGet("/me", () => "you are logged in").RequireAuthorization();
app.MapPost("/photos", async (IFormFile file, AppDbContext db, BlobServiceClient blobService)=> 
{ 

    var photo = new Photo
    {
        FileName = file.FileName,
        ContentType = file.ContentType
    };

    db.Photos.Add(photo);
    await db.SaveChangesAsync();

    var container = blobService.GetBlobContainerClient(blob.PhotosContainer);
    var blobClient = container.GetBlobClient(photo.Id);
    await using var stream = file.OpenReadStream();
    await blobClient.UploadAsync(stream, overwrite: true);

    return Results.Ok(photo.Id);
}).DisableAntiforgery();

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

