import { Injectable, signal } from '@angular/core';
import { Router } from '@angular/router';
import { AuthUser } from '@itzel/shared';
import { ApiService } from './api.service';

interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  user: AuthUser;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  readonly currentUser = signal<AuthUser | null>(this.readUser());
  readonly accessToken = signal<string | null>(localStorage.getItem('accessToken'));

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
    localStorage.setItem('accessToken', response.accessToken);
    localStorage.setItem('user', JSON.stringify(response.user));
    this.accessToken.set(response.accessToken);
    this.currentUser.set(response.user);
    void this.router.navigateByUrl(response.user.role === 'admin' ? '/admin' : '/paciente');
  }

  logout() {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('user');
    this.accessToken.set(null);
    this.currentUser.set(null);
    void this.router.navigateByUrl('/');
  }

  private readUser(): AuthUser | null {
    const raw = localStorage.getItem('user');
    return raw ? (JSON.parse(raw) as AuthUser) : null;
  }
}
