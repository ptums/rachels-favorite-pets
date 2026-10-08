namespace Api.Models;

public class User
{
    public string Id { get; set; } = string.Empty; // the lowercase username, so Cosmos itself prevents duplicates
    public string PasswordHash { get; set; } = string.Empty;
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
}