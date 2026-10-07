import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

export type AuthMode = 'owner' | 'open' | 'accounts';

export interface AppConfig {
  mode: AuthMode;
}

export interface CurrentUser {
  username: string;
  isOwner: boolean;
}

export interface Photo {
  id: string;
  fileName: string;
  contentType: string;
  uploadedAt: string;
  uploadedBy: string | null;
}

export interface Credentials {
  username: string;
  password: string;
}

/** Thin wrapper over the API. Every path goes through the dev server proxy. */
@Injectable({ providedIn: 'root' })
export class Api {
  private readonly http = inject(HttpClient);

  config(): Observable<AppConfig> {
    return this.http.get<AppConfig>('/config');
  }

  me(): Observable<CurrentUser> {
    return this.http.get<CurrentUser>('/me');
  }

  photos(): Observable<Photo[]> {
    return this.http.get<Photo[]>('/photos');
  }

  imageUrl(id: string): string {
    return `/photos/${encodeURIComponent(id)}/image`;
  }

  upload(file: File): Observable<string> {
    const body = new FormData();
    body.append('file', file);
    return this.http.post<string>('/photos', body);
  }

  delete(id: string): Observable<void> {
    return this.http.delete<void>(`/photos/${encodeURIComponent(id)}`);
  }

  login(credentials: Credentials): Observable<void> {
    return this.http.post<void>('/login', credentials);
  }

  logout(): Observable<void> {
    return this.http.post<void>('/logout', null);
  }

  signup(credentials: Credentials): Observable<void> {
    return this.http.post<void>('/signup', credentials);
  }
}
