namespace Api.Options;

public class OwnerOptions
{
    public const string SectionName = "Owner";
    public string Username { get; set; } = string.Empty;
    public string PasswordHash { get; set; } = string.Empty;
}