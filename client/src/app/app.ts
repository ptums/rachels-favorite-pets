import { Component, inject, signal } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { describeError } from './errors';
import { Session } from './session';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App {
  protected readonly session = inject(Session);
  private readonly router = inject(Router);
  protected readonly logoutError = signal<string | null>(null);

  protected async logout(): Promise<void> {
    this.logoutError.set(null);
    try {
      await this.session.logout();
      await this.router.navigateByUrl('/');
    } catch (error) {
      this.logoutError.set(describeError(error, 'login'));
    }
  }
}
