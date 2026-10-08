namespace Api.Options;

public class AuthOptions
{
    public const string SectionName = "Auth";
    public string Mode { get; set; } = "owner"; // owner | open | accounts
}