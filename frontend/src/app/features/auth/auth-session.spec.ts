import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { AuthSession } from './auth-session';

describe('AuthSession', () => {
  let session: AuthSession;
  let http: HttpTestingController;
  const user = { id: 'id', email: 'user@example.com' };
  const credentials = { email: user.email, password: 'password' };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    session = TestBed.inject(AuthSession);
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());
  function bootstrap() {
    http.expectOne('/api/auth/csrf').flush(null, { status: 204, statusText: 'No Content' });
  }
  async function signIn() {
    const pending = session.login(credentials);
    bootstrap();
    http.expectOne('/api/auth/login').flush(user);
    await pending;
  }

  it('starts unknown and restores a session from /me, coalescing duplicate restores', async () => {
    expect(session.state().status).toBe('unknown');
    const first = session.restore();
    const second = session.restore();
    expect(first).toBe(second);
    expect(session.busy()).toBe(true);
    http.expectOne('/api/auth/me').flush(user);
    await first;
    expect(session.user()).toEqual(user);
    expect(session.busy()).toBe(false);
    await session.restore();
    http.expectNone('/api/auth/me');
  });

  it('confirms anonymous state only when /me returns 401', async () => {
    const pending = session.restore();
    http.expectOne('/api/auth/me').flush({}, { status: 401, statusText: 'Unauthorized' });
    await pending;
    expect(session.state().status).toBe('anonymous');
    expect(session.user()).toBeUndefined();
  });

  it('offers explicit recovery after a failed restore instead of claiming guest status', async () => {
    const pending = session.restore();
    http.expectOne('/api/auth/me').error(new ProgressEvent('error'));
    await pending;
    expect(session.state().status).toBe('error');
    const retry = session.restore(true);
    http.expectOne('/api/auth/me').flush(user);
    await retry;
    expect(session.user()).toEqual(user);
  });

  it('sets identity only after login succeeds and clears it only after logout succeeds', async () => {
    await signIn();
    expect(session.state().status).toBe('authenticated');
    const pending = session.logout();
    expect(session.user()).toEqual(user);
    bootstrap();
    http.expectOne('/api/auth/logout').flush(null, { status: 204, statusText: 'No Content' });
    await pending;
    expect(session.state().status).toBe('anonymous');
    expect(session.user()).toBeUndefined();
  });

  it('does not report successful login when credentials fail', async () => {
    const restore = session.restore();
    http.expectOne('/api/auth/me').flush({}, { status: 401, statusText: 'Unauthorized' });
    await restore;
    const pending = session.login(credentials);
    const assertion = expect(pending).rejects.toMatchObject({ status: 401 });
    bootstrap();
    http.expectOne('/api/auth/login').flush({}, { status: 401, statusText: 'Unauthorized' });
    await assertion;
    expect(session.state().status).toBe('anonymous');
    expect(session.busy()).toBe(false);
  });

  it('marks ambiguous login failure as unknown outcome and can recover via /me', async () => {
    const pending = session.login(credentials);
    const assertion = expect(pending).rejects.toMatchObject({ status: 0 });
    bootstrap();
    http.expectOne('/api/auth/login').error(new ProgressEvent('error'));
    await assertion;
    expect(session.state().status).toBe('error');
    const check = session.restore(true);
    http.expectOne('/api/auth/me').flush(user);
    await check;
    expect(session.user()).toEqual(user);
  });

  it('does not claim logout on a lost response and recovers the server outcome', async () => {
    await signIn();
    const pending = session.logout();
    const assertion = expect(pending).rejects.toMatchObject({ status: 0 });
    bootstrap();
    http.expectOne('/api/auth/logout').error(new ProgressEvent('error'));
    await assertion;
    expect(session.state().status).toBe('error');
    const check = session.restore(true);
    http.expectOne('/api/auth/me').flush({}, { status: 401, statusText: 'Unauthorized' });
    await check;
    expect(session.state().status).toBe('anonymous');
  });

  it('serializes restoration and mutations so stale /me cannot overwrite login', async () => {
    const restore = session.restore();
    await expect(session.login(credentials)).rejects.toThrow('already pending');
    http.expectNone('/api/auth/csrf');
    http.expectOne('/api/auth/me').flush({}, { status: 401, statusText: 'Unauthorized' });
    await restore;
    await signIn();
    expect(session.user()).toEqual(user);
  });

  it('does not start a duplicate mutation or /me while login is pending', async () => {
    const pending = session.login(credentials);
    await session.restore(true);
    await expect(session.logout()).rejects.toThrow('already pending');
    http.expectNone('/api/auth/me');
    bootstrap();
    http.expectOne('/api/auth/login').flush(user);
    await pending;
  });

  it('preserves an already-confirmed identity on a definitively rejected login', async () => {
    await signIn();
    const pending = session.login(credentials);
    const assertion = expect(pending).rejects.toMatchObject({ status: 401 });
    bootstrap();
    http.expectOne('/api/auth/login').flush({}, { status: 401, statusText: 'Unauthorized' });
    await assertion;
    expect(session.user()).toEqual(user);
  });
});
