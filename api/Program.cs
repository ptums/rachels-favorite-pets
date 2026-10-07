using Api.Data;
using Api.Options;
using Api.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.Azure.Cosmos;
using Azure.Storage.Blobs;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.Extensions.Options;
using Microsoft.AspNetCore.Identity;
using System.Security.Claims;
using Microsoft.AspNetCore.Authentication;

var builder = WebApplication.CreateBuilder(args);
builder.Configuration.AddJsonFile("appsettings.Local.json", optional: true, reloadOnChange: true);

// Add services to the container.
// Learn more about configuring OpenAPI at https://aka.ms/aspnet/openapi
builder.Services.AddOpenApi();

builder.Services.Configure<CosmosOptions>(builder.Configuration.GetSection(CosmosOptions.SectionName));
builder.Services.Configure<BlobStorageOptions>(builder.Configuration.GetSection(BlobStorageOptions.SectionName));
builder.Services.Configure<OwnerOptions>(builder.Configuration.GetSection(OwnerOptions.SectionName));

var cosmos = builder.Configuration.GetSection(CosmosOptions.SectionName).Get<CosmosOptions>() ?? new CosmosOptions();
builder.Services.AddDbContext<AppDbContext>(options =>
    options.UseCosmos(cosmos.Endpoint, cosmos.Key, cosmos.DatabaseName,
        cosmosOptions => cosmosOptions.ConnectionMode(ConnectionMode.Gateway)));


var blob = builder.Configuration.GetSection(BlobStorageOptions.SectionName).Get<BlobStorageOptions>() ?? new BlobStorageOptions();
builder.Services.AddSingleton(new BlobServiceClient(blob.ConnectionString));


builder.Services.AddAuthorization();
builder.Services.AddAuthentication(CookieAuthenticationDefaults.AuthenticationScheme)
    .AddCookie(options =>
    {
        options.Events.OnRedirectToLogin = context =>
        {
            context.Response.StatusCode = 401;
            return Task.CompletedTask;
        };
        options.Events.OnRedirectToAccessDenied = context =>
        {
            context.Response.StatusCode = 403;
            return Task.CompletedTask;
        };
    });

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


// Authentication routes
app.MapPost("/login", async (LoginRequest login, IOptions<OwnerOptions> owner, HttpContext http) =>
{
    var hasher = new PasswordHasher<string>();
    var result = hasher.VerifyHashedPassword(owner.Value.Username, owner.Value.PasswordHash, login.Password);

    if (result != PasswordVerificationResult.Success)
    {
        return Results.Unauthorized();
    }

    if(login.Username != owner.Value.Username)
    {
        return Results.Unauthorized();
    }

    //  On success, build the identity and sign in:
    var claims = new List<Claim> { new Claim(ClaimTypes.Name, owner.Value.Username) };
    var identity = new ClaimsIdentity(claims, CookieAuthenticationDefaults.AuthenticationScheme);
    var principal = new ClaimsPrincipal(identity);
    await http.SignInAsync(CookieAuthenticationDefaults.AuthenticationScheme, principal);
    return Results.Ok();
});


// Photo uploading routes
app.MapPost("/photos", async (IFormFile file, AppDbContext db, BlobServiceClient blobService) =>
{
    // 1. Size check
    if (file.Length == 0 || file.Length > 5 * 1024 * 1024)
    {
        return Results.BadRequest("File must be between 1 byte and 5 MB.");
    }

    // 2. Type check: read the file's first bytes, don't trust the header
    await using var stream = file.OpenReadStream();
    var header = new byte[4];
    var read = await stream.ReadAsync(header);

    var isJpeg = read >= 3 && header[0] == 0xFF && header[1] == 0xD8 && header[2] == 0xFF;
    var isPng = read >= 4 && header[0] == 0x89 && header[1] == 0x50 && header[2] == 0x4E && header[3] == 0x47;

    if (!isJpeg && !isPng)
    {
        return Results.BadRequest("Only JPEG and PNG images are allowed.");
    }

    stream.Position = 0; // rewind so the upload starts at byte one

    // 3. Build the record, with the type we detected
    var photo = new Photo
    {
        FileName = file.FileName,
        ContentType = isJpeg ? "image/jpeg" : "image/png"
    };

    // 4. Upload the blob first, then save the record
    var container = blobService.GetBlobContainerClient(blob.PhotosContainer);
    var blobClient = container.GetBlobClient(photo.Id);
    await blobClient.UploadAsync(stream, overwrite: true);

    db.Photos.Add(photo);
    await db.SaveChangesAsync();

    return Results.Ok(photo.Id);
}).DisableAntiforgery().RequireAuthorization();



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
    
}).RequireAuthorization();


app.Run();
record LoginRequest(string Username, string Password);


