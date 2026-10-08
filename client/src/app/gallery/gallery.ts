import { DatePipe } from '@angular/common';
import { Component, ElementRef, OnInit, computed, inject, signal, viewChild } from '@angular/core';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { Api, Photo } from '../api';
import { describeError } from '../errors';
import { Session } from '../session';

export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
export const ALLOWED_TYPES = ['image/jpeg', 'image/png'];

/** Quick check before sending; the API still makes the real decision. */
export function checkFile(file: File): string | null {
  if (!ALLOWED_TYPES.includes(file.type)) return 'Only JPEG and PNG images are allowed.';
  if (file.size === 0) return 'That file is empty.';
  if (file.size > MAX_UPLOAD_BYTES) return 'That file is too large. The limit is 5 MB.';
  return null;
}

@Component({
  selector: 'app-gallery',
  imports: [DatePipe, RouterLink],
  templateUrl: './gallery.html',
  styleUrl: './gallery.css',
})
export class Gallery implements OnInit {
  protected readonly session = inject(Session);
  protected readonly api = inject(Api);

  protected readonly photos = signal<Photo[]>([]);
  protected readonly loading = signal(true);
  protected readonly loadError = signal<string | null>(null);

  /** The original app's "Search for Animal" box: filters by file name. */
  protected readonly query = signal('');
  protected readonly visiblePhotos = computed(() => {
    const query = this.query().trim().toLowerCase();
    return query ? this.photos().filter((p) => p.fileName.toLowerCase().includes(query)) : this.photos();
  });

  protected readonly selectedFile = signal<File | null>(null);
  protected readonly uploading = signal(false);
  protected readonly deletingId = signal<string | null>(null);
  protected readonly error = signal<string | null>(null);
  protected readonly notice = signal<string | null>(null);

  private readonly fileInput = viewChild<ElementRef<HTMLInputElement>>('fileInput');

  ngOnInit(): void {
    if (this.session.canViewPhotos()) void this.load();
  }

  protected async load(): Promise<void> {
    this.loading.set(true);
    this.loadError.set(null);
    try {
      const photos = await firstValueFrom(this.api.photos());
      photos.sort((a, b) => b.uploadedAt.localeCompare(a.uploadedAt));
      this.photos.set(photos);
    } catch (error) {
      this.loadError.set(`Could not load photos. ${describeError(error, 'load')}`);
    } finally {
      this.loading.set(false);
    }
  }

  protected onSearch(event: Event): void {
    this.query.set((event.target as HTMLInputElement).value);
  }

  protected onFileChosen(event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0] ?? null;
    this.notice.set(null);
    this.selectedFile.set(file);
    this.error.set(file ? checkFile(file) : null);
  }

  protected async upload(event: SubmitEvent): Promise<void> {
    event.preventDefault();
    const file = this.selectedFile();
    this.notice.set(null);
    if (!file) {
      this.error.set('Choose a JPEG or PNG image first.');
      return;
    }
    const problem = checkFile(file);
    if (problem) {
      this.error.set(problem);
      return;
    }

    this.uploading.set(true);
    this.error.set(null);
    try {
      await firstValueFrom(this.api.upload(file));
      this.notice.set(`Uploaded ${file.name}.`);
      this.selectedFile.set(null);
      const input = this.fileInput()?.nativeElement;
      if (input) input.value = '';
      if (this.session.canViewPhotos()) await this.load();
    } catch (error) {
      this.error.set(describeError(error, 'upload'));
      await this.refreshIfLoggedOut(error);
    } finally {
      this.uploading.set(false);
    }
  }

  protected async remove(photo: Photo): Promise<void> {
    if (!confirm(`Delete ${photo.fileName}? This cannot be undone.`)) return;

    this.deletingId.set(photo.id);
    this.error.set(null);
    this.notice.set(null);
    try {
      await firstValueFrom(this.api.delete(photo.id));
      this.photos.update((list) => list.filter((p) => p.id !== photo.id));
      this.notice.set(`Deleted ${photo.fileName}.`);
    } catch (error) {
      this.error.set(describeError(error, 'delete'));
      await this.refreshIfLoggedOut(error);
      if ((error as { status?: number }).status === 404) await this.load();
    } finally {
      this.deletingId.set(null);
    }
  }

  /** A 401 means the session ended; update the header and hide controls. */
  private async refreshIfLoggedOut(error: unknown): Promise<void> {
    if ((error as { status?: number }).status === 401) await this.session.refreshUser();
  }
}
