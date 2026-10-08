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
  /** 20 tiles (13 photos, 7 repeated) fill whole rows at both 4 and 5 columns. */
  protected readonly bannerImages = [
    'alpaca2.jpg', 'sloth4.jpg', 'dog6.jpg', 'sloth3.jpg', 'dog5.jpg', 'dog4.jpg', 'alpaca3.jpg',
    'dog2.jpg', 'sloth2.jpg', 'sloth1.jpg', 'dog3.jpg', 'alpaca4.jpg', 'dog1.jpg',
    'sloth4.jpg', 'alpaca2.jpg', 'dog4.jpg', 'sloth1.jpg', 'dog6.jpg', 'alpaca3.jpg', 'dog2.jpg',
  ];

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
