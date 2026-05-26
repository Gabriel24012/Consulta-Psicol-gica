import { DatePipe } from '@angular/common';
import { Component, OnDestroy, OnInit, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { ApiService } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';

interface Slot {
  startAt: string;
  endAt: string;
}

interface Appointment {
  _id: string;
  startAt: string;
  endAt: string;
  status: string;
  reason?: string;
}

interface Suggestion {
  _id: string;
  message: string;
  status: string;
  adminResponse?: string;
  createdAt?: string;
}

interface ChatMessage {
  _id: string;
  senderId: string;
  content: string;
  createdAt?: string;
}

interface NotificationItem {
  _id: string;
  type: string;
  message: string;
  readAt?: string;
  createdAt?: string;
}

interface MaterialFile {
  _id: string;
  originalName: string;
  mimeType: string;
  size: number;
  createdAt?: string;
}

interface MaterialSection {
  _id: string;
  title: string;
  description?: string;
  files: MaterialFile[];
}

interface BookingNotice {
  title: string;
  message: string;
  tone: 'info' | 'success' | 'error';
}

@Component({
  standalone: true,
  imports: [DatePipe, ReactiveFormsModule],
  template: `
    <main class="portal page-shell">
      @if (bookingNotice(); as notice) {
        <aside
          class="booking-toast"
          [class.success]="notice.tone === 'success'"
          [class.error]="notice.tone === 'error'"
          role="status"
          aria-live="polite"
        >
          <div>
            <strong>{{ notice.title }}</strong>
            <p>{{ notice.message }}</p>
          </div>
          <button type="button" aria-label="Cerrar aviso" (click)="closeBookingNotice()">×</button>
        </aside>
      }

      @if (pendingBookingSlot(); as slot) {
        <aside class="booking-confirm" role="dialog" aria-modal="false" aria-label="Confirmar cita">
          <span class="status-pill">Confirmacion {{ bookingConfirmationStep() }} de 2</span>
          <strong>{{ bookingConfirmationStep() === 1 ? 'Revisa tu horario' : 'Ultima confirmacion' }}</strong>
          <p>
            {{ bookingConfirmationStep() === 1
              ? 'Quieres apartar tu sesion para ' + slotDateTimeLabel(slot) + '?'
              : 'Confirmas que deseas reservar esta cita?' }}
          </p>
          <div>
            <button class="btn btn-soft" type="button" [disabled]="bookingSaving()" (click)="cancelBookingConfirmation()">Cancelar</button>
            <button class="btn btn-primary" type="button" [disabled]="bookingSaving()" (click)="continueBookingConfirmation()">
              {{ bookingSaving() ? 'Agendando...' : bookingConfirmationStep() === 1 ? 'Continuar' : 'Reservar' }}
            </button>
          </div>
        </aside>
      }

      @if (selectedAppointmentDetails(); as appointment) {
        <aside class="appointment-detail" role="dialog" aria-modal="false" aria-label="Detalle de sesion">
          <div class="detail-header">
            <div>
              <span class="status-pill">{{ statusLabel(appointment.status) }}</span>
              <strong>Detalle de sesion</strong>
            </div>
            <button type="button" aria-label="Cerrar detalle" (click)="closeAppointmentDetails()">x</button>
          </div>
          <dl>
            <div>
              <dt>Fecha</dt>
              <dd>{{ appointmentDateLabel(appointment.startAt) }}</dd>
            </div>
            <div>
              <dt>Hora</dt>
              <dd>{{ appointment.startAt | date: 'shortTime' }} - {{ appointment.endAt | date: 'shortTime' }}</dd>
            </div>
            <div>
              <dt>Duracion</dt>
              <dd>{{ appointmentDurationLabel(appointment) }}</dd>
            </div>
          </dl>
          <button class="btn btn-primary" type="button" (click)="downloadCalendarInvite(appointment)">Agregar al calendario</button>
        </aside>
      }

      <section class="welcome">
        <div>
          <span class="status-pill">Portal paciente</span>
          <h1>Hola, {{ auth.currentUser()?.name }}</h1>
          <p>Agenda sesiones, consulta tu historial y manten una conversacion privada con tu psicologo.</p>
        </div>
        <div class="notice">
          El chat no debe usarse para emergencias psicologicas o crisis. Si estas en riesgo, contacta servicios de emergencia.
        </div>
      </section>

      @if (notifications().length) {
        <section class="notification-strip" aria-label="Notificaciones">
          <div>
            <span class="status-pill">Notificaciones</span>
            <strong>{{ unreadNotificationsCount() }} nuevas</strong>
          </div>
          <div class="notification-list">
            @for (notification of notifications().slice(0, 3); track notification._id) {
              <article [class.unread]="!notification.readAt">
                <p>{{ notification.message }}</p>
                <small>{{ notificationDateLabel(notification.createdAt) }}</small>
              </article>
            }
          </div>
        </section>
      }

      <section class="layout">
        <article class="card booking-panel" [class.closed]="!bookingOpen()">
          @if (!bookingOpen()) {
            <div class="booking-start">
              <span class="status-pill">Agenda</span>
              <h2>Agenda tu proxima sesion</h2>
              <p>Consulta los dias disponibles del psicologo y elige un horario libre.</p>
              <button class="btn btn-primary" type="button" (click)="openBooking()">Agendar sesion</button>
            </div>
          } @else {
            <div class="booking-top">
              <button class="icon-button" type="button" aria-label="Volver" (click)="bookingOpen.set(false)">&larr;</button>
              <div>
                <h2>Selecciona el dia</h2>
                <p>Consulta psicologica · Sesion individual</p>
              </div>
            </div>

            <div class="calendar-card">
              <div class="month-nav">
                <button class="icon-button" type="button" (click)="previousMonth()" aria-label="Mes anterior">&lsaquo;</button>
                <strong>{{ monthLabel() }}</strong>
                <button class="icon-button" type="button" (click)="nextMonth()" aria-label="Mes siguiente">&rsaquo;</button>
              </div>

              <div class="weekdays">
                @for (weekday of weekdays; track weekday) {
                  <span>{{ weekday }}</span>
                }
              </div>

              <div class="calendar-grid">
                @for (day of calendarDays(); track day.key) {
                  <button
                    type="button"
                    [class.outside]="!day.inMonth"
                    [class.today]="day.isToday"
                    [class.available]="day.available"
                    [class.selected]="day.key === selectedDate()"
                    [disabled]="!day.inMonth || day.isPast"
                    (click)="selectDate(day.key)"
                  >
                    {{ day.label }}
                  </button>
                }
              </div>
            </div>

            <div class="time-section">
              <h3>Seleccione horario</h3>

              @if (loadingSlots()) {
                <div class="slot-placeholders" aria-label="Buscando horarios disponibles">
                  <div class="placeholder-row"><span></span><b></b></div>
                  <div class="placeholder-row wide"><span></span><b></b><b></b><b></b></div>
                  <div class="placeholder-row"><span></span><b></b><b></b></div>
                </div>
              } @else {
                @for (group of groupedSlots(); track group.label) {
                  @if (group.slots.length) {
                    <div class="time-group">
                      <span>{{ group.label }}</span>
                      <div>
                        @for (slot of group.slots; track slot.startAt) {
                          <button
                            type="button"
                            [class.selected-time]="selectedSlot()?.startAt === slot.startAt"
                            (click)="selectedSlot.set(slot)"
                          >
                            {{ slot.startAt | date: 'shortTime' }}
                          </button>
                        }
                      </div>
                    </div>
                  }
                }

                @if (!slots().length) {
                  <p class="empty-slots">No hay horarios disponibles para este dia. Prueba con otra fecha del calendario.</p>
                }
              }
            </div>

            <button class="continue-button" type="button" [disabled]="!selectedSlot() || bookingSaving()" (click)="confirmSelectedSlot()">
              {{ bookingSaving() ? 'Agendando...' : 'Continuar' }} <span>&rarr;</span>
            </button>
          }
        </article>

        <article class="card panel">
          <h2>Proximas sesiones</h2>
          <div class="list">
            @for (appointment of upcomingAppointments(); track appointment._id) {
              <button class="row appointment-row" type="button" (click)="openAppointmentDetails(appointment)">
                <div>
                  <strong>{{ appointmentDateLabel(appointment.startAt) }}</strong>
                  <span>{{ appointment.startAt | date: 'shortTime' }} - {{ appointment.endAt | date: 'shortTime' }}</span>
                </div>
                <span class="status-pill">{{ statusLabel(appointment.status) }}</span>
              </button>
            } @empty {
              <p class="muted">No tienes sesiones proximas pendientes o confirmadas.</p>
            }
          </div>

          <div class="history-block">
            <h3>Historial de sesiones</h3>
            @if (historicalSummary(); as summary) {
              @if (summary.total) {
                <div class="history-summary">
                  <p>{{ summary.total }} {{ summary.total === 1 ? 'sesion en historial' : 'sesiones en historial' }}</p>
                  @if (summary.latest; as latest) {
                    <div class="row history-row">
                      <div>
                        <strong>Ultima sesion</strong>
                        <span>{{ appointmentDateLabel(latest.startAt) }} · {{ latest.startAt | date: 'shortTime' }}</span>
                      </div>
                      <span class="status-pill">{{ statusLabel(latest.status) }}</span>
                    </div>
                  }
                  <button class="btn btn-soft history-toggle" type="button" (click)="historyExpanded.set(!historyExpanded())">
                    {{ historyExpanded() ? 'Ocultar historial' : 'Ver historial' }}
                  </button>
                </div>

                @if (historyExpanded()) {
                  <div class="list history-list">
                    @for (appointment of historicalAppointments(); track appointment._id) {
                      <div class="row history-row">
                        <div>
                          <strong>{{ appointmentDateLabel(appointment.startAt) }}</strong>
                          <span>{{ appointment.startAt | date: 'shortTime' }} - {{ appointment.endAt | date: 'shortTime' }}</span>
                        </div>
                        <span class="status-pill">{{ statusLabel(appointment.status) }}</span>
                      </div>
                    }
                  </div>
                }
              } @else {
                <p class="muted">Aun no hay sesiones en tu historial.</p>
              }
            }
          </div>
        </article>
      </section>

      <section class="layout bottom">
        <article class="chat-placeholder">
          <div class="legacy-chat">
            <h2>Chat privado</h2>
            <div class="messages">
            @for (item of chatTimeline(); track item.key) {
              @if (item.type === 'day') {
                <div class="day-divider">{{ item.label }}</div>
              } @else {
                <p [class.mine]="item.message.senderId === auth.currentUser()?.sub">
                  <span>{{ item.message.content }}</span>
                  <small>{{ messageTimeLabel(item.message.createdAt) }}</small>
                </p>
              }
            } @empty {
              <p class="muted">Inicia una conversacion privada y no urgente.</p>
            }
          </div>
          <form class="compose" [formGroup]="messageForm" (ngSubmit)="sendMessage()">
            <input class="input" formControlName="content" placeholder="Escribe un mensaje">
            <button class="btn btn-primary" type="submit" [disabled]="messageForm.invalid || sendingMessage()">Enviar</button>
          </form>
          @if (chatStatus()) {
            <p class="form-status" [class.error-status]="chatError()">{{ chatStatus() }}</p>
          }
          </div>
        </article>

        <section class="materials-panel card">
          <div class="materials-header">
            <div>
              <span class="status-pill">Materiales</span>
              <h2>Biblioteca asignada</h2>
            </div>
            <button class="btn btn-soft" type="button" (click)="loadMaterials()">Actualizar</button>
          </div>

          <div class="materials-list">
            @for (section of materialSections(); track section._id) {
              <article class="material-section">
                <div>
                  <h3>{{ section.title }}</h3>
                  @if (section.description) {
                    <p>{{ section.description }}</p>
                  }
                </div>
                <div class="material-files">
                  @for (file of section.files; track file._id) {
                    <button class="material-file" type="button" (click)="downloadMaterial(file)">
                      <span>
                        <strong>{{ file.originalName }}</strong>
                        <small>{{ materialFileLabel(file) }}</small>
                      </span>
                      <b>Descargar</b>
                    </button>
                  } @empty {
                    <p class="muted">Esta sección aún no tiene archivos disponibles.</p>
                  }
                </div>
              </article>
            } @empty {
              <p class="muted">Aún no tienes materiales asignados.</p>
            }
          </div>
        </section>

        <article class="card panel">
          <h2>Sugerencias o comentarios</h2>
          <form class="suggestion" [formGroup]="suggestionForm" (ngSubmit)="sendSuggestion()">
            <textarea class="input" rows="5" formControlName="message" placeholder="Comparte una duda administrativa o sugerencia"></textarea>
            <button class="btn btn-primary" type="submit" [disabled]="suggestionForm.invalid || sendingSuggestion()">Enviar sugerencia</button>
          </form>
          @if (suggestionStatus()) {
            <p class="form-status" [class.error-status]="suggestionError()">{{ suggestionStatus() }}</p>
          }
          <div class="suggestion-list">
            @for (suggestion of suggestions(); track suggestion._id) {
              <div class="suggestion-item">
                <p>{{ suggestion.message }}</p>
                <span class="status-pill">{{ suggestionStatusLabel(suggestion.status) }}</span>
              </div>
            } @empty {
              <p class="muted">Aun no has enviado sugerencias.</p>
            }
          </div>
        </article>
      </section>
    </main>

    <aside class="chat-dock" [class.open]="chatOpen()">
      @if (chatOpen()) {
        <section class="chat-window" aria-label="Chat privado con psicologo">
          <header class="chat-header">
            <div>
              <span class="avatar">Ps</span>
              <div>
                <strong>Tu psicologo</strong>
                <small>Chat privado</small>
              </div>
            </div>
            <button class="dock-icon" type="button" aria-label="Cerrar chat" (click)="chatOpen.set(false)">x</button>
          </header>

          <div class="messages dock-messages">
            @for (item of chatTimeline(); track item.key) {
              @if (item.type === 'day') {
                <div class="day-divider">{{ item.label }}</div>
              } @else {
                <p [class.mine]="item.message.senderId === auth.currentUser()?.sub">
                  <span>{{ item.message.content }}</span>
                  <small>{{ messageTimeLabel(item.message.createdAt) }}</small>
                </p>
              }
            } @empty {
              <p class="muted">Inicia una conversacion privada y no urgente.</p>
            }
          </div>

          <form class="compose dock-compose" [formGroup]="messageForm" (ngSubmit)="sendMessage()">
            <input class="input" formControlName="content" placeholder="Escribe un mensaje">
            <button class="btn btn-primary" type="submit" [disabled]="messageForm.invalid || sendingMessage()">Enviar</button>
          </form>

          @if (chatStatus()) {
            <p class="form-status dock-status" [class.error-status]="chatError()">{{ chatStatus() }}</p>
          }
        </section>
      } @else {
        <button class="chat-bubble" type="button" aria-label="Abrir chat privado" (click)="chatOpen.set(true)">
          <span>Chat</span>
        </button>
      }
    </aside>
  `,
  styles: [
    `
      .portal {
        padding: 34px 0 64px;
      }

      .welcome {
        display: grid;
        grid-template-columns: 1fr minmax(260px, 380px);
        gap: 22px;
        align-items: end;
        margin-bottom: 24px;
      }

      h1 {
        margin: 14px 0 10px;
        font-size: clamp(34px, 5vw, 56px);
        line-height: 1;
      }

      .notice {
        padding: 16px;
        border-radius: 8px;
        background: #fff4f7;
        border: 1px solid var(--border);
        color: #744058;
        line-height: 1.5;
        font-weight: 700;
      }

      .booking-toast,
      .booking-confirm,
      .appointment-detail {
        position: fixed;
        right: 22px;
        top: 22px;
        z-index: 30;
        width: min(360px, calc(100vw - 32px));
        border: 1px solid #f0c9d8;
        border-left: 5px solid #d85f8d;
        border-radius: 8px;
        padding: 14px 16px;
        background: #fff7fa;
        box-shadow: 0 18px 45px rgba(112, 51, 76, 0.16);
        color: #3e3439;
      }

      .booking-toast {
        display: flex;
        gap: 12px;
        align-items: flex-start;
        justify-content: space-between;
      }

      .booking-toast.success {
        border-left-color: #4b9b76;
        background: #f3fff9;
      }

      .booking-toast.error {
        border-left-color: #b94777;
        background: #fff4f7;
      }

      .booking-toast strong,
      .booking-confirm strong,
      .appointment-detail strong {
        display: block;
        margin-bottom: 4px;
        color: #8d3159;
        font-size: 15px;
      }

      .booking-toast p,
      .booking-confirm p {
        margin: 0;
        color: #744058;
        line-height: 1.45;
        font-weight: 700;
      }

      .booking-toast button[aria-label],
      .appointment-detail button[aria-label] {
        width: 28px;
        height: 28px;
        border: 0;
        border-radius: 8px;
        background: #fce4ec;
        color: #8d3159;
        cursor: pointer;
        font-size: 20px;
        line-height: 1;
      }

      .booking-confirm {
        display: grid;
        gap: 10px;
      }

      .booking-confirm .status-pill {
        width: max-content;
      }

      .booking-confirm > div {
        display: flex;
        justify-content: flex-end;
        gap: 10px;
      }

      .appointment-detail {
        top: 118px;
        display: grid;
        gap: 14px;
      }

      .detail-header {
        display: flex;
        justify-content: space-between;
        gap: 12px;
        align-items: flex-start;
      }

      .detail-header > div {
        display: grid;
        gap: 7px;
      }

      .appointment-detail dl {
        display: grid;
        gap: 10px;
        margin: 0;
      }

      .appointment-detail dl > div {
        display: flex;
        justify-content: space-between;
        gap: 16px;
        border-radius: 8px;
        padding: 10px 12px;
        background: #fff;
      }

      .appointment-detail dt {
        color: #9b7890;
        font-weight: 800;
      }

      .appointment-detail dd {
        margin: 0;
        color: #3e3439;
        font-weight: 800;
        text-align: right;
      }

      .layout {
        display: grid;
        grid-template-columns: 1.1fr 0.9fr;
        gap: 18px;
        align-items: start;
      }

      .notification-strip {
        display: grid;
        grid-template-columns: minmax(180px, 240px) 1fr;
        gap: 14px;
        align-items: start;
        margin-bottom: 18px;
        border: 1px solid var(--border);
        border-radius: 8px;
        padding: 16px;
        background: var(--white);
      }

      .notification-strip > div:first-child {
        display: grid;
        gap: 8px;
      }

      .notification-strip strong {
        color: #3e3439;
        font-size: 20px;
      }

      .notification-list {
        display: grid;
        gap: 10px;
      }

      .notification-list article {
        border-radius: 8px;
        padding: 12px;
        background: var(--gray-50);
      }

      .notification-list article.unread {
        border-left: 4px solid #8d3159;
        background: #fff7fa;
      }

      .notification-list p {
        margin: 0 0 6px;
        color: var(--text);
        font-weight: 800;
        line-height: 1.4;
      }

      .notification-list small {
        color: var(--muted);
        font-weight: 700;
      }

      .bottom {
        margin-top: 18px;
        grid-template-columns: 1fr;
      }

      .panel {
        padding: 22px;
      }

      .materials-panel {
        margin-top: 18px;
        padding: 22px;
      }

      .materials-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 16px;
        margin-bottom: 16px;
      }

      .materials-header h2 {
        margin: 8px 0 0;
        color: #3e3439;
        font-size: 24px;
      }

      .materials-list,
      .material-section,
      .material-files {
        display: grid;
        gap: 12px;
      }

      .material-section {
        border: 1px solid var(--border);
        border-radius: 8px;
        padding: 16px;
        background: #fffafb;
      }

      .material-section h3 {
        margin: 0 0 6px;
        color: #4a3740;
        font-size: 20px;
      }

      .material-section p {
        margin: 0;
        color: var(--muted);
        line-height: 1.45;
        font-weight: 700;
      }

      .material-file {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 14px;
        width: 100%;
        border: 1px solid var(--border);
        border-radius: 8px;
        padding: 13px;
        background: var(--white);
        color: var(--text);
        cursor: pointer;
        text-align: left;
      }

      .material-file strong,
      .material-file small {
        display: block;
      }

      .material-file small {
        margin-top: 4px;
        color: var(--muted);
        font-weight: 750;
      }

      .material-file b {
        color: #8d3159;
      }

      .booking-panel {
        overflow: hidden;
      }

      .booking-panel.closed {
        padding: 0;
      }

      .booking-start {
        display: grid;
        gap: 14px;
        min-height: 280px;
        align-content: center;
        padding: 34px;
        background: linear-gradient(150deg, #fff, #fff4f8);
      }

      .booking-start h2 {
        margin: 0;
        color: #3e3439;
        font-size: 30px;
      }

      .booking-start p {
        max-width: 520px;
        margin: 0;
        color: var(--muted);
        line-height: 1.6;
      }

      .booking-start .btn {
        width: max-content;
      }

      .booking-top {
        display: flex;
        align-items: center;
        gap: 18px;
        padding: 26px 24px 22px;
        background: #fff7fa;
        border-bottom: 4px solid #d85f8d;
      }

      .booking-top h2 {
        margin: 0 0 6px;
        color: #8d3159;
        font-size: 25px;
      }

      .booking-top p {
        margin: 0;
        color: #a36b83;
        font-weight: 700;
      }

      .icon-button {
        display: grid;
        place-items: center;
        width: 40px;
        height: 40px;
        border: 1px solid #f0c9d8;
        border-radius: 8px;
        background: var(--white);
        color: #d85f8d;
        cursor: pointer;
        font-size: 30px;
        line-height: 1;
      }

      .calendar-card {
        padding: 18px 24px 24px;
        background: #fffafb;
        border-bottom: 1px solid var(--border);
      }

      .month-nav {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: 20px;
      }

      .month-nav strong {
        color: #8d3159;
        font-size: 24px;
      }

      .weekdays,
      .calendar-grid {
        display: grid;
        grid-template-columns: repeat(7, 1fr);
        text-align: center;
      }

      .weekdays {
        color: #9b7890;
        font-weight: 700;
        margin-bottom: 12px;
      }

      .calendar-grid {
        row-gap: 8px;
      }

      .calendar-grid button {
        justify-self: center;
        width: 40px;
        height: 40px;
        border: 0;
        border-radius: 10px;
        background: transparent;
        color: #b23f70;
        cursor: pointer;
        font-size: 17px;
        font-weight: 800;
      }

      .calendar-grid button:disabled {
        cursor: default;
      }

      .calendar-grid .outside,
      .calendar-grid button:disabled {
        color: #dfd7dc;
      }

      .calendar-grid .today {
        background: #f2d9e3;
      }

      .calendar-grid .available {
        box-shadow: inset 0 -4px 0 #d85f8d;
      }

      .calendar-grid .selected {
        background: #8d3159;
        color: var(--white);
        box-shadow: none;
      }

      .time-section {
        padding: 24px;
      }

      .time-section h3 {
        margin: 0 0 18px;
        color: #171218;
        font-size: 20px;
      }

      .time-group {
        display: grid;
        grid-template-columns: 100px 1fr;
        gap: 24px;
        align-items: start;
        margin-bottom: 18px;
      }

      .time-group > span {
        padding-top: 14px;
        color: #9b7890;
        font-weight: 800;
      }

      .time-group div {
        display: flex;
        flex-wrap: wrap;
        gap: 10px;
      }

      .time-group button {
        min-width: 96px;
        border: 0;
        border-radius: 8px;
        padding: 16px 18px;
        background: #d85f8d;
        color: var(--white);
        cursor: pointer;
        font-weight: 900;
      }

      .time-group .selected-time {
        outline: 3px solid #8d3159;
        background: #b94777;
      }

      .slot-placeholders {
        display: grid;
        gap: 22px;
      }

      .placeholder-row {
        display: flex;
        align-items: center;
        gap: 12px;
      }

      .placeholder-row span {
        width: 92px;
        height: 18px;
        border-radius: 999px;
        background: #eadce1;
      }

      .placeholder-row b {
        width: 96px;
        height: 56px;
        border-radius: 8px;
        background: linear-gradient(90deg, #f8eef3, #f8bbd0, #f8eef3);
        background-size: 220% 100%;
        animation: shimmer 1.15s infinite linear;
      }

      .placeholder-row.wide b {
        width: 104px;
      }

      .empty-slots {
        margin: 0;
        padding: 16px;
        border-radius: 8px;
        background: #fff7fa;
        color: var(--muted);
        line-height: 1.5;
      }

      .continue-button {
        width: calc(100% - 48px);
        margin: 0 24px 24px;
        border: 0;
        border-radius: 8px;
        padding: 18px;
        background: #d85f8d;
        color: var(--white);
        cursor: pointer;
        font-size: 24px;
        font-weight: 900;
      }

      .continue-button:disabled {
        background: #d9e2ef;
        cursor: default;
      }

      .continue-button span {
        font-size: 28px;
      }

      @keyframes shimmer {
        to {
          background-position: -220% 0;
        }
      }

      .compose {
        display: grid;
        grid-template-columns: 1fr auto;
        gap: 10px;
      }

      .list,
      .messages {
        display: grid;
        gap: 10px;
      }

      .row {
        display: flex;
        width: 100%;
        justify-content: space-between;
        align-items: center;
        gap: 12px;
        padding: 12px;
        border: 0;
        border-radius: 8px;
        background: var(--gray-50);
        color: inherit;
        text-align: left;
      }

      .row div {
        display: grid;
        gap: 3px;
      }

      .appointment-row {
        cursor: pointer;
      }

      .appointment-row:hover,
      .appointment-row:focus-visible {
        outline: 2px solid #f0c9d8;
        background: #fff7fa;
      }

      .history-block {
        margin-top: 24px;
        padding-top: 20px;
        border-top: 1px solid var(--border);
      }

      .history-block h3 {
        margin: 0 0 12px;
      }

      .history-row {
        background: #fff7fa;
      }

      .history-summary {
        display: grid;
        gap: 12px;
      }

      .history-summary p {
        margin: 0;
        color: var(--muted);
        font-weight: 800;
        line-height: 1.45;
      }

      .history-toggle {
        justify-self: start;
      }

      .history-list {
        margin-top: 12px;
      }

      .muted,
      .row span {
        color: var(--muted);
      }

      .messages {
        min-height: 220px;
        max-height: 300px;
        overflow: auto;
        padding: 12px;
        border-radius: 8px;
        background: var(--gray-50);
      }

      .messages p {
        display: grid;
        gap: 5px;
        max-width: 82%;
        margin: 0;
        padding: 10px 12px;
        border-radius: 8px;
        background: var(--white);
      }

      .messages p small {
        color: var(--muted);
        font-size: 11px;
        text-align: right;
      }

      .messages .mine {
        margin-left: auto;
        background: var(--pink-bg);
      }

      .chat-placeholder,
      .legacy-chat {
        display: none;
      }

      .day-divider {
        justify-self: center;
        border-radius: 999px;
        padding: 5px 10px;
        background: #fff7fa;
        color: #8d3159;
        font-size: 12px;
        font-weight: 800;
      }

      .compose,
      .suggestion {
        margin-top: 12px;
      }

      .suggestion {
        display: grid;
        gap: 12px;
      }

      .form-status {
        margin: 10px 0 0;
        border-radius: 8px;
        padding: 10px 12px;
        background: #f0fbf1;
        color: #356d38;
        font-weight: 700;
      }

      .error-status {
        background: #fff1f1;
        color: #8b2d2d;
      }

      .suggestion-list {
        display: grid;
        gap: 10px;
        margin-top: 16px;
      }

      .suggestion-item {
        display: grid;
        gap: 8px;
        border: 1px solid var(--border);
        border-radius: 8px;
        padding: 12px;
        background: var(--gray-50);
      }

      .suggestion-item p {
        margin: 0;
        color: var(--text);
        line-height: 1.45;
      }

      .chat-dock {
        position: fixed;
        right: 24px;
        bottom: 24px;
        z-index: 40;
      }

      .chat-bubble {
        min-width: 112px;
        border: 0;
        border-radius: 999px;
        padding: 16px 22px;
        background: #8d3159;
        color: var(--white);
        box-shadow: 0 18px 38px rgba(141, 49, 89, 0.32);
        cursor: pointer;
        font-weight: 900;
      }

      .chat-window {
        display: grid;
        grid-template-rows: auto 1fr auto auto;
        width: min(420px, calc(100vw - 32px));
        height: min(610px, calc(100vh - 48px));
        overflow: hidden;
        border: 1px solid var(--border);
        border-radius: 8px;
        background: var(--white);
        box-shadow: 0 24px 70px rgba(80, 62, 72, 0.22);
      }

      .chat-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 14px 16px;
        border-bottom: 1px solid var(--border);
        background: #fffafb;
      }

      .chat-header > div {
        display: flex;
        align-items: center;
        gap: 12px;
      }

      .avatar {
        display: grid;
        place-items: center;
        width: 38px;
        height: 38px;
        border-radius: 999px;
        background: #fce4ec;
        color: #8d3159;
        font-weight: 900;
      }

      .chat-header small {
        display: block;
        color: var(--muted);
      }

      .dock-icon {
        width: 34px;
        height: 34px;
        border: 0;
        border-radius: 8px;
        background: transparent;
        color: #6b5661;
        cursor: pointer;
        font-weight: 900;
      }

      .dock-messages {
        min-height: 0;
        max-height: none;
        margin: 0;
        border-radius: 0;
      }

      .dock-compose {
        margin: 0;
        padding: 12px;
        border-top: 1px solid var(--border);
        background: #fffafb;
      }

      .dock-status {
        margin: 0 12px 12px;
      }

      @media (max-width: 980px) {
        .welcome,
        .layout,
        .notification-strip,
        .compose {
          grid-template-columns: 1fr;
        }

        .time-group {
          grid-template-columns: 1fr;
          gap: 8px;
        }

        .materials-header,
        .material-file {
          align-items: stretch;
          flex-direction: column;
        }

        .chat-dock {
          right: 12px;
          bottom: 12px;
        }

          .chat-window {
            width: calc(100vw - 24px);
            height: min(620px, calc(100vh - 24px));
          }

          .booking-toast,
          .booking-confirm,
          .appointment-detail {
            top: 12px;
            right: 12px;
          }

          .appointment-detail {
            top: 96px;
          }
        }
    `,
  ],
})
export class PatientPortalComponent implements OnInit, OnDestroy {
  readonly slots = signal<Slot[]>([]);
  readonly loadingSlots = signal(false);
  readonly availableDayKeys = signal<Set<string>>(new Set());
  readonly selectedSlot = signal<Slot | null>(null);
  readonly selectedDate = signal(this.formatDateKey(new Date()));
  readonly visibleMonth = signal(new Date());
  readonly bookingOpen = signal(false);
  readonly bookingSaving = signal(false);
  readonly bookingNotice = signal<BookingNotice | null>(null);
  readonly pendingBookingSlot = signal<Slot | null>(null);
  readonly bookingConfirmationStep = signal(1);
  readonly historyExpanded = signal(false);
  readonly selectedAppointmentDetails = signal<Appointment | null>(null);
  readonly appointments = signal<Appointment[]>([]);
  readonly messages = signal<ChatMessage[]>([]);
  readonly chatOpen = signal(false);
  readonly suggestions = signal<Suggestion[]>([]);
  readonly notifications = signal<NotificationItem[]>([]);
  readonly materialSections = signal<MaterialSection[]>([]);
  readonly chatStatus = signal('');
  readonly chatError = signal(false);
  readonly suggestionStatus = signal('');
  readonly suggestionError = signal(false);
  readonly sendingMessage = signal(false);
  readonly sendingSuggestion = signal(false);
  readonly slotDate = this.fb.control(new Date().toISOString().slice(0, 10), { nonNullable: true });
  readonly weekdays = ['Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sab', 'Dom'];
  readonly messageForm = this.fb.group({ content: ['', Validators.required] });
  readonly suggestionForm = this.fb.group({ message: ['', Validators.required] });
  private notificationRefreshId?: ReturnType<typeof setInterval>;

  constructor(
    public readonly auth: AuthService,
    private readonly api: ApiService,
    private readonly fb: FormBuilder,
  ) {}

  ngOnInit() {
    this.loadAppointments();
    this.loadMessages();
    this.loadSuggestions();
    this.loadNotifications();
    this.loadMaterials();
    this.notificationRefreshId = setInterval(() => this.loadNotifications(), 30000);
    this.loadMonthAvailability();
    this.loadSlots();
  }

  ngOnDestroy() {
    if (this.notificationRefreshId) {
      clearInterval(this.notificationRefreshId);
    }
  }

  openBooking() {
    const existingAppointment = this.nextActiveAppointment();
    if (existingAppointment) {
      this.showBookingNotice(
        'Sesion ya agendada',
        `Ya tienes una sesion agendada para ${this.appointmentDateTimeLabel(existingAppointment)}.`,
        'info',
      );
      return;
    }
    this.bookingOpen.set(true);
    this.loadMonthAvailability();
    this.loadSlots();
  }

  loadSlots() {
    const date = this.selectedDate();
    this.slotDate.setValue(date);
    const from = new Date(`${date}T00:00:00`);
    const to = new Date(`${date}T23:59:59`);
    this.loadingSlots.set(true);
    this.selectedSlot.set(null);
    this.api.get<Slot[]>(`/availability/slots?from=${from.toISOString()}&to=${to.toISOString()}`).subscribe({
      next: (slots) => {
        this.slots.set(this.uniqueSlots(slots));
        this.loadingSlots.set(false);
      },
      error: () => {
        this.slots.set([]);
        this.loadingSlots.set(false);
      },
    });
  }

  confirmSelectedSlot() {
    const slot = this.selectedSlot();
    if (!slot) return;
    const existingAppointment = this.nextActiveAppointment();
    if (existingAppointment) {
      this.showBookingNotice(
        'Sesion ya agendada',
        `Ya tienes una sesion agendada para ${this.appointmentDateTimeLabel(existingAppointment)}.`,
        'info',
      );
      return;
    }
    this.bookingNotice.set(null);
    this.bookingConfirmationStep.set(1);
    this.pendingBookingSlot.set(slot);
  }

  book(slot: Slot) {
    if (this.bookingSaving()) return;
    this.bookingSaving.set(true);
    this.api.post<Appointment>('/appointments', slot).subscribe({
      next: () => {
        this.bookingSaving.set(false);
        this.pendingBookingSlot.set(null);
        this.showBookingNotice('Sesion agendada', `Tu sesion quedo agendada para ${this.slotDateTimeLabel(slot)}.`, 'success');
        this.loadAppointments();
        this.loadMonthAvailability();
        this.loadSlots();
      },
      error: (error: HttpErrorResponse) => {
        this.bookingSaving.set(false);
        this.pendingBookingSlot.set(null);
        const message = typeof error.error?.message === 'string' ? error.error.message : 'No se pudo agendar la sesion. Revisa tus citas activas e intenta de nuevo.';
        this.showBookingNotice('No se pudo agendar', message, 'error');
        this.loadAppointments();
        this.loadMonthAvailability();
        this.loadSlots();
      },
    });
  }

  continueBookingConfirmation() {
    const slot = this.pendingBookingSlot();
    if (!slot) return;
    if (this.bookingConfirmationStep() === 1) {
      this.bookingConfirmationStep.set(2);
      return;
    }
    this.book(slot);
  }

  cancelBookingConfirmation() {
    this.pendingBookingSlot.set(null);
    this.bookingConfirmationStep.set(1);
  }

  closeBookingNotice() {
    this.bookingNotice.set(null);
  }

  showBookingNotice(title: string, message: string, tone: BookingNotice['tone']) {
    this.bookingNotice.set({ title, message, tone });
  }

  selectDate(date: string) {
    this.selectedDate.set(date);
    this.loadSlots();
  }

  previousMonth() {
    const current = this.visibleMonth();
    this.visibleMonth.set(new Date(current.getFullYear(), current.getMonth() - 1, 1));
    this.loadMonthAvailability();
  }

  nextMonth() {
    const current = this.visibleMonth();
    this.visibleMonth.set(new Date(current.getFullYear(), current.getMonth() + 1, 1));
    this.loadMonthAvailability();
  }

  monthLabel() {
    return this.visibleMonth().toLocaleDateString('es-MX', { month: 'long', year: 'numeric' });
  }

  calendarDays() {
    const month = this.visibleMonth();
    const first = new Date(month.getFullYear(), month.getMonth(), 1);
    const startOffset = (first.getDay() + 6) % 7;
    const start = new Date(first);
    start.setDate(first.getDate() - startOffset);
    const todayKey = this.formatDateKey(new Date());

    return Array.from({ length: 42 }, (_, index) => {
      const date = new Date(start);
      date.setDate(start.getDate() + index);
      const key = this.formatDateKey(date);
      return {
        key,
        label: date.getDate(),
        inMonth: date.getMonth() === month.getMonth(),
        isToday: key === todayKey,
        isPast: key < todayKey,
        available: this.availableDayKeys().has(key),
      };
    });
  }

  loadMonthAvailability() {
    const month = this.visibleMonth();
    const from = new Date(month.getFullYear(), month.getMonth(), 1, 0, 0, 0);
    const to = new Date(month.getFullYear(), month.getMonth() + 1, 0, 23, 59, 59);
    this.api.get<Slot[]>(`/availability/slots?from=${from.toISOString()}&to=${to.toISOString()}`).subscribe({
      next: (slots) => {
        this.availableDayKeys.set(new Set(this.uniqueSlots(slots).map((slot) => this.formatDateKey(new Date(slot.startAt)))));
      },
      error: () => this.availableDayKeys.set(new Set()),
    });
  }

  groupedSlots() {
    return [
      { label: 'Manana', slots: this.slots().filter((slot) => new Date(slot.startAt).getHours() < 12) },
      {
        label: 'Mediodia',
        slots: this.slots().filter((slot) => {
          const hour = new Date(slot.startAt).getHours();
          return hour >= 12 && hour < 17;
        }),
      },
      { label: 'Tarde', slots: this.slots().filter((slot) => new Date(slot.startAt).getHours() >= 17) },
    ];
  }

  upcomingAppointments() {
    const now = Date.now();
    return this.appointments()
      .filter((appointment) => {
        const isFuture = new Date(appointment.startAt).getTime() >= now;
        return isFuture && ['pending', 'confirmed'].includes(appointment.status);
      })
      .sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime());
  }

  nextActiveAppointment() {
    return this.upcomingAppointments()[0] ?? null;
  }

  appointmentDateTimeLabel(appointment: Appointment) {
    const start = new Date(appointment.startAt);
    const end = new Date(appointment.endAt);
    return `${this.appointmentDateLabel(appointment.startAt)} de ${start.toLocaleTimeString('es-MX', {
      hour: '2-digit',
      minute: '2-digit',
    })} a ${end.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}`;
  }

  slotDateTimeLabel(slot: Slot) {
    return this.appointmentDateTimeLabel({ _id: '', status: 'confirmed', startAt: slot.startAt, endAt: slot.endAt });
  }

  historicalAppointments() {
    const now = Date.now();
    return this.appointments()
      .filter((appointment) => {
        const isPast = new Date(appointment.startAt).getTime() < now;
        return isPast || ['completed', 'cancelled', 'no_show'].includes(appointment.status);
      })
      .sort((a, b) => new Date(b.startAt).getTime() - new Date(a.startAt).getTime());
  }

  historicalSummary() {
    const appointments = this.historicalAppointments();
    return {
      total: appointments.length,
      latest: appointments[0] ?? null,
    };
  }

  openAppointmentDetails(appointment: Appointment) {
    this.selectedAppointmentDetails.set(appointment);
  }

  closeAppointmentDetails() {
    this.selectedAppointmentDetails.set(null);
  }

  appointmentDurationLabel(appointment: Appointment) {
    const start = new Date(appointment.startAt).getTime();
    const end = new Date(appointment.endAt).getTime();
    const minutes = Math.max(Math.round((end - start) / 60000), 0);
    if (minutes < 60) {
      return `${minutes} minutos`;
    }
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    return remainingMinutes ? `${hours} h ${remainingMinutes} min` : `${hours} h`;
  }

  downloadCalendarInvite(appointment: Appointment) {
    const content = this.buildIcsContent(appointment);
    const blob = new Blob([content], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `sesion-psicologia-${this.formatDateKey(new Date(appointment.startAt))}.ics`;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  buildIcsContent(appointment: Appointment) {
    const start = new Date(appointment.startAt);
    const end = new Date(appointment.endAt);
    const created = new Date();
    const summary = 'Sesion de psicologia';
    const description = appointment.reason?.trim() || 'Sesion agendada desde el portal del paciente.';
    const lines = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Itzel Portal//Appointments//ES',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
      'BEGIN:VEVENT',
      `UID:${this.escapeIcsText(appointment._id || `${appointment.startAt}-${appointment.endAt}`)}@itzel-portal`,
      `DTSTAMP:${this.formatIcsDate(created)}`,
      `DTSTART:${this.formatIcsDate(start)}`,
      `DTEND:${this.formatIcsDate(end)}`,
      `SUMMARY:${this.escapeIcsText(summary)}`,
      `DESCRIPTION:${this.escapeIcsText(description)}`,
      'END:VEVENT',
      'END:VCALENDAR',
    ];
    return `${lines.join('\r\n')}\r\n`;
  }

  formatIcsDate(date: Date) {
    return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
  }

  escapeIcsText(value: string) {
    return value.replace(/\\/g, '\\\\').replace(/\r?\n/g, '\\n').replace(/,/g, '\\,').replace(/;/g, '\\;');
  }

  appointmentDateLabel(value: string) {
    const date = new Date(value);
    const label = date.toLocaleDateString('es-MX', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
    return label.charAt(0).toUpperCase() + label.slice(1);
  }

  statusLabel(status: string) {
    const labels: Record<string, string> = {
      pending: 'Agendada',
      confirmed: 'Agendada',
      cancelled: 'Cancelada',
      completed: 'Completada',
      no_show: 'No asistio',
    };
    return labels[status] ?? status;
  }

  suggestionStatusLabel(status: string) {
    const labels: Record<string, string> = {
      new: 'Nueva',
      reviewed: 'Revisada',
      answered: 'Respondida',
      closed: 'Cerrada',
    };
    return labels[status] ?? status;
  }

  uniqueSlots(slots: Slot[]) {
    return Array.from(new Map(slots.map((slot) => [`${slot.startAt}-${slot.endAt}`, slot])).values());
  }

  formatDateKey(date: Date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  loadAppointments() {
    this.api.get<Appointment[]>('/appointments/me').subscribe((appointments) => this.appointments.set(appointments));
  }

  loadMessages() {
    const patientId = this.auth.currentUser()?.sub;
    if (!patientId) return;
    this.api.get<ChatMessage[]>(`/messages/${patientId}`).subscribe({
      next: (messages) => this.messages.set(this.normalizeMessages(messages)),
      error: () => {
        this.chatError.set(true);
        this.chatStatus.set('No se pudo actualizar el chat. Los mensajes enviados se conservan en pantalla.');
      },
    });
  }

  loadSuggestions() {
    this.api.get<Suggestion[]>('/suggestions').subscribe({
      next: (suggestions) => this.suggestions.set(suggestions),
      error: () => this.suggestions.set([]),
    });
  }

  loadNotifications() {
    this.api.get<NotificationItem[]>('/notifications').subscribe({
      next: (notifications) => this.notifications.set(notifications),
      error: () => this.notifications.set([]),
    });
  }

  loadMaterials() {
    this.api.get<MaterialSection[]>('/materials/me').subscribe({
      next: (sections) => this.materialSections.set(sections),
      error: () => this.materialSections.set([]),
    });
  }

  downloadMaterial(file: MaterialFile) {
    window.open(`/api/materials/files/${file._id}/download`, '_blank');
  }

  materialFileLabel(file: MaterialFile) {
    return `${this.materialKind(file)} · ${this.formatBytes(file.size)}`;
  }

  materialKind(file: MaterialFile) {
    if (file.mimeType === 'application/pdf') return 'PDF';
    if (file.mimeType.includes('wordprocessingml')) return 'DOCX';
    if (file.mimeType.includes('msword')) return 'DOC';
    return 'Archivo';
  }

  formatBytes(size: number) {
    if (size < 1024 * 1024) return `${Math.max(1, Math.round(size / 1024))} KB`;
    return `${(size / 1024 / 1024).toFixed(1)} MB`;
  }

  unreadNotificationsCount() {
    return this.notifications().filter((notification) => !notification.readAt).length;
  }

  notificationDateLabel(value?: string) {
    return (value ? new Date(value) : new Date()).toLocaleString('es-MX', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  sendMessage() {
    const patientId = this.auth.currentUser()?.sub;
    const content = this.messageForm.value.content;
    if (!patientId || !content) return;
    this.sendingMessage.set(true);
    this.chatStatus.set('');
    this.chatError.set(false);
    this.api.post<ChatMessage>('/messages', { patientId, content }).subscribe((message) => {
      this.sendingMessage.set(false);
      this.messages.update((messages) => this.normalizeMessages([...messages, message]));
      this.messageForm.reset();
      this.chatStatus.set('Mensaje enviado.');
    }, () => {
      this.sendingMessage.set(false);
      this.chatError.set(true);
      this.chatStatus.set('No se pudo enviar el mensaje. Intenta de nuevo.');
    });
  }

  sendSuggestion() {
    const message = this.suggestionForm.value.message;
    if (!message) return;
    this.sendingSuggestion.set(true);
    this.suggestionStatus.set('');
    this.suggestionError.set(false);
    this.api.post('/suggestions', { message }).subscribe(() => {
      this.sendingSuggestion.set(false);
      this.suggestionForm.reset();
      this.suggestionStatus.set('Sugerencia enviada al psicologo.');
      this.loadSuggestions();
    }, () => {
      this.sendingSuggestion.set(false);
      this.suggestionError.set(true);
      this.suggestionStatus.set('No se pudo enviar la sugerencia. Intenta de nuevo.');
    });
  }

  normalizeMessages(messages: ChatMessage[]) {
    return messages
      .filter((message) => message && message._id)
      .map((message) => ({
        ...message,
        senderId: String(message.senderId),
        content: message.content ?? '',
      }));
  }

  chatTimeline() {
    const items: Array<
      | { type: 'day'; key: string; label: string }
      | { type: 'message'; key: string; message: ChatMessage }
    > = [];
    let lastDay = '';

    for (const message of this.messages()) {
      const dayKey = this.messageDayKey(message.createdAt);
      if (dayKey !== lastDay) {
        items.push({ type: 'day', key: `day-${dayKey}`, label: this.messageDayLabel(message.createdAt) });
        lastDay = dayKey;
      }
      items.push({ type: 'message', key: message._id, message });
    }

    return items;
  }

  messageDayKey(value?: string) {
    return this.formatDateKey(value ? new Date(value) : new Date());
  }

  messageDayLabel(value?: string) {
    const date = value ? new Date(value) : new Date();
    const label = date.toLocaleDateString('es-MX', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
    return label.charAt(0).toUpperCase() + label.slice(1);
  }

  messageTimeLabel(value?: string) {
    return (value ? new Date(value) : new Date()).toLocaleTimeString('es-MX', {
      hour: '2-digit',
      minute: '2-digit',
    });
  }
}
