namespace Api.Models;

public class Photo
{
    public string Id { get; set; } = Guid.NewGuid().ToString();

    public string FileName { get; set; } = string.Empty;

    public string ContentType { get; set; } = string.Empty;

    public DateTimeOffset UploadedAt { get; set; } = DateTimeOffset.UtcNow;

    public string? UploadedBy { get; set; }
}
