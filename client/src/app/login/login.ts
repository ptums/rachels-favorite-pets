import { Component, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { Api } from '../api';
import { describeError } from '../errors';
import { Session } from '../session';

@Component({
  selector: 'app-login',
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './login.html',
})
export class Login {
  private readonly api = inject(Api);
  private readonly router = inject(Router);
  protected readonly session = inject(Session);

  protected readonly form = inject(NonNullableFormBuilder).group({
    username: ['', Validators.required],
    password: ['', Validators.required],
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
    try {
      await firstValueFrom(this.api.login(this.form.getRawValue()));
      await this.session.refreshUser();
      await this.router.navigateByUrl('/');
    } catch (error) {
      this.error.set(describeError(error, 'login'));
    } finally {
      // The password lives only in this form control; clear it either way.
      this.form.controls.password.reset();
      this.submitting.set(false);
    }
  }
}
