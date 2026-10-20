import {
  ConditionalCheckFailedException,
  CreateTableCommand,
  DynamoDBClient,
  ResourceNotFoundException,
  DescribeTableCommand,
} from '@aws-sdk/client-dynamodb';
import { DeleteCommand, DynamoDBDocumentClient, GetCommand, PutCommand, ScanCommand } from '@aws-sdk/lib-dynamodb';
import { config } from './config.ts';

export interface Photo {
  id: string;
  fileName: string;
  contentType: string;
  uploadedAt: string; // ISO 8601
  uploadedBy: string | null;
}

export interface User {
  id: string; // the lowercase username, so a conditional put prevents duplicates
  passwordHash: string;
  createdAt: string;
}

const client = new DynamoDBClient({ region: config.aws.region, endpoint: config.aws.dynamoEndpoint });
const docs = DynamoDBDocumentClient.from(client);

// Both tables are keyed by `id` alone, created on startup if missing.
export async function ensureTables(): Promise<void> {
  for (const table of [config.photosTable, config.usersTable]) {
    try {
      await client.send(new DescribeTableCommand({ TableName: table }));
    } catch (error) {
      if (!(error instanceof ResourceNotFoundException)) throw error;
      await client.send(
        new CreateTableCommand({
          TableName: table,
          AttributeDefinitions: [{ AttributeName: 'id', AttributeType: 'S' }],
          KeySchema: [{ AttributeName: 'id', KeyType: 'HASH' }],
          BillingMode: 'PAY_PER_REQUEST',
        }),
      );
    }
  }
}

export async function getPhoto(id: string): Promise<Photo | undefined> {
  const result = await docs.send(new GetCommand({ TableName: config.photosTable, Key: { id } }));
  return result.Item as Photo | undefined;
}

export async function putPhoto(photo: Photo): Promise<void> {
  await docs.send(new PutCommand({ TableName: config.photosTable, Item: photo }));
}

export async function deletePhoto(id: string): Promise<void> {
  await docs.send(new DeleteCommand({ TableName: config.photosTable, Key: { id } }));
}

// Newest first. A full scan is fine at gallery scale; a GSI on uploadedBy is the
// next step if per-user lists ever get large.
export async function listPhotos(uploadedBy?: string): Promise<Photo[]> {
  const photos: Photo[] = [];
  let startKey: Record<string, unknown> | undefined;
  do {
    const page = await docs.send(
      new ScanCommand({
        TableName: config.photosTable,
        ExclusiveStartKey: startKey,
        ...(uploadedBy && {
          FilterExpression: 'uploadedBy = :user',
          ExpressionAttributeValues: { ':user': uploadedBy },
        }),
      }),
    );
    photos.push(...((page.Items ?? []) as Photo[]));
    startKey = page.LastEvaluatedKey;
  } while (startKey);
  return photos.sort((a, b) => b.uploadedAt.localeCompare(a.uploadedAt));
}

export async function getUser(id: string): Promise<User | undefined> {
  const result = await docs.send(new GetCommand({ TableName: config.usersTable, Key: { id } }));
  return result.Item as User | undefined;
}

/** Returns false if the username is already taken. */
export async function createUser(user: User): Promise<boolean> {
  try {
    await docs.send(
      new PutCommand({ TableName: config.usersTable, Item: user, ConditionExpression: 'attribute_not_exists(id)' }),
    );
    return true;
  } catch (error) {
    if (error instanceof ConditionalCheckFailedException) return false;
    throw error;
  }
}
