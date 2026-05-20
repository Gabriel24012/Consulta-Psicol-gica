import { DatePipe, LowerCasePipe } from '@angular/common';
import { Component, OnInit, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { ApiService } from '../../core/api.service';

interface PatientRow {
  _id: string;
  name: string;
  email: string;
  phone: string;
  profile: {
    patientStatus: string;
    totalSessions: number;
    remainingSessions?: number;
    lastBookedAt?: string;
  };
}

interface AppointmentRow {
  _id: string;
  startAt: string;
  endAt: string;
  status: string;
  patientId?: { name: string };
}

interface CrmSummary {
  totalPatients: number;
  activePatients: number;
  followUpPatients: number;
  inactivePatients: number;
}

interface AvailabilityRule {
  _id: string;
  weekday: number;
  startTime: string;
  endTime: string;
  sessionDurationMinutes: number;
  bufferMinutes: number;
  active: boolean;
}

interface ChatMessage {
  _id: string;
  senderId: string;
  content: string;
  createdAt?: string;
}

@Component({
  standalone: true,
  imports: [DatePipe, LowerCasePipe, ReactiveFormsModule],
  template: `
    <main class="admin page-shell">
      <section class="heading">
        <div>
          <span class="status-pill">Panel administrador</span>
          <h1>Gestión clínica-administrativa</h1>
          <p>Pacientes, agenda, CRM, mensajes y sugerencias desde una vista privada para el psicólogo.</p>
        </div>
        <button class="btn btn-primary" type="button" (click)="refresh()">Actualizar</button>
      </section>

      <section class="metrics">
        <article class="card"><span>Total pacientes</span><strong>{{ summary()?.totalPatients ?? 0 }}</strong></article>
        <article class="card"><span>Activos</span><strong>{{ summary()?.activePatients ?? 0 }}</strong></article>
        <article class="card"><span>Seguimiento</span><strong>{{ summary()?.followUpPatients ?? 0 }}</strong></article>
        <article class="card"><span>Inactivos</span><strong>{{ summary()?.inactivePatients ?? 0 }}</strong></article>
      </section>

      <section class="layout">
        <article class="card panel patients">
          <div class="panel-head">
            <h2>Pacientes</h2>
            <input class="input" placeholder="Buscar paciente" [formControl]="search" (input)="loadPatients()">
          </div>
          <div class="table">
            @for (patient of patients(); track patient._id) {
              <button type="button" class="patient-row" (click)="selectPatient(patient)">
                <span><strong>{{ patient.name }}</strong><small>{{ patient.email }} · {{ patient.phone }}</small></span>
                <span class="status-pill">{{ patient.profile.patientStatus }}</span>
              </button>
            } @empty {
              <p class="muted">No hay pacientes registrados.</p>
            }
          </div>
        </article>

        <article class="card panel">
          <div class="panel-head compact">
            <h2>Calendario de sesiones</h2>
            <span class="status-pill">{{ appointments().length }} citas</span>
          </div>
          <div class="appointments">
            @for (appointment of appointments(); track appointment._id) {
              <div class="appointment">
                <div>
                  <strong>{{ appointment.patientId?.name ?? 'Paciente' }}</strong>
                  <span>{{ appointment.startAt | date: 'mediumDate' }} · {{ appointment.startAt | date: 'shortTime' }} - {{ appointment.endAt | date: 'shortTime' }}</span>
                </div>
                <select class="input" [value]="appointment.status" (change)="updateStatus(appointment._id, $any($event.target).value)">
                  <option value="pending">Pendiente</option>
                  <option value="confirmed">Confirmada</option>
                  <option value="cancelled">Cancelada</option>
                  <option value="completed">Completada</option>
                  <option value="no_show">No asistió</option>
                </select>
              </div>
            } @empty {
              <p class="muted">No hay citas registradas.</p>
            }
          </div>
        </article>
      </section>

      <section class="layout bottom">
        <article class="card panel">
          <div class="section-title">
            <div>
              <h2>Configuración de horarios</h2>
              <p>Configura los bloques semanales que generarán los horarios disponibles en el portal del paciente.</p>
            </div>
            <span class="status-pill">Agenda pública</span>
          </div>

          <form class="rules" [formGroup]="ruleForm" (ngSubmit)="createRule()">
            <label class="field field-wide">
              <span>Día disponible</span>
              <select class="input" formControlName="weekday">
                <option [ngValue]="1">Lunes</option>
                <option [ngValue]="2">Martes</option>
                <option [ngValue]="3">Miércoles</option>
                <option [ngValue]="4">Jueves</option>
                <option [ngValue]="5">Viernes</option>
                <option [ngValue]="6">Sábado</option>
              </select>
              <small>El paciente verá este día marcado en su calendario si existen horarios libres.</small>
            </label>

            <label class="field">
              <span>Hora de inicio</span>
              <input class="input" type="time" formControlName="startTime">
              <small>Primera hora posible para iniciar una sesión.</small>
            </label>

            <label class="field">
              <span>Hora de cierre</span>
              <input class="input" type="time" formControlName="endTime">
              <small>Última hora límite del bloque de atención.</small>
            </label>

            <label class="field">
              <span>Duración de sesión</span>
              <div class="input-with-unit">
                <input class="input" type="number" formControlName="sessionDurationMinutes" min="15">
                <b>min</b>
              </div>
              <small>Ejemplo recomendado: 50 minutos.</small>
            </label>

            <label class="field">
              <span>Descanso entre sesiones</span>
              <div class="input-with-unit">
                <input class="input" type="number" formControlName="bufferMinutes" min="0">
                <b>min</b>
              </div>
              <small>Tiempo para notas, preparación o pausa.</small>
            </label>

            <div class="schedule-preview">
              <strong>Resumen</strong>
              <span>
                Se mostrarán citas de {{ ruleForm.value.sessionDurationMinutes }} minutos los
                {{ weekdayLabel() | lowercase }}, entre {{ ruleForm.value.startTime }} y {{ ruleForm.value.endTime }},
                dejando {{ ruleForm.value.bufferMinutes }} minutos libres entre sesiones.
              </span>
            </div>

            @if (scheduleMessage()) {
              <p class="save-message" [class.error-message]="scheduleError()">{{ scheduleMessage() }}</p>
            }

            <button class="btn btn-primary" type="submit">
              {{ editingRuleId() ? 'Actualizar' : 'Guardar' }} disponibilidad de {{ weekdayLabel() | lowercase }}
            </button>
          </form>

          <div class="configured-hours">
            <h3>Semana configurada</h3>
            <p>Estos bloques son la fuente de verdad para los horarios que verá el paciente.</p>
            <div class="week-rules">
              @for (day of weekOverview(); track day.weekday) {
                <button type="button" [class.has-rule]="day.rules.length" [class.editing]="editingWeekday() === day.weekday" (click)="editDay(day.weekday)">
                  <strong>{{ day.label }}</strong>
                  @if (day.rules.length) {
                    @for (rule of day.rules; track rule._id) {
                      <span>{{ rule.startTime }} - {{ rule.endTime }}</span>
                      <small>{{ rule.sessionDurationMinutes }} min + {{ rule.bufferMinutes }} min descanso</small>
                    }
                  } @else {
                    <span class="empty-day">Sin horario</span>
                  }
                </button>
              }
            </div>
          </div>
        </article>

        <article class="card panel">
          <h2>Chats privados</h2>
          <div class="chat-admin">
            <label class="field">
              <span>Paciente</span>
              <select class="input" [value]="selectedChatPatientId()" (change)="selectChatPatient($any($event.target).value)">
                <option value="">Selecciona paciente</option>
                @for (patient of patients(); track patient._id) {
                  <option [value]="patient._id">{{ patient.name }}</option>
                }
              </select>
            </label>

            <div class="admin-messages">
              @for (item of chatTimeline(); track item.key) {
                @if (item.type === 'day') {
                  <div class="day-divider">{{ item.label }}</div>
                } @else {
                  <p [class.mine]="item.message.senderId === currentAdminId()">
                    <span>{{ item.message.content }}</span>
                    <small>{{ messageTimeLabel(item.message.createdAt) }}</small>
                  </p>
                }
              } @empty {
                <p class="muted">Selecciona un paciente para ver o responder su conversación.</p>
              }
            </div>

            <form class="compose-admin" [formGroup]="chatForm" (ngSubmit)="sendAdminMessage()">
              <input class="input" formControlName="content" placeholder="Responder al paciente">
              <button class="btn btn-primary" type="submit" [disabled]="!selectedChatPatientId() || chatForm.invalid">Enviar</button>
            </form>

            @if (chatStatus()) {
              <p class="save-message" [class.error-message]="chatError()">{{ chatStatus() }}</p>
            }
          </div>

          <div class="suggestions-admin">
            <h2>Sugerencias</h2>
          </div>
          <div class="suggestions">
            @for (suggestion of suggestions(); track suggestion._id) {
              <div class="suggestion">
                <p>{{ suggestion.message }}</p>
                <button class="btn btn-soft" type="button" (click)="closeSuggestion(suggestion._id)">Cerrar</button>
              </div>
            } @empty {
              <p class="muted">No hay sugerencias pendientes.</p>
            }
          </div>
        </article>
      </section>
    </main>
  `,
  styles: [
    `
      .admin {
        padding: 34px 0 64px;
      }

      .heading {
        display: flex;
        align-items: end;
        justify-content: space-between;
        gap: 20px;
        margin-bottom: 22px;
      }

      h1 {
        margin: 14px 0 10px;
        font-size: clamp(34px, 5vw, 56px);
        line-height: 1;
      }

      .metrics,
      .layout {
        display: grid;
        gap: 18px;
      }

      .metrics {
        grid-template-columns: repeat(4, 1fr);
        margin-bottom: 18px;
      }

      .metrics article {
        padding: 18px;
      }

      .metrics span {
        color: var(--muted);
        font-weight: 700;
      }

      .metrics strong {
        display: block;
        margin-top: 10px;
        font-size: 34px;
        color: #8d3159;
      }

      .layout {
        grid-template-columns: minmax(0, 1fr) minmax(360px, 0.85fr);
      }

      .bottom {
        margin-top: 18px;
      }

      .panel {
        padding: 22px;
      }

      .panel-head {
        display: grid;
        grid-template-columns: 1fr minmax(220px, 320px);
        gap: 14px;
        align-items: center;
      }

      .panel-head.compact {
        grid-template-columns: 1fr auto;
      }

      .table,
      .appointments,
      .suggestions,
      .admin-messages {
        display: grid;
        gap: 10px;
        margin-top: 14px;
      }

      .patient-row,
      .appointment,
      .suggestion {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 14px;
        border: 1px solid var(--border);
        border-radius: 8px;
        padding: 12px;
        background: var(--white);
      }

      .patient-row {
        width: 100%;
        cursor: pointer;
        text-align: left;
      }

      .patient-row span:first-child,
      .appointment div {
        display: grid;
        gap: 4px;
      }

      small,
      .muted,
      .appointment span,
      p {
        color: var(--muted);
      }

      .appointment select {
        width: 160px;
      }

      .section-title {
        display: flex;
        align-items: start;
        justify-content: space-between;
        gap: 14px;
        margin-bottom: 18px;
      }

      .section-title h2 {
        margin-bottom: 6px;
      }

      .section-title p {
        margin: 0;
        color: var(--muted);
        line-height: 1.55;
      }

      .rules {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 14px;
      }

      .field {
        display: grid;
        gap: 7px;
      }

      .field-wide,
      .schedule-preview,
      .save-message,
      .rules button {
        grid-column: 1 / -1;
      }

      .field span {
        color: #4f4249;
        font-weight: 800;
      }

      .field small {
        color: var(--muted);
        line-height: 1.4;
      }

      .input-with-unit {
        position: relative;
      }

      .input-with-unit .input {
        padding-right: 54px;
      }

      .input-with-unit b {
        position: absolute;
        top: 50%;
        right: 14px;
        transform: translateY(-50%);
        color: #9b4669;
        font-size: 13px;
      }

      .schedule-preview {
        display: grid;
        gap: 6px;
        padding: 14px;
        border: 1px solid var(--border);
        border-radius: 8px;
        background: #fff7fa;
        color: #6b5661;
        line-height: 1.55;
      }

      .schedule-preview strong {
        color: #8d3159;
      }

      .save-message {
        margin: 0;
        border-radius: 8px;
        padding: 10px 12px;
        background: #f0fbf1;
        color: #356d38;
        font-weight: 700;
      }

      .error-message {
        background: #fff1f1;
        color: #8b2d2d;
      }

      .configured-hours {
        margin-top: 22px;
        padding-top: 20px;
        border-top: 1px solid var(--border);
      }

      .configured-hours h3 {
        margin: 0 0 6px;
      }

      .configured-hours p {
        margin: 0 0 14px;
      }

      .week-rules {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 10px;
      }

      .week-rules button {
        display: grid;
        gap: 5px;
        min-height: 92px;
        border: 1px solid var(--border);
        border-radius: 8px;
        padding: 12px;
        background: var(--gray-50);
        cursor: pointer;
        text-align: left;
      }

      .week-rules .has-rule {
        background: #fff7fa;
        border-color: #f0c9d8;
      }

      .week-rules .editing {
        outline: 3px solid #d85f8d;
        background: #fce4ec;
      }

      .week-rules strong {
        color: #4f4249;
      }

      .week-rules span {
        color: #8d3159;
        font-weight: 800;
      }

      .week-rules small,
      .empty-day {
        color: var(--muted);
      }

      .chat-admin {
        display: grid;
        gap: 12px;
      }

      .admin-messages {
        min-height: 220px;
        max-height: 320px;
        overflow: auto;
        padding: 12px;
        border-radius: 8px;
        background: var(--gray-50);
      }

      .admin-messages p {
        display: grid;
        gap: 5px;
        width: fit-content;
        max-width: 82%;
        margin: 0;
        padding: 10px 12px;
        border-radius: 8px;
        background: var(--white);
      }

      .admin-messages p small {
        color: var(--muted);
        font-size: 11px;
        text-align: right;
      }

      .admin-messages .mine {
        margin-left: auto;
        background: var(--pink-bg);
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

      .compose-admin {
        display: grid;
        grid-template-columns: 1fr auto;
        gap: 10px;
      }

      .suggestions-admin {
        margin-top: 24px;
        padding-top: 20px;
        border-top: 1px solid var(--border);
      }

      @media (max-width: 980px) {
        .metrics,
        .layout,
        .panel-head,
        .rules,
        .week-rules {
          grid-template-columns: 1fr;
        }

        .heading,
        .patient-row,
        .appointment,
        .suggestion {
          align-items: stretch;
          flex-direction: column;
        }

        .appointment select {
          width: 100%;
        }
      }
    `,
  ],
})
export class AdminDashboardComponent implements OnInit {
  readonly summary = signal<CrmSummary | null>(null);
  readonly patients = signal<PatientRow[]>([]);
  readonly appointments = signal<AppointmentRow[]>([]);
  readonly suggestions = signal<Array<{ _id: string; message: string }>>([]);
  readonly availabilityRules = signal<AvailabilityRule[]>([]);
  readonly selectedChatPatientId = signal('');
  readonly chatMessages = signal<ChatMessage[]>([]);
  readonly currentAdminId = signal('');
  readonly chatStatus = signal('');
  readonly chatError = signal(false);
  readonly scheduleMessage = signal('');
  readonly scheduleError = signal(false);
  readonly editingRuleId = signal<string | null>(null);
  readonly editingWeekday = signal<number | null>(null);
  readonly search = this.fb.control('');
  readonly ruleForm = this.fb.group({
    weekday: [1],
    startTime: ['09:00'],
    endTime: ['14:00'],
    sessionDurationMinutes: [50],
    bufferMinutes: [10],
    active: [true],
  });
  readonly chatForm = this.fb.group({
    content: [''],
  });

  constructor(
    private readonly api: ApiService,
    private readonly fb: FormBuilder,
  ) {}

  ngOnInit() {
    this.refresh();
  }

  refresh() {
    this.api.get<CrmSummary>('/crm/summary').subscribe((summary) => this.summary.set(summary));
    this.loadPatients();
    this.loadAvailabilityRules();
    this.api.get<AppointmentRow[]>('/appointments').subscribe((appointments) => this.appointments.set(appointments));
    this.api.get<Array<{ _id: string; message: string }>>('/suggestions').subscribe((suggestions) => this.suggestions.set(suggestions));
    this.api.get<{ sub: string }>('/auth/me').subscribe((user) => this.currentAdminId.set(user.sub));
  }

  loadPatients() {
    const search = this.search.value ?? '';
    this.api.get<PatientRow[]>(`/patients?search=${encodeURIComponent(search)}`).subscribe((patients) => this.patients.set(patients));
  }

  loadAvailabilityRules() {
    this.api.get<AvailabilityRule[]>('/availability/rules').subscribe({
      next: (rules) => this.availabilityRules.set(rules),
      error: () => this.availabilityRules.set([]),
    });
  }

  selectPatient(patient: PatientRow) {
    this.api.post(`/crm/patients/${patient._id}/follow-up`, {}).subscribe(() => this.refresh());
  }

  selectChatPatient(patientId: string) {
    this.selectedChatPatientId.set(patientId);
    this.chatStatus.set('');
    this.chatError.set(false);
    if (!patientId) {
      this.chatMessages.set([]);
      return;
    }
    this.loadChat(patientId);
  }

  loadChat(patientId: string) {
    this.api.get<ChatMessage[]>(`/messages/${patientId}`).subscribe({
      next: (messages) => this.chatMessages.set(this.normalizeMessages(messages)),
      error: () => {
        this.chatError.set(true);
        this.chatStatus.set('No se pudo actualizar la conversación. Los mensajes visibles se conservan.');
      },
    });
  }

  selectedChatMessages() {
    return this.chatMessages();
  }

  chatTimeline() {
    const items: Array<
      | { type: 'day'; key: string; label: string }
      | { type: 'message'; key: string; message: ChatMessage }
    > = [];
    let lastDay = '';

    for (const message of this.selectedChatMessages()) {
      const dayKey = this.messageDayKey(message.createdAt);
      if (dayKey !== lastDay) {
        items.push({ type: 'day', key: `day-${dayKey}`, label: this.messageDayLabel(message.createdAt) });
        lastDay = dayKey;
      }
      items.push({ type: 'message', key: message._id, message });
    }

    return items;
  }

  sendAdminMessage() {
    const patientId = this.selectedChatPatientId();
    const content = this.chatForm.value.content;
    if (!patientId || !content) return;
    this.chatStatus.set('');
    this.chatError.set(false);
    this.api.post<ChatMessage>('/messages', { patientId, content }).subscribe({
      next: (message) => {
        this.chatMessages.update((messages) => this.normalizeMessages([...messages, message]));
        this.chatForm.reset();
        this.chatStatus.set('Mensaje enviado.');
      },
      error: () => {
        this.chatError.set(true);
        this.chatStatus.set('No se pudo enviar el mensaje.');
      },
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

  messageDayKey(value?: string) {
    const date = value ? new Date(value) : new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
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

  updateStatus(id: string, status: string) {
    this.api.patch(`/appointments/${id}/status`, { status }).subscribe(() => this.refresh());
  }

  createRule() {
    this.scheduleMessage.set('');
    this.scheduleError.set(false);
    const value = this.ruleForm.getRawValue();
    const payload = {
      weekday: Number(value.weekday),
      startTime: value.startTime,
      endTime: value.endTime,
      sessionDurationMinutes: Number(value.sessionDurationMinutes),
      bufferMinutes: Number(value.bufferMinutes),
      active: Boolean(value.active),
    };

    const request = this.editingRuleId()
      ? this.api.patch(`/availability/rules/${this.editingRuleId()}`, payload)
      : this.api.post('/availability/rules', payload);

    request.subscribe({
      next: () => {
        this.scheduleMessage.set(`Disponibilidad ${this.editingRuleId() ? 'actualizada' : 'guardada'} para ${this.weekdayLabel().toLowerCase()}.`);
        this.editingRuleId.set(null);
        this.editingWeekday.set(null);
        this.loadAvailabilityRules();
      },
      error: (error) => {
        this.scheduleError.set(true);
        const message = Array.isArray(error?.error?.message) ? error.error.message.join(' ') : error?.error?.message;
        this.scheduleMessage.set(message ?? 'No se pudo guardar el horario. Revisa los datos e intenta de nuevo.');
      },
    });
  }

  editDay(weekday: number) {
    const firstRule = this.uniqueRules(
      this.availabilityRules().filter((rule) => Number(rule.weekday) === weekday && rule.active),
    )[0];

    this.scheduleMessage.set('');
    this.scheduleError.set(false);
    this.editingWeekday.set(weekday);
    this.ruleForm.patchValue({
      weekday,
      startTime: firstRule?.startTime ?? '09:00',
      endTime: firstRule?.endTime ?? '14:00',
      sessionDurationMinutes: firstRule?.sessionDurationMinutes ?? 50,
      bufferMinutes: firstRule?.bufferMinutes ?? 10,
      active: true,
    });
    this.editingRuleId.set(firstRule?._id ?? null);
  }

  weekOverview() {
    return [1, 2, 3, 4, 5, 6].map((weekday) => ({
      weekday,
      label: this.weekdayLabelFor(weekday),
      rules: this.uniqueRules(this.availabilityRules().filter((rule) => Number(rule.weekday) === weekday && rule.active)),
    }));
  }

  uniqueRules(rules: AvailabilityRule[]) {
    return Array.from(
      new Map(
        rules.map((rule) => [
          `${rule.weekday}-${rule.startTime}-${rule.endTime}-${rule.sessionDurationMinutes}-${rule.bufferMinutes}`,
          rule,
        ]),
      ).values(),
    );
  }

  weekdayLabel() {
    return this.weekdayLabelFor(Number(this.ruleForm.value.weekday));
  }

  weekdayLabelFor(weekday: number) {
    const labels: Record<number, string> = {
      1: 'Lunes',
      2: 'Martes',
      3: 'Miércoles',
      4: 'Jueves',
      5: 'Viernes',
      6: 'Sábado',
    };
    return labels[weekday] ?? 'día seleccionado';
  }

  closeSuggestion(id: string) {
    this.api.patch(`/suggestions/${id}/status`, { status: 'closed' }).subscribe(() => this.refresh());
  }
}
