import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  standalone: true,
  imports: [RouterLink],
  template: `
    <main>
      <section class="hero page-shell">
        <div class="hero-copy">
          <p class="eyebrow">Psicoterapia profesional y acompañamiento humano</p>
          <h1>Consulta psicológica privada con agenda digital segura</h1>
          <p class="lead">
            Un espacio cálido para iniciar, continuar y dar seguimiento a tu proceso terapéutico con privacidad,
            claridad y comunicación directa.
          </p>
          <div class="hero-actions">
            <a routerLink="/acceso" class="btn btn-primary">Agendar sesión</a>
            <a href="#servicios" class="btn btn-soft">Conocer servicios</a>
          </div>
        </div>
        <div class="hero-panel" aria-label="Resumen de servicios">
          <div>
            <span class="status-pill">Agenda flexible</span>
            <h2>Sesiones presenciales u online</h2>
            <p>Recordatorios, confirmación de asistencia y comunicación privada desde el portal.</p>
          </div>
          <dl>
            <div><dt>50 min</dt><dd>Duración sugerida</dd></div>
            <div><dt>Privado</dt><dd>Chat interno seguro</dd></div>
            <div><dt>CRM</dt><dd>Seguimiento respetuoso</dd></div>
          </dl>
        </div>
      </section>

      <section id="servicios" class="band">
        <div class="page-shell grid">
          <article>
            <h2>Sobre el psicólogo</h2>
            <p>
              Perfil profesional, especialidades, experiencia y enfoque terapéutico se presentan con lenguaje claro
              para que el paciente entienda cómo será acompañado.
            </p>
          </article>
          <article>
            <h2>Servicios</h2>
            <p>Terapia individual, orientación emocional, seguimiento de procesos y sesiones de continuidad.</p>
          </article>
          <article>
            <h2>Beneficios</h2>
            <p>Agenda sencilla, recordatorios por WhatsApp y un historial básico de sesiones en un solo lugar.</p>
          </article>
        </div>
      </section>

      <section class="page-shell content">
        <div>
          <h2>Preguntas frecuentes</h2>
          <details open>
            <summary>¿El chat sustituye una atención de emergencia?</summary>
            <p>No. El chat es para comunicación administrativa y seguimiento no urgente. En crisis se debe contactar a servicios de emergencia.</p>
          </details>
          <details>
            <summary>¿Mis datos están protegidos?</summary>
            <p>El portal contempla cifrado, control de accesos, aviso de privacidad y registro de consentimiento.</p>
          </details>
          <details>
            <summary>¿Puedo cancelar o reprogramar?</summary>
            <p>Sí, bajo las reglas configuradas por el psicólogo para cuidar la agenda clínica.</p>
          </details>
        </div>
        <aside class="contact card">
          <h2>Contacto</h2>
          <p>Agenda tu primera sesión o ingresa al portal si ya eres paciente.</p>
          <a routerLink="/acceso" class="btn btn-primary">Entrar al portal</a>
          <small>Al registrarte aceptas el aviso de privacidad y el tratamiento de datos para fines administrativos y terapéuticos.</small>
        </aside>
      </section>
    </main>
  `,
  styles: [
    `
      .hero {
        display: grid;
        grid-template-columns: minmax(0, 1.1fr) minmax(320px, 0.75fr);
        gap: 42px;
        align-items: center;
        min-height: calc(100vh - 72px);
        padding: 56px 0;
      }

      .eyebrow {
        color: #9b4669;
        font-weight: 800;
        text-transform: uppercase;
        font-size: 12px;
        letter-spacing: 0;
      }

      h1 {
        max-width: 760px;
        margin: 12px 0 18px;
        color: #3e3439;
        font-size: clamp(42px, 7vw, 76px);
        line-height: 0.98;
        letter-spacing: 0;
      }

      .lead {
        max-width: 650px;
        color: var(--muted);
        font-size: 18px;
        line-height: 1.75;
      }

      .hero-actions {
        display: flex;
        flex-wrap: wrap;
        gap: 12px;
        margin-top: 30px;
      }

      .hero-panel {
        display: grid;
        gap: 28px;
        padding: 28px;
        border: 1px solid var(--border);
        border-radius: 8px;
        background:
          linear-gradient(160deg, rgba(252, 228, 236, 0.8), rgba(255, 255, 255, 0.88)),
          url('https://images.unsplash.com/photo-1519823551278-64ac92734fb1?auto=format&fit=crop&w=900&q=80') center/cover;
        box-shadow: var(--shadow);
        min-height: 450px;
        align-content: end;
      }

      .hero-panel h2,
      .hero-panel p,
      .hero-panel dl {
        background: rgba(255, 255, 255, 0.82);
        border-radius: 8px;
        padding: 10px 12px;
      }

      dl {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 10px;
        margin: 0;
      }

      dt {
        font-weight: 800;
        color: #8d3159;
      }

      dd {
        margin: 4px 0 0;
        color: var(--muted);
        font-size: 13px;
      }

      .band {
        background: var(--gray-50);
        border-block: 1px solid var(--border);
        padding: 52px 0;
      }

      .grid {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 18px;
      }

      article,
      .contact {
        padding: 24px;
      }

      article {
        border-left: 4px solid var(--pink);
        background: var(--white);
        border-radius: 8px;
      }

      .content {
        display: grid;
        grid-template-columns: 1fr 330px;
        gap: 32px;
        padding: 56px 0;
      }

      details {
        padding: 18px 0;
        border-bottom: 1px solid var(--border);
      }

      summary {
        cursor: pointer;
        font-weight: 800;
      }

      .contact {
        display: grid;
        gap: 14px;
        align-content: start;
      }

      small {
        color: var(--muted);
        line-height: 1.6;
      }

      @media (max-width: 900px) {
        .hero,
        .content,
        .grid {
          grid-template-columns: 1fr;
        }

        .hero {
          min-height: auto;
        }
      }
    `,
  ],
})
export class HomeComponent {}
