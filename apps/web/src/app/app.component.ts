import { Component, signal } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from './core/auth.service';

@Component({
  selector: 'itzel-root',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, RouterOutlet],
  template: `
    <header class="topbar" [class.menu-open]="menuOpen()">
      <div class="topbar-row">
        <a routerLink="/" class="brand" (click)="closeMenu()">
          <span class="brand-mark">IP</span>
          <span>Consulta Psicológica</span>
        </a>

        <button
          class="menu-toggle"
          type="button"
          [attr.aria-expanded]="menuOpen()"
          aria-controls="primary-navigation"
          aria-label="Abrir menu de navegacion"
          (click)="toggleMenu()"
        >
          <span></span>
          <span></span>
          <span></span>
        </button>
      </div>

      <nav id="primary-navigation" [class.open]="menuOpen()">
        <a routerLink="/" routerLinkActive="active-link" [routerLinkActiveOptions]="{ exact: true }" (click)="closeMenu()">Inicio</a>
        @if (!auth.currentUser()) {
          <a routerLink="/acceso" routerLinkActive="active-link" (click)="closeMenu()">Acceso</a>
        }
        @if (auth.currentUser()?.role === 'patient') {
          <a routerLink="/paciente" routerLinkActive="active-link" (click)="closeMenu()">Portal paciente</a>
        }
        @if (auth.currentUser()?.role === 'admin') {
          <a routerLink="/admin" class="admin-link" [class.active-link]="isAdminRoute()" (click)="closeMenu()">Panel admin</a>
          <div class="mobile-admin-links" aria-label="Funciones de administrador">
            <a routerLink="/admin" [queryParams]="{ tab: 'today' }" [class.active-link]="isAdminTab('today')" (click)="closeMenu()">Hoy</a>
            <a routerLink="/admin" [queryParams]="{ tab: 'calendar' }" [class.active-link]="isAdminTab('calendar')" (click)="closeMenu()">Calendario</a>
            <a routerLink="/admin" [queryParams]="{ tab: 'patients' }" [class.active-link]="isAdminTab('patients')" (click)="closeMenu()">Pacientes</a>
            <a routerLink="/admin" [queryParams]="{ tab: 'materials' }" [class.active-link]="isAdminTab('materials')" (click)="closeMenu()">Materiales</a>
            <a routerLink="/admin" [queryParams]="{ tab: 'schedule' }" [class.active-link]="isAdminTab('schedule')" (click)="closeMenu()">Horarios</a>
            <a routerLink="/admin" [queryParams]="{ tab: 'quick-intake' }" [class.active-link]="isAdminTab('quick-intake')" (click)="closeMenu()">Registrar paciente</a>
          </div>
        }
        @if (auth.currentUser()) {
          <button class="logout" type="button" (click)="logout()">Salir</button>
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

      .topbar-row,
      .brand,
      nav,
      .mobile-admin-links {
        display: flex;
        align-items: center;
        gap: 14px;
      }

      .topbar-row {
        min-width: 0;
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

      .menu-toggle {
        display: none;
        width: 42px;
        height: 42px;
        border: 1px solid var(--border);
        border-radius: 8px;
        background: var(--pink-bg);
        color: #8d3159;
        cursor: pointer;
      }

      .menu-toggle span {
        display: block;
        width: 18px;
        height: 2px;
        margin: 4px auto;
        border-radius: 999px;
        background: currentColor;
      }

      nav {
        flex-wrap: wrap;
        justify-content: flex-end;
        font-size: 14px;
        font-weight: 700;
        color: #6c5963;
      }

      nav a,
      .logout {
        min-height: 38px;
        display: inline-flex;
        align-items: center;
        border: 1px solid transparent;
        border-radius: 8px;
        padding: 8px 12px;
      }

      nav a.active-link {
        border-color: var(--border);
        background: var(--pink-bg);
        color: #8d3159;
      }

      .mobile-admin-links {
        display: none;
      }

      .logout {
        border-color: transparent;
        background: var(--gray-100);
        cursor: pointer;
      }

      @media (max-width: 720px) {
        .topbar {
          align-items: stretch;
          flex-direction: row;
          gap: 0;
          padding: 12px clamp(12px, 4vw, 18px);
        }

        .topbar.menu-open::before {
          content: '';
          position: fixed;
          inset: 0;
          z-index: 20;
          background: rgba(74, 58, 66, 0.22);
        }

        .topbar-row {
          width: 100%;
          justify-content: space-between;
          position: relative;
          z-index: 22;
        }

        .brand {
          min-width: 0;
        }

        .brand > span:last-child {
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .menu-toggle {
          display: inline-block;
          flex: 0 0 auto;
        }

        nav {
          position: fixed;
          top: 0;
          right: 0;
          z-index: 21;
          display: flex;
          width: min(82vw, 340px);
          height: 100dvh;
          flex-direction: column;
          align-items: stretch;
          gap: 8px;
          justify-content: flex-start;
          overflow-y: auto;
          border-left: 1px solid var(--border);
          padding: 88px 16px 18px;
          background: rgba(255, 255, 255, 0.98);
          box-shadow: -18px 0 45px rgba(80, 62, 72, 0.16);
          transform: translateX(100%);
          transition: transform 180ms ease;
          will-change: transform;
        }

        nav.open {
          transform: translateX(0);
        }

        nav a,
        .logout {
          justify-content: flex-start;
          width: 100%;
          min-height: 44px;
        }

        .mobile-admin-links {
          display: grid;
          grid-template-columns: 1fr;
          gap: 8px;
          margin-top: 2px;
          border-top: 1px solid var(--border);
          padding-top: 10px;
        }
      }
    `,
  ],
})
export class AppComponent {
  readonly menuOpen = signal(false);

  constructor(
    public readonly auth: AuthService,
    private readonly router: Router,
  ) {}

  toggleMenu() {
    this.menuOpen.update((open) => !open);
  }

  closeMenu() {
    this.menuOpen.set(false);
  }

  logout() {
    this.closeMenu();
    this.auth.logout();
  }

  isAdminRoute() {
    return this.router.url.startsWith('/admin');
  }

  isAdminTab(tab: string) {
    if (!this.isAdminRoute()) return false;
    const tree = this.router.parseUrl(this.router.url);
    return (tree.queryParams['tab'] ?? 'today') === tab;
  }
}
