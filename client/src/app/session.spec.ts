import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Photo } from './api';
import { Session } from './session';

const photo = (uploadedBy: string | null): Photo => ({
  id: '1',
  fileName: 'dog.jpg',
  contentType: 'image/jpeg',
  uploadedAt: '2026-10-06T00:00:00Z',
  uploadedBy,
});

describe('Session', () => {
  let session: Session;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    session = TestBed.inject(Session);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('loads the mode and the logged-in user on start', async () => {
    const loading = session.load();
    http.expectOne('/config').flush({ mode: 'accounts' });
    await Promise.resolve();
    http.expectOne('/me').flush({ username: 'rachel', isOwner: false });
    await loading;

    expect(session.mode()).toBe('accounts');
    expect(session.user()?.username).toBe('rachel');
    expect(session.canSignup()).toBe(true);
  });

  it('treats a 401 from /me as logged out', async () => {
    const loading = session.load();
    http.expectOne('/config').flush({ mode: 'owner' });
    await Promise.resolve();
    http.expectOne('/me').flush(null, { status: 401, statusText: 'Unauthorized' });
    await loading;

    expect(session.user()).toBeNull();
    expect(session.canUpload()).toBe(false);
    expect(session.canSignup()).toBe(false);
  });

  it('lets anyone upload in open mode', () => {
    session.mode.set('open');
    expect(session.canUpload()).toBe(true);
  });

  it('shows photos only to a logged-in user, even in open mode', () => {
    session.mode.set('open');
    expect(session.canViewPhotos()).toBe(false);
    session.user.set({ username: 'rachel', isOwner: false });
    expect(session.canViewPhotos()).toBe(true);
  });

  it('hides delete when logged out', () => {
    expect(session.canDelete(photo('rachel'))).toBe(false);
  });

  it('lets the owner delete any photo', () => {
    session.user.set({ username: 'owner', isOwner: true });
    expect(session.canDelete(photo('someone-else'))).toBe(true);
  });

  it('lets an account delete only its own photos', () => {
    session.user.set({ username: 'rachel', isOwner: false });
    expect(session.canDelete(photo('rachel'))).toBe(true);
    expect(session.canDelete(photo('sam'))).toBe(false);
    expect(session.canDelete(photo(null))).toBe(false);
  });
});
