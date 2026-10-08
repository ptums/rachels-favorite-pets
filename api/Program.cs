using Api.Data;
using Api.Options;
using Api.Models;
using Microsoft.EntityFrameworkCore;
using Azure.Storage.Blobs;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.Extensions.Options;
using Microsoft.AspNetCore.Identity;
using System.Security.Claims;
using Microsoft.AspNetCore.Authentication;

// `dotnet run -- hash <password>` prints an Owner:PasswordHash value and exits.
// Same hasher /login uses to verify it.
if (args is ["hash", var plainPassword])
{
    Console.WriteLine(new PasswordHasher<string>().HashPassword("owner", plainPassword));
    return;
}

var builder = WebApplication.CreateBuilder(args);
builder.Configuration.AddJsonFile("appsettings.Local.json", optional: true, reloadOnChange: true);

var auth = builder.Configuration.GetSection(AuthOptions.SectionName).Get<AuthOptions>() ?? new AuthOptions();
if (auth.Mode is not ("owner" or "open" or "accounts"))
    throw new InvalidOperationException($"Auth:Mode must be owner, open, or accounts (got '{auth.Mode}').");
if (auth.Mode == "owner" &&
    (string.IsNullOrEmpty(builder.Configuration["Owner:Username"]) || string.IsNullOrEmpty(builder.Configuration["Owner:PasswordHash"])))
    throw new InvalidOperationException(
        "Auth:Mode is \"owner\" but Owner:Username or Owner:PasswordHash is not set in api/appsettings.Local.json. " +
        "Generate a hash with: dotnet run --no-launch-profile -- hash <password>");

// Add services to the container.
// Learn more about configuring OpenAPI at https://aka.ms/aspnet/openapi
builder.Services.AddOpenApi();

builder.Services.Configure<CosmosOptions>(builder.Configuration.GetSection(CosmosOptions.SectionName));
builder.Services.Configure<BlobStorageOptions>(builder.Configuration.GetSection(BlobStorageOptions.SectionName));
builder.Services.Configure<OwnerOptions>(builder.Configuration.GetSection(OwnerOptions.SectionName));

var cosmos = builder.Configuration.GetSection(CosmosOptions.SectionName).Get<CosmosOptions>() ?? new CosmosOptions();
builder.Services.AddDbContext<AppDbContext>(options =>
    options.UseCosmos(cosmos.Endpoint, cosmos.Key, cosmos.DatabaseName,
        cosmosOptions => cosmosOptions.ConnectionMode(Microsoft.Azure.Cosmos.ConnectionMode.Gateway)));


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

builder.Services.AddResponseCompression();

var app = builder.Build();

app.UseResponseCompression();   // first, so static files get compressed
app.UseDefaultFiles();
app.UseStaticFiles();

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
var dummyHash = new PasswordHasher<string>().HashPassword("dummy", "not-a-real-password");

app.MapPost("/login", async (LoginRequest login, IOptions<OwnerOptions> owner, AppDbContext db, HttpContext http) =>
{
    if (string.IsNullOrWhiteSpace(login.Username) || string.IsNullOrEmpty(login.Password))
        return Results.BadRequest("Username and password are required.");

    var username = login.Username.Trim().ToLowerInvariant();
    var hasher = new PasswordHasher<string>();
    bool valid;

    if (auth.Mode == "accounts")
    {
        var user = await db.Users.FindAsync(username);
        // always verify, even for unknown users, so response timing doesn't reveal which exist
        var result = hasher.VerifyHashedPassword(username, user?.PasswordHash ?? dummyHash, login.Password);
        valid = user is not null && result == PasswordVerificationResult.Success;
    }
    else
    {
        var result = hasher.VerifyHashedPassword(username, owner.Value.PasswordHash, login.Password);
        valid = username == owner.Value.Username.ToLowerInvariant() && result == PasswordVerificationResult.Success;
    }

    if (!valid) return Results.Unauthorized();

    var claims = new List<Claim> { new(ClaimTypes.Name, username) };
    if (auth.Mode != "accounts") claims.Add(new Claim(ClaimTypes.Role, "owner"));

    var identity = new ClaimsIdentity(claims, CookieAuthenticationDefaults.AuthenticationScheme);
    await http.SignInAsync(CookieAuthenticationDefaults.AuthenticationScheme, new ClaimsPrincipal(identity));
    return Results.Ok();
});

if (auth.Mode == "accounts")
{
    app.MapPost("/signup", async (LoginRequest signup, AppDbContext db) =>
    {
        var username = (signup.Username ?? "").Trim().ToLowerInvariant();
        if (!System.Text.RegularExpressions.Regex.IsMatch(username, "^[a-z0-9_-]{3,32}$"))
            return Results.BadRequest("Username must be 3-32 characters: letters, numbers, - or _.");
        if ((signup.Password ?? "").Length < 10)
            return Results.BadRequest("Password must be at least 10 characters.");
        if (await db.Users.FindAsync(username) is not null)
            return Results.Conflict("That username is taken.");

        db.Users.Add(new User { Id = username, PasswordHash = new PasswordHasher<string>().HashPassword(username, signup.Password!) });
        try { await db.SaveChangesAsync(); }
        catch (DbUpdateException) { return Results.Conflict("That username is taken."); }
        return Results.Ok();
    });
}

app.MapPost("/logout", async (HttpContext http) =>
{
    await http.SignOutAsync(CookieAuthenticationDefaults.AuthenticationScheme);
    return Results.NoContent();
});

app.MapGet("/me", (HttpContext http) =>
    Results.Ok(new { username = http.User.Identity?.Name, isOwner = http.User.IsInRole("owner") }))
    .RequireAuthorization();

app.MapGet("/config", () => Results.Ok(new { mode = auth.Mode }));


// Photo uploading routes
var uploadRoute = app.MapPost("/photos", async (IFormFile file, HttpContext http, AppDbContext db, BlobServiceClient blobService) =>
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

    // 3. Build the record, with the type we detected and who uploaded it
    var photo = new Photo
    {
        FileName = file.FileName,
        ContentType = isJpeg ? "image/jpeg" : "image/png",
        UploadedBy = http.User.Identity?.Name
    };

    // 4. Upload the blob first, then save the record
    var container = blobService.GetBlobContainerClient(blob.PhotosContainer);
    var blobClient = container.GetBlobClient(photo.Id);
    await blobClient.UploadAsync(stream, overwrite: true);

    db.Photos.Add(photo);
    await db.SaveChangesAsync();

    return Results.Ok(photo.Id);
}).DisableAntiforgery();

if (auth.Mode != "open") uploadRoute.RequireAuthorization();


app.MapGet("/photos", async (AppDbContext db, HttpContext http) =>
  {
      var username = http.User.Identity?.Name;
      if (username is null) return Results.Unauthorized();

      var query = http.User.IsInRole("owner")
          ? db.Photos
          : db.Photos.Where(p => p.UploadedBy == username);

      return Results.Ok(await query.OrderByDescending(p => p.UploadedAt).ToListAsync());
  }).RequireAuthorization();

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

app.MapDelete("/photos/{id}", async (string id, AppDbContext db, BlobServiceClient blobService, HttpContext http) =>
{
    var photo = await db.Photos.FindAsync(id);
    if (photo is null)
    {
        return Results.NotFound();
    }

    if (!http.User.IsInRole("owner") && photo.UploadedBy != http.User.Identity?.Name)
    return Results.StatusCode(StatusCodes.Status403Forbidden);

    // Record first, then file
    db.Photos.Remove(photo);
    await db.SaveChangesAsync();

    var container = blobService.GetBlobContainerClient(blob.PhotosContainer);
    await container.GetBlobClient(photo.Id).DeleteIfExistsAsync();

    return Results.NoContent();
}).RequireAuthorization();

app.MapFallbackToFile("index.html"); 

app.Run();
record LoginRequest(string Username, string Password);


