import { HttpErrorResponse } from '@angular/common/http';
import { describeError } from './errors';

const httpError = (status: number, error: unknown = null) =>
  new HttpErrorResponse({ status, error });

describe('describeError', () => {
  it('shows the server message for a 400', () => {
    expect(describeError(httpError(400, 'Only JPEG and PNG images are allowed.'), 'upload')).toBe(
      'Only JPEG and PNG images are allowed.',
    );
  });

  it('unwraps a JSON-encoded 400 message', () => {
    expect(describeError(httpError(400, '"File must be between 1 byte and 5 MB."'), 'upload')).toBe(
      'File must be between 1 byte and 5 MB.',
    );
  });

  it('says wrong credentials for a 401 on login', () => {
    expect(describeError(httpError(401), 'login')).toBe('Wrong username or password.');
  });

  it('asks the user to log in for a 401 elsewhere', () => {
    expect(describeError(httpError(401), 'upload')).toBe('You need to log in to do that.');
  });

  it('explains a 403 on delete', () => {
    expect(describeError(httpError(403), 'delete')).toBe('You can only delete photos you uploaded.');
  });

  it('uses the server message for a 409', () => {
    expect(describeError(httpError(409, 'That username is taken.'), 'signup')).toBe(
      'That username is taken.',
    );
  });

  it('reports an unreachable server', () => {
    expect(describeError(httpError(0), 'load')).toContain('Could not reach the server');
  });
});
