import { Component, OnInit, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { AuthUser } from '@itzel/shared';
import { ApiService } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';

interface InvitationPreview {
  patientId: string;
  name: string;
  expiresAt: string;
}

@Component({
  standalone: true,
  imports: [ReactiveFormsModule],
  template: `
    <main class="complete-profile page-shell">
      <section>
        <span class="status-pill">Perfil pendiente</span>
        <h1>Completa tu perfil</h1>
        <p>Revisa tu nombre y termina tus datos para entrar al portal de paciente.</p>
      </section>

      <form class="card" [formGroup]="form" (ngSubmit)="submit()">
        @if (loading()) {
          <p class="muted-box">Validando link...</p>
        } @else {
          @if (preview(); as invitation) {
            <label>
              Nombre
              <input class="input" formControlName="name" autocomplete="name">
              @if (controlInvalid('name')) {
                <span class="field-error">Escribe tu nombre completo.</span>
              }
            </label>
            <label>
              Correo
              <input class="input" formControlName="email" autocomplete="email">
              @if (controlInvalid('email')) {
                <span class="field-error">Escribe un correo válido.</span>
              }
            </label>
            <label>
              Teléfono
              <input class="input" formControlName="phone" autocomplete="tel">
              @if (controlInvalid('phone')) {
                <span class="field-error">Escribe un teléfono válido de 10 dígitos.</span>
              }
            </label>
            <label>
              Contraseña
              <input class="input" type="password" formControlName="password" autocomplete="new-password">
              @if (controlInvalid('password')) {
                <span class="field-error">La contraseña debe tener mínimo 10 caracteres.</span>
              }
            </label>
            <label class="check">
              <input type="checkbox" formControlName="privacyConsentAccepted">
              Acepto el aviso de privacidad y el tratamiento de mis datos.
            </label>
            @if (controlInvalid('privacyConsentAccepted')) {
              <span class="field-error">Debes aceptar el aviso de privacidad para continuar.</span>
            }
            <small>Este link expira: {{ invitation.expiresAt }}</small>
            <button class="btn btn-primary" type="submit" [disabled]="saving()">
              {{ saving() ? 'Guardando...' : 'Completar perfil' }}
            </button>
          }
        }

        @if (message()) {
          <p class="message" [class.error]="error()">{{ message() }}</p>
        }
      </form>
    </main>
  `,
  styles: [
    `
      .complete-profile {
        display: grid;
        grid-template-columns: 1fr 430px;
        gap: 46px;
        align-items: center;
        min-height: calc(100vh - 72px);
        padding: 48px 0;
      }

      h1 {
        margin: 16px 0;
        color: #3e3439;
        font-size: clamp(36px, 6vw, 64px);
        line-height: 1;
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

      .check {
        display: flex;
        align-items: flex-start;
        gap: 10px;
        color: var(--muted);
        font-size: 14px;
        line-height: 1.5;
      }

      .message,
      .muted-box {
        border-radius: 8px;
        padding: 10px 12px;
        background: #fff7fa;
        color: #74475a;
        font-weight: 800;
      }

      .message.error {
        background: #fff1f1;
        color: #8b2d2d;
      }

      .field-error {
        color: #8b2d2d;
        font-size: 13px;
        font-weight: 800;
      }

      small {
        color: var(--muted);
        font-weight: 750;
      }

      @media (max-width: 840px) {
        .complete-profile {
          grid-template-columns: 1fr;
        }
      }
    `,
  ],
})
export class CompleteProfileComponent implements OnInit {
  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly error = signal(false);
  readonly message = signal('');
  readonly preview = signal<InvitationPreview | null>(null);
  private token = '';

  readonly form = this.fb.group({
    name: ['', [Validators.required]],
    email: ['', [Validators.required, Validators.email]],
    phone: ['', [Validators.required, Validators.pattern(/^\s*(?:\+?52[\s.-]*)?(?:\(?\d{3}\)?[\s.-]*)\d{3}[\s.-]*\d{4}\s*$/)]],
    password: ['', [Validators.required, Validators.minLength(10)]],
    privacyConsentAccepted: [false, [Validators.requiredTrue]],
  });

  constructor(
    private readonly fb: FormBuilder,
    private readonly route: ActivatedRoute,
    private readonly api: ApiService,
    private readonly auth: AuthService,
  ) {}

  ngOnInit() {
    this.token = this.route.snapshot.paramMap.get('token') ?? '';
    this.api.get<InvitationPreview>(`/patient-invitations/${encodeURIComponent(this.token)}`).subscribe({
      next: (preview) => {
        this.preview.set({
          ...preview,
          expiresAt: new Date(preview.expiresAt).toLocaleString('es-MX'),
        });
        this.form.patchValue({ name: preview.name });
        this.loading.set(false);
      },
      error: (error) => {
        this.loading.set(false);
        this.error.set(true);
        this.message.set(this.apiErrorMessage(error, 'No pudimos validar este link.'));
      },
    });
  }

  submit() {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.error.set(true);
      this.message.set('Revisa los campos marcados para completar tu perfil.');
      return;
    }
    this.saving.set(true);
    this.error.set(false);
    this.message.set('');
    this.api.post<{ user: AuthUser }>(`/patient-invitations/${encodeURIComponent(this.token)}/complete`, this.form.getRawValue()).subscribe({
      next: (response) => {
        this.saving.set(false);
        this.auth.acceptSession(response);
      },
      error: (error) => {
        this.saving.set(false);
        this.error.set(true);
        this.message.set(this.apiErrorMessage(error, 'No pudimos completar tu perfil.'));
      },
    });
  }

  private apiErrorMessage(error: any, fallback: string) {
    const message = error?.error?.message;
    return Array.isArray(message) ? message.join(' ') : message ?? fallback;
  }

  controlInvalid(controlName: keyof typeof this.form.controls) {
    const control = this.form.controls[controlName];
    return control.invalid && (control.touched || control.dirty);
  }
}
