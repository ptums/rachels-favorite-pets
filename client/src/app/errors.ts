import { HttpErrorResponse } from '@angular/common/http';

export type Action = 'load' | 'upload' | 'delete' | 'login' | 'signup';

/** The API returns 400/409 bodies as a plain message, sometimes JSON-encoded. */
function serverMessage(error: HttpErrorResponse): string | null {
  const body: unknown = error.error;
  if (typeof body === 'string' && body.trim()) {
    try {
      const parsed: unknown = JSON.parse(body);
      if (typeof parsed === 'string') return parsed;
    } catch {
      // not JSON, use as is
    }
    return body;
  }
  if (body && typeof body === 'object') {
    const { detail, title } = body as { detail?: unknown; title?: unknown };
    if (typeof detail === 'string') return detail;
    if (typeof title === 'string') return title;
  }
  return null;
}

/** Turns an API error into a sentence a person can act on. */
export function describeError(error: unknown, action: Action): string {
  if (!(error instanceof HttpErrorResponse)) {
    return 'Something went wrong. Please try again.';
  }

  switch (error.status) {
    case 0:
      return 'Could not reach the server. Check that the API is running, then try again.';
    case 400:
      return serverMessage(error) ?? 'The request was not valid.';
    case 401:
      return action === 'login'
        ? 'Wrong username or password.'
        : 'You need to log in to do that.';
    case 403:
      return action === 'delete'
        ? 'You can only delete photos you uploaded.'
        : 'You do not have permission to do that.';
    case 404:
      return action === 'delete'
        ? 'That photo was already removed.'
        : 'Not found.';
    case 409:
      return serverMessage(error) ?? 'That username is taken.';
    case 413:
      return 'That file is too large. The limit is 5 MB.';
    default:
      return `The server had a problem (error ${error.status}). Please try again.`;
  }
}
