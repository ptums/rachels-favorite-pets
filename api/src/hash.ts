// `npm run hash -- <password>` prints an OWNER_PASSWORD_HASH value and exits.
// Same hasher /login uses to verify it.
import { hashPassword } from './passwords.ts';

const password = process.argv[2];
if (!password) {
  console.error('Usage: npm run hash -- <password>');
  process.exit(1);
}
console.log(await hashPassword(password));
