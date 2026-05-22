import { Component, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { AuthService } from '../../core/auth.service';

@Component({
  standalone: true,
  imports: [ReactiveFormsModule],
  template: `
    <main class="auth page-shell">
      <section>
        <span class="status-pill">Acceso seguro</span>
        <h1>{{ mode() === 'login' ? 'Iniciar sesion' : 'Crear cuenta de paciente' }}</h1>
        <p>
          Tus datos se tratan conforme al aviso de privacidad. El portal usa control de acceso y esta disenado para
          proteger tu informacion clinica-administrativa.
        </p>
      </section>

      <form class="card" [formGroup]="form" (ngSubmit)="submit()">
        <div class="tabs">
          <button type="button" [class.active]="mode() === 'login'" (click)="setMode('login')">Login</button>
          <button type="button" [class.active]="mode() === 'register'" (click)="setMode('register')">Registro</button>
        </div>

        @if (mode() === 'register') {
          <label>Nombre completo<input class="input" formControlName="name" autocomplete="name"></label>
          <label>
            Telefono
            <input class="input" formControlName="phone" autocomplete="tel">
            @if (controlInvalid('phone')) {
              <span class="field-error">Escribe un telefono valido de 10 digitos.</span>
            }
          </label>
        }

        <label>
          Correo
          <input class="input" formControlName="email" autocomplete="email">
          @if (controlInvalid('email')) {
            <span class="field-error">Escribe un correo valido.</span>
          }
        </label>
        <label>Contrasena<input class="input" type="password" formControlName="password" autocomplete="current-password"></label>

        @if (mode() === 'register') {
          <label class="check">
            <input type="checkbox" formControlName="privacyConsentAccepted">
            Acepto el aviso de privacidad y el tratamiento de mis datos.
          </label>
        }

        @if (error()) {
          <p class="error">{{ error() }}</p>
        }

        <button class="btn btn-primary" type="submit" [disabled]="form.invalid || loading()">
          {{ loading() ? 'Procesando...' : mode() === 'login' ? 'Entrar' : 'Registrarme' }}
        </button>
      </form>
    </main>
  `,
  styles: [
    `
      .auth {
        display: grid;
        grid-template-columns: 1fr 430px;
        gap: 46px;
        align-items: center;
        min-height: calc(100vh - 72px);
        padding: 48px 0;
      }

      h1 {
        margin: 16px 0;
        font-size: clamp(36px, 6vw, 64px);
        line-height: 1;
        color: #3e3439;
      }

      p {
        color: var(--muted);
        line-height: 1.75;
      }

      form {
        display: grid;
        gap: 16px;
        padding: 26px;
      }

      label {
        display: grid;
        gap: 7px;
        font-weight: 700;
      }

      .tabs {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 8px;
        padding: 4px;
        border-radius: 8px;
        background: var(--pink-bg);
      }

      .tabs button {
        border: 0;
        border-radius: 8px;
        padding: 10px;
        background: transparent;
        cursor: pointer;
        font-weight: 800;
      }

      .tabs .active {
        background: var(--white);
        color: #8d3159;
      }

      .check {
        display: flex;
        align-items: flex-start;
        gap: 10px;
        color: var(--muted);
        font-size: 14px;
        line-height: 1.5;
      }

      .error {
        border-radius: 8px;
        padding: 10px 12px;
        background: #fff1f1;
        color: #8b2d2d;
      }

      .field-error {
        color: #8b2d2d;
        font-size: 13px;
        font-weight: 800;
      }

      @media (max-width: 840px) {
        .auth {
          grid-template-columns: 1fr;
        }
      }
    `,
  ],
})
export class AuthComponent {
  readonly mode = signal<'login' | 'register'>('login');
  readonly loading = signal(false);
  readonly error = signal('');
  readonly phonePattern = /^\s*(?:\+?52[\s.-]*)?(?:\(?\d{3}\)?[\s.-]*)\d{3}[\s.-]*\d{4}\s*$/;

  readonly form = this.fb.group({
    name: [''],
    phone: [''],
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required]],
    privacyConsentAccepted: [false],
  });

  constructor(
    private readonly fb: FormBuilder,
    private readonly auth: AuthService,
  ) {}

  setMode(mode: 'login' | 'register') {
    this.mode.set(mode);
    this.error.set('');
    const required = mode === 'register' ? [Validators.required] : [];
    this.form.controls.name.setValidators(required);
    this.form.controls.phone.setValidators(mode === 'register' ? [Validators.required, Validators.pattern(this.phonePattern)] : []);
    this.form.controls.password.setValidators(
      mode === 'register' ? [Validators.required, Validators.minLength(10)] : [Validators.required],
    );
    this.form.controls.privacyConsentAccepted.setValidators(mode === 'register' ? [Validators.requiredTrue] : []);
    this.form.updateValueAndValidity();
  }

  submit() {
    this.loading.set(true);
    this.error.set('');
    const value = this.form.getRawValue();
    const request =
      this.mode() === 'login'
        ? this.auth.login(value.email ?? '', value.password ?? '')
        : this.auth.register({
            name: value.name ?? '',
            email: value.email ?? '',
            phone: value.phone ?? '',
            password: value.password ?? '',
            privacyConsentAccepted: Boolean(value.privacyConsentAccepted),
          });

    request.subscribe({
      next: (response) => {
        this.loading.set(false);
        this.auth.acceptSession(response);
      },
      error: (error) => {
        this.loading.set(false);
        this.error.set(this.humanError(error));
      },
    });
  }

  private humanError(error: any) {
    const status = error?.status;
    const message = error?.error?.message;

    if (status === 0) {
      return 'No se pudo conectar con el servidor. Verifica que la API este corriendo en http://localhost:3000.';
    }

    if (Array.isArray(message)) {
      return message.join(' ');
    }

    return message ?? 'No fue posible completar la solicitud. Revisa los datos e intenta otra vez.';
  }

  controlInvalid(controlName: keyof typeof this.form.controls) {
    const control = this.form.controls[controlName];
    return control.invalid && (control.touched || control.dirty);
  }
}
