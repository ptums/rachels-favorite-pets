import { randomBytes } from 'node:crypto';

export type AuthMode = 'owner' | 'open' | 'accounts';

const env = process.env;

const mode = env.AUTH_MODE || 'owner';
if (mode !== 'owner' && mode !== 'open' && mode !== 'accounts')
  throw new Error(`AUTH_MODE must be owner, open, or accounts (got '${mode}').`);

const owner = { username: env.OWNER_USERNAME ?? '', passwordHash: env.OWNER_PASSWORD_HASH ?? '' };
if (mode === 'owner' && (!owner.username || !owner.passwordHash))
  throw new Error(
    'AUTH_MODE is "owner" but OWNER_USERNAME or OWNER_PASSWORD_HASH is not set in api/.env. ' +
      'Generate a hash with: npm run hash -- <password>',
  );

if (!env.SESSION_SECRET)
  console.warn('SESSION_SECRET is not set; using a random one, so logins end when the API restarts.');

export const config = {
  port: Number(env.PORT || 5017),
  authMode: mode as AuthMode,
  owner,
  sessionSecret: env.SESSION_SECRET || randomBytes(32).toString('hex'),
  aws: {
    region: env.AWS_REGION || 'us-east-1',
    dynamoEndpoint: env.DYNAMODB_ENDPOINT || undefined, // unset = real AWS
    s3Endpoint: env.S3_ENDPOINT || undefined,
  },
  photosTable: env.DYNAMODB_PHOTOS_TABLE || 'photos',
  usersTable: env.DYNAMODB_USERS_TABLE || 'users',
  photosBucket: env.S3_BUCKET || 'photos',
};
