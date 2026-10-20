import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { pipeline } from 'node:stream/promises';
import compression from 'compression';
import cookieSession from 'cookie-session';
import express, { type NextFunction, type Request, type Response } from 'express';
import multer from 'multer';
import { config } from './config.ts';
import { createUser, deletePhoto, ensureTables, getPhoto, getUser, listPhotos, putPhoto, type Photo } from './db.ts';
import { deleteFile, ensureBucket, getFile, putFile } from './files.ts';
import { hashPassword, verifyPassword } from './passwords.ts';

const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
const wwwroot = path.join(import.meta.dirname, '..', 'wwwroot');
const auth = config.authMode;

await ensureTables();
await ensureBucket();

const app = express();
app.use(compression()); // first, so static files get compressed
app.use(express.static(wwwroot));
app.use(express.json());
app.use(cookieSession({ name: 'session', keys: [config.sessionSecret], httpOnly: true, sameSite: 'lax' }));

function currentUser(req: Request): { username: string; isOwner: boolean } | null {
  const username = req.session?.username;
  return typeof username === 'string' ? { username, isOwner: req.session?.isOwner === true } : null;
}

function requireLogin(req: Request, res: Response, next: NextFunction) {
  if (!currentUser(req)) return void res.sendStatus(401);
  next();
}


// Authentication routes
const dummyHash = await hashPassword('not-a-real-password');

app.post('/login', async (req, res) => {
  const { username: rawUsername, password } = req.body ?? {};
  if (typeof rawUsername !== 'string' || !rawUsername.trim() || typeof password !== 'string' || !password)
    return void res.status(400).json('Username and password are required.');

  const username = rawUsername.trim().toLowerCase();
  let valid: boolean;

  if (auth === 'accounts') {
    const user = await getUser(username);
    // always verify, even for unknown users, so response timing doesn't reveal which exist
    const matches = await verifyPassword(password, user?.passwordHash ?? dummyHash);
    valid = user !== undefined && matches;
  } else {
    const matches = await verifyPassword(password, config.owner.passwordHash || dummyHash);
    valid = Boolean(config.owner.username) && username === config.owner.username.toLowerCase() && matches;
  }

  if (!valid) return void res.sendStatus(401);

  req.session = { username, isOwner: auth !== 'accounts' };
  res.sendStatus(200);
});

if (auth === 'accounts') {
  app.post('/signup', async (req, res) => {
    const username = String(req.body?.username ?? '').trim().toLowerCase();
    const password = String(req.body?.password ?? '');
    if (!/^[a-z0-9_-]{3,32}$/.test(username))
      return void res.status(400).json('Username must be 3-32 characters: letters, numbers, - or _.');
    if (password.length < 10) return void res.status(400).json('Password must be at least 10 characters.');

    const created = await createUser({
      id: username,
      passwordHash: await hashPassword(password),
      createdAt: new Date().toISOString(),
    });
    if (!created) return void res.status(409).json('That username is taken.');
    res.sendStatus(200);
  });
}

app.post('/logout', (req, res) => {
  req.session = null;
  res.sendStatus(204);
});

app.get('/me', requireLogin, (req, res) => {
  res.json(currentUser(req));
});

app.get('/config', (_req, res) => {
  res.json({ mode: auth });
});


// Photo uploading routes
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: MAX_UPLOAD_BYTES, files: 1 } });
const sizeError = 'File must be between 1 byte and 5 MB.';

// Login is checked before multer reads the body, so a rejected upload never buffers the file.
const uploadAuth = auth === 'open' ? [] : [requireLogin];

app.post('/photos', ...uploadAuth, (req, res, next) => {
  upload.single('file')(req, res, (error: unknown) => {
    if (error instanceof multer.MulterError && error.code === 'LIMIT_FILE_SIZE')
      return void res.status(400).json(sizeError);
    next(error);
  });
}, async (req, res) => {
  const file = req.file;

  // 1. Size check
  if (!file || file.size === 0 || file.size > MAX_UPLOAD_BYTES) return void res.status(400).json(sizeError);

  // 2. Type check: read the file's first bytes, don't trust the header
  const b = file.buffer;
  const isJpeg = b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff;
  const isPng = b.length >= 4 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47;
  if (!isJpeg && !isPng) return void res.status(400).json('Only JPEG and PNG images are allowed.');

  // 3. Build the record, with the type we detected and who uploaded it
  const photo: Photo = {
    id: randomUUID(),
    fileName: file.originalname,
    contentType: isJpeg ? 'image/jpeg' : 'image/png',
    uploadedAt: new Date().toISOString(),
    uploadedBy: currentUser(req)?.username ?? null,
  };

  // 4. Upload the file first, then save the record
  await putFile(photo.id, file.buffer, photo.contentType);
  await putPhoto(photo);

  res.json(photo.id);
});

app.get('/photos', requireLogin, async (req, res) => {
  const user = currentUser(req)!;
  res.json(await listPhotos(user.isOwner ? undefined : user.username));
});

app.get('/photos/:id/image', requireLogin, async (req, res) => {
  const photo = await getPhoto(String(req.params.id));
  if (!photo) return void res.sendStatus(404);

  res.type(photo.contentType);
  await pipeline(await getFile(photo.id), res);
});

app.delete('/photos/:id', requireLogin, async (req, res) => {
  const photo = await getPhoto(String(req.params.id));
  if (!photo) return void res.sendStatus(404);

  const user = currentUser(req)!;
  if (!user.isOwner && photo.uploadedBy !== user.username) return void res.sendStatus(403);

  // Record first, then file
  await deletePhoto(photo.id);
  await deleteFile(photo.id);

  res.sendStatus(204);
});

// Client-side routes: any other GET without a file extension gets the Angular app.
app.get(/^[^.]*$/, (_req, res) => {
  res.sendFile(path.join(wwwroot, 'index.html'));
});

app.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
  console.error(error);
  if (!res.headersSent) res.sendStatus(500);
});

app.listen(config.port, (error) => {
  if (error) throw error;
  console.log(`API (${auth} mode) listening on http://localhost:${config.port}`);
});
