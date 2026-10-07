import { HttpErrorResponse } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { Api, AuthMode, CurrentUser, Photo } from './api';

/** Who is logged in and what they may do. Holds no credentials, only what /me returns. */
@Injectable({ providedIn: 'root' })
export class Session {
  private readonly api = inject(Api);

  readonly mode = signal<AuthMode | null>(null);
  readonly user = signal<CurrentUser | null>(null);
  readonly configError = signal(false);

  readonly canUpload = computed(() => this.mode() === 'open' || this.user() !== null);
  readonly canSignup = computed(() => this.mode() === 'accounts');

  canDelete(photo: Photo): boolean {
    const user = this.user();
    if (!user) return false;
    return user.isOwner || photo.uploadedBy === user.username;
  }

  /** Runs once on page load: learn the login mode, then who (if anyone) is logged in. */
  async load(): Promise<void> {
    try {
      this.mode.set((await firstValueFrom(this.api.config())).mode);
    } catch {
      this.configError.set(true);
    }
    await this.refreshUser();
  }

  async refreshUser(): Promise<void> {
    try {
      this.user.set(await firstValueFrom(this.api.me()));
    } catch (error) {
      if (!(error instanceof HttpErrorResponse && error.status === 401)) {
        console.error('Could not load the current user', error);
      }
      this.user.set(null);
    }
  }

  async logout(): Promise<void> {
    await firstValueFrom(this.api.logout());
    this.user.set(null);
  }
}
