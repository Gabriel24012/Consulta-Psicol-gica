import { Injectable, signal } from '@angular/core';
import { Router } from '@angular/router';
import { AuthUser } from '@itzel/shared';
import { Observable, catchError, finalize, map, of, shareReplay, tap } from 'rxjs';
import { ApiService } from './api.service';

interface AuthResponse {
  user: AuthUser;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  readonly currentUser = signal<AuthUser | null>(null);
  private sessionRequest?: Observable<AuthUser | null>;

  constructor(
    private readonly api: ApiService,
    private readonly router: Router,
  ) {}

  login(email: string, password: string) {
    return this.api.post<AuthResponse>('/auth/login', { email, password });
  }

  register(input: { name: string; email: string; phone: string; password: string; privacyConsentAccepted: boolean }) {
    return this.api.post<AuthResponse>('/auth/register', input);
  }

  acceptSession(response: AuthResponse) {
    this.currentUser.set(response.user);
    void this.router.navigateByUrl(response.user.role === 'admin' ? '/admin' : '/paciente');
  }

  ensureSession() {
    if (this.currentUser()) {
      return of(this.currentUser());
    }
    if (this.sessionRequest) {
      return this.sessionRequest;
    }

    this.sessionRequest = this.api.get<AuthUser>('/auth/me').pipe(
      catchError(() => this.api.post<AuthResponse>('/auth/refresh', {}).pipe(map((response) => response.user))),
      tap((user) => this.currentUser.set(user)),
      catchError(() => {
        this.currentUser.set(null);
        return of(null);
      }),
      finalize(() => {
        this.sessionRequest = undefined;
      }),
      shareReplay(1),
    );

    return this.sessionRequest;
  }

  refreshSession() {
    return this.api.post<AuthResponse>('/auth/refresh', {}).pipe(
      map((response) => response.user),
      tap((user) => this.currentUser.set(user)),
    );
  }

  logout() {
    this.api.post('/auth/logout', {}).subscribe({
      next: () => this.clearLocalSession(),
      error: () => this.clearLocalSession(),
    });
  }

  private clearLocalSession() {
    this.currentUser.set(null);
    void this.router.navigateByUrl('/');
  }
}
