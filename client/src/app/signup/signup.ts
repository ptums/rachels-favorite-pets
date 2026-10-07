import { Component, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { Api } from '../api';
import { describeError } from '../errors';
import { Session } from '../session';

/** Mirrors the API's rules so most mistakes are caught before sending. */
export const USERNAME_PATTERN = /^[A-Za-z0-9_-]{3,32}$/;
export const MIN_PASSWORD_LENGTH = 10;

@Component({
  selector: 'app-signup',
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './signup.html',
})
export class Signup {
  private readonly api = inject(Api);
  private readonly router = inject(Router);
  private readonly session = inject(Session);

  protected readonly minPasswordLength = MIN_PASSWORD_LENGTH;
  protected readonly form = inject(NonNullableFormBuilder).group({
    username: ['', [Validators.required, Validators.pattern(USERNAME_PATTERN)]],
    password: ['', [Validators.required, Validators.minLength(MIN_PASSWORD_LENGTH)]],
  });
  protected readonly submitting = signal(false);
  protected readonly error = signal<string | null>(null);

  protected async submit(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.submitting.set(true);
    this.error.set(null);
    const credentials = this.form.getRawValue();
    try {
      await firstValueFrom(this.api.signup(credentials));
      // Signup does not log in; do it now so the new user lands ready to upload.
      await firstValueFrom(this.api.login(credentials));
      await this.session.refreshUser();
      await this.router.navigateByUrl('/');
    } catch (error) {
      this.error.set(describeError(error, 'signup'));
    } finally {
      this.form.controls.password.reset();
      this.submitting.set(false);
    }
  }
}
