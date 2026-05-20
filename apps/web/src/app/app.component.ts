import { Component } from '@angular/core';
import { RouterLink, RouterOutlet } from '@angular/router';
import { AuthService } from './core/auth.service';

@Component({
  selector: 'itzel-root',
  standalone: true,
  imports: [RouterLink, RouterOutlet],
  template: `
    <header class="topbar">
      <a routerLink="/" class="brand">
        <span class="brand-mark">IP</span>
        <span>Consulta Psicológica</span>
      </a>
      <nav>
        <a routerLink="/">Inicio</a>
        @if (!auth.currentUser()) {
          <a routerLink="/acceso">Acceso</a>
        }
        @if (auth.currentUser()?.role === 'patient') {
          <a routerLink="/paciente">Portal paciente</a>
        }
        @if (auth.currentUser()?.role === 'admin') {
          <a routerLink="/admin">Panel admin</a>
        }
        @if (auth.currentUser()) {
          <button class="logout" type="button" (click)="auth.logout()">Salir</button>
        }
      </nav>
    </header>
    <router-outlet />
  `,
  styles: [
    `
      .topbar {
        position: sticky;
        top: 0;
        z-index: 20;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 20px;
        padding: 16px clamp(16px, 4vw, 48px);
        background: rgba(255, 255, 255, 0.88);
        border-bottom: 1px solid var(--border);
        backdrop-filter: blur(14px);
      }

      .brand,
      nav {
        display: flex;
        align-items: center;
        gap: 14px;
      }

      .brand {
        font-weight: 800;
      }

      .brand-mark {
        display: grid;
        place-items: center;
        width: 38px;
        height: 38px;
        border-radius: 8px;
        background: var(--pink);
        color: #73314c;
      }

      nav {
        flex-wrap: wrap;
        justify-content: flex-end;
        font-size: 14px;
        font-weight: 700;
        color: #6c5963;
      }

      .logout {
        border: 0;
        border-radius: 8px;
        padding: 8px 12px;
        background: var(--gray-100);
        cursor: pointer;
      }

      @media (max-width: 720px) {
        .topbar {
          align-items: flex-start;
          flex-direction: column;
        }

        nav {
          justify-content: flex-start;
        }
      }
    `,
  ],
})
export class AppComponent {
  constructor(public readonly auth: AuthService) {}
}
