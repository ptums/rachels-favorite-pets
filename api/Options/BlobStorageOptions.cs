namespace Api.Options;

public class BlobStorageOptions
{
    public const string SectionName = "BlobStorage";

    public string ConnectionString { get; set; } = string.Empty;

    public string PhotosContainer { get; set; } = "photos";
}
