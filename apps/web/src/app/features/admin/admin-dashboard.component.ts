import { DatePipe, LowerCasePipe } from '@angular/common';
import { Component, OnInit, computed, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { CalendarOptions, EventClickArg, EventInput } from '@fullcalendar/core';
import dayGridPlugin from '@fullcalendar/daygrid';
import interactionPlugin from '@fullcalendar/interaction';
import timeGridPlugin from '@fullcalendar/timegrid';
import { FullCalendarModule } from '@fullcalendar/angular';
import { ApiService } from '../../core/api.service';

type AdminTab = 'today' | 'calendar' | 'patients' | 'schedule' | 'quick-intake';
type AppointmentStatus = 'pending' | 'confirmed' | 'cancelled' | 'completed' | 'no_show';

interface Slot {
  startAt: string;
  endAt: string;
}

interface PatientRow {
  _id: string;
  name: string;
  email: string;
  phone: string;
  status?: string;
  profile: PatientProfile;
}

interface PatientProfile {
  patientStatus: string;
  totalSessions: number;
  remainingSessions?: number;
  lastSessionAt?: string;
  lastBookedAt?: string;
  administrativeNotes?: string;
}

interface AppointmentRow {
  _id: string;
  startAt: string;
  endAt: string;
  status: AppointmentStatus;
  patientConfirmation?: 'pending' | 'yes' | 'no';
  reason?: string;
  patientId?: {
    _id?: string;
    name?: string;
    email?: string;
    phone?: string;
  };
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

interface ChatConversation {
  patientId: string;
  lastMessageAt?: string;
  unread?: number;
}

interface InactivePatient {
  _id: string;
  userId?: {
    _id?: string;
    name?: string;
    email?: string;
    phone?: string;
  };
  patientStatus?: string;
  lastBookedAt?: string;
  lastSessionAt?: string;
}

interface QuickIntakeResult {
  patient: PatientRow;
  completionUrl: string;
  expiresAt: string;
  appointment?: AppointmentRow | null;
}

@Component({
  standalone: true,
  imports: [DatePipe, LowerCasePipe, ReactiveFormsModule, FullCalendarModule],
  template: `
    <main class="admin-console page-shell">
      <section class="admin-hero">
        <div>
          <span class="eyebrow">Panel del psicólogo</span>
          <h1>Hoy, en una mirada.</h1>
          <p>Agenda operativa, seguimiento y contacto rápido con pacientes sin ruido administrativo.</p>
        </div>
        <div class="hero-actions">
          <button class="btn btn-soft" type="button" (click)="suggestionsOpen.set(true)">Sugerencias {{ newSuggestionsCount() }}</button>
          <button class="btn btn-danger-soft" type="button" (click)="deleteAllAppointments()">Borrar citas de prueba</button>
          <button class="btn btn-primary" type="button" (click)="refresh()">Actualizar</button>
        </div>
      </section>

      <nav class="workspace-tabs" aria-label="Secciones administrativas">
        <button type="button" [class.active]="activeTab() === 'today'" (click)="activeTab.set('today')">Hoy</button>
        <button type="button" [class.active]="activeTab() === 'calendar'" (click)="activeTab.set('calendar')">Calendario</button>
        <button type="button" [class.active]="activeTab() === 'patients'" (click)="activeTab.set('patients')">Pacientes</button>
        <button type="button" [class.active]="activeTab() === 'schedule'" (click)="activeTab.set('schedule')">Horarios</button>
        <button type="button" [class.active]="activeTab() === 'quick-intake'" (click)="openQuickIntake()">Alta paciente</button>
      </nav>

      @if (activeTab() === 'today') {
        <section class="today-grid">
          <div class="main-column">
            <section class="metric-strip" aria-label="Resumen del día">
              <article>
                <span>Sesiones hoy</span>
                <strong>{{ todayAppointments().length }}</strong>
              </article>
              <article>
                <span>Agendadas</span>
                <strong>{{ confirmedTodayCount() }}</strong>
              </article>
              <article>
                <span>Canceladas</span>
                <strong>{{ cancelledTodayCount() }}</strong>
              </article>
              <article>
                <span>Próxima</span>
                <strong>{{ nextAppointment() ? (nextAppointment()?.startAt | date: 'shortTime') : 'Libre' }}</strong>
              </article>
              <article>
                <span>Inactivos</span>
                <strong>{{ visibleInactivePatients().length }}</strong>
              </article>
            </section>

            <article class="next-session-card" [class.empty]="!nextAppointment()">
              @if (nextAppointment(); as next) {
                <div class="next-content">
                  <div>
                    <span class="eyebrow">Próxima sesión</span>
                    <h2>{{ appointmentPatientName(next) }}</h2>
                    <p>{{ appointmentDateTimeLabel(next.startAt, next.endAt) }}</p>
                  </div>
                  <div class="countdown">
                    <span>{{ timeRemaining(next.startAt, next.endAt) }}</span>
                    <small>{{ statusLabel(next) }}</small>
                  </div>
                </div>
                <div class="quick-actions">
                  <button class="icon-action" type="button" title="Abrir chat" (click)="openChatForAppointment(next)">Chat</button>
                  <button class="icon-action" type="button" title="Ver perfil" (click)="openAppointmentDetails(next)">Perfil</button>
                  <button class="icon-action" type="button" title="Reagendar" (click)="openReschedule(next)">Reagendar</button>
                </div>
              } @else {
                <div>
                  <span class="eyebrow">Próxima sesión</span>
                  <h2>Sin sesiones pendientes por ahora</h2>
                  <p>El día queda despejado. Las alertas de seguimiento siguen visibles abajo.</p>
                </div>
              }
            </article>

            <article class="panel-card timeline-panel">
              <div class="panel-title">
                <div>
                  <span class="eyebrow">Agenda de hoy</span>
                  <h2>Timeline operativo</h2>
                </div>
                <span class="soft-count">{{ todayAppointments().length }} citas</span>
              </div>

              <div class="timeline">
                @for (appointment of todayAppointments(); track appointment._id) {
                  <button class="timeline-item" type="button" [class]="timelineClass(appointment)" (click)="openAppointmentDetails(appointment)">
                    <span class="time">{{ appointment.startAt | date: 'shortTime' }}</span>
                    <span class="line-dot"></span>
                    <span class="timeline-copy">
                      <strong>{{ appointmentPatientName(appointment) }}</strong>
                      <small>{{ statusLabel(appointment) }} · {{ timeRemaining(appointment.startAt, appointment.endAt) }}</small>
                    </span>
                    <span class="timeline-actions">
                      <button type="button" title="Chat" (click)="openChatForAppointment(appointment); $event.stopPropagation()">Chat</button>
                      <button type="button" title="Reagendar" (click)="openReschedule(appointment); $event.stopPropagation()">Mover</button>
                    </span>
                  </button>
                } @empty {
                  <p class="empty-state">No hay sesiones programadas para hoy.</p>
                }
              </div>
            </article>
          </div>

          <aside class="side-column">
            <article class="panel-card upcoming-panel">
              <div class="panel-title compact">
                <h2>Próximas sesiones</h2>
                <span class="soft-count">{{ upcomingAppointments().length }}</span>
              </div>
              <div class="upcoming-list">
                @for (appointment of upcomingAppointments().slice(0, 5); track appointment._id) {
                  <button type="button" (click)="openAppointmentDetails(appointment)">
                    <span>{{ timeRemaining(appointment.startAt, appointment.endAt) }}</span>
                    <strong>{{ appointmentPatientName(appointment) }}</strong>
                    <small>{{ appointment.startAt | date: 'shortTime' }}</small>
                  </button>
                } @empty {
                  <p class="empty-state">No hay próximas sesiones activas.</p>
                }
              </div>
            </article>

            <article class="panel-card inactive-panel">
              <div class="panel-title compact">
                <h2>Pacientes sin sesión reciente</h2>
                <span class="soft-count">{{ visibleInactivePatients().length }}</span>
              </div>
              <div class="inactive-list">
                @for (patient of visibleInactivePatients().slice(0, 5); track patient._id) {
                  <div class="inactive-row">
                    <div>
                      <strong>{{ inactiveName(patient) }}</strong>
                      <small>{{ inactiveDays(patient) }} días sin agendar</small>
                    </div>
                    <button class="mini-button" type="button" (click)="sendReminder(patient)">Enviar recordatorio</button>
                  </div>
                } @empty {
                  <p class="empty-state">No hay pacientes inactivos en el umbral actual.</p>
                }
              </div>
              @if (reminderMessage()) {
                <p class="save-message" [class.error-message]="reminderError()">{{ reminderMessage() }}</p>
              }
            </article>
          </aside>
        </section>
      }

      @if (activeTab() === 'calendar') {
        <section class="panel-card calendar-panel">
          <div class="panel-title">
            <div>
              <span class="eyebrow">Vista secundaria</span>
              <h2>Calendario profesional</h2>
            </div>
            <span class="soft-count">Semana por defecto</span>
          </div>
          <div class="calendar-legend" aria-label="Significado de colores en citas">
            <span class="legend-title">Colores de citas</span>
            <div class="legend-items">
              <span><i style="--legend-color: #d7b7ef"></i>En curso</span>
              <span><i style="--legend-color: #b7d9ff"></i>Proxima cita</span>
              <span><i style="--legend-color: #c8e6c9"></i>Confirmada</span>
              <span><i style="--legend-color: #ffe6a8"></i>Pendiente</span>
              <span><i style="--legend-color: #dddddd"></i>Cancelada</span>
              <span><i style="--legend-color: #056C5C"></i>Finalizada</span>
              <span><i style="--legend-color: #ffc9c9"></i>No asistio</span>
            </div>
          </div>
          <full-calendar [options]="calendarOptions()"></full-calendar>
        </section>
      }

      @if (activeTab() === 'patients') {
        <section class="patients-grid">
          <article class="panel-card">
            <div class="panel-title">
              <div>
                <span class="eyebrow">CRM visual</span>
                <h2>Pacientes</h2>
              </div>
              <input class="input search-input" placeholder="Buscar paciente" [formControl]="search" (input)="loadPatients()">
            </div>
            <div class="patient-list">
              @for (patient of patients(); track patient._id) {
                <button type="button" class="patient-card" (click)="openPatientDetails(patient._id)">
                  <span class="patient-avatar">{{ initials(patient.name) }}</span>
                  <span>
                    <strong>{{ patient.name }}</strong>
                    <small>{{ patientContactLabel(patient) }}</small>
                  </span>
                  <b>{{ patientCompletionLabel(patient) }}</b>
                </button>
              } @empty {
                <p class="empty-state">No hay pacientes registrados.</p>
              }
            </div>
          </article>

          <article class="panel-card inactive-panel">
            <div class="panel-title compact">
              <h2>Seguimiento prioritario</h2>
              <span class="soft-count">{{ summary()?.followUpPatients ?? 0 }}</span>
            </div>
            <div class="inactive-list">
              @for (patient of visibleInactivePatients(); track patient._id) {
                <div class="inactive-row">
                  <div>
                    <strong>{{ inactiveName(patient) }}</strong>
                    <small>{{ inactiveDays(patient) }} días sin agendar</small>
                  </div>
                  <button class="mini-button" type="button" (click)="sendReminder(patient)">Recordatorio</button>
                </div>
              } @empty {
                <p class="empty-state">Sin alertas de seguimiento.</p>
              }
            </div>
          </article>
        </section>
      }

      @if (activeTab() === 'schedule') {
        <section class="panel-card schedule-panel">
          <div class="panel-title">
            <div>
              <span class="eyebrow">Disponibilidad</span>
              <h2>Configuración de horarios</h2>
              <p>Estos bloques alimentan los horarios disponibles del portal del paciente.</p>
            </div>
            <span class="soft-count">Agenda pública</span>
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
            </label>
            <label class="field">
              <span>Hora de inicio</span>
              <input class="input" type="time" formControlName="startTime">
            </label>
            <label class="field">
              <span>Hora de cierre</span>
              <input class="input" type="time" formControlName="endTime">
            </label>
            <label class="field">
              <span>Duración</span>
              <input class="input" type="number" formControlName="sessionDurationMinutes" min="15">
            </label>
            <label class="field">
              <span>Descanso</span>
              <input class="input" type="number" formControlName="bufferMinutes" min="0">
            </label>
            <div class="schedule-preview">
              Sesiones de {{ ruleForm.value.sessionDurationMinutes }} min los {{ weekdayLabel() | lowercase }},
              entre {{ ruleForm.value.startTime }} y {{ ruleForm.value.endTime }}, con {{ ruleForm.value.bufferMinutes }} min de descanso.
            </div>
            @if (scheduleMessage()) {
              <p class="save-message" [class.error-message]="scheduleError()">{{ scheduleMessage() }}</p>
            }
            <button class="btn btn-primary" type="submit">{{ editingRuleId() ? 'Actualizar' : 'Guardar' }} horario</button>
          </form>

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
        </section>
      }

      @if (activeTab() === 'quick-intake') {
        <section class="quick-intake-grid">
          <article class="panel-card quick-intake-panel">
            <div class="panel-title">
              <div>
                <span class="eyebrow">Alta rápida</span>
                <h2>Dar de alta paciente</h2>
                <p>Crea el perfil con nombre, bloquea una cita si hace falta y comparte un link para completar datos.</p>
              </div>
            </div>

            <form class="quick-intake-form" [formGroup]="quickIntakeForm" (ngSubmit)="createQuickPatient()">
              <label class="field field-wide">
                <span>Nombre del paciente</span>
                <input class="input" formControlName="name" autocomplete="off" placeholder="Nombre completo">
              </label>

              <label class="check-line">
                <input type="checkbox" formControlName="scheduleNow" (change)="toggleQuickSchedule()">
                Agendar una cita de una vez
              </label>

              @if (quickIntakeForm.value.scheduleNow) {
                <div class="quick-schedule-box">
                  <div class="mini-calendar">
                    <div class="month-nav">
                      <button class="dock-icon" type="button" (click)="previousQuickMonth()" aria-label="Mes anterior">&lsaquo;</button>
                      <strong>{{ quickMonthLabel() }}</strong>
                      <button class="dock-icon" type="button" (click)="nextQuickMonth()" aria-label="Mes siguiente">&rsaquo;</button>
                    </div>
                    <div class="weekdays">
                      @for (weekday of weekdays; track weekday) {
                        <span>{{ weekday }}</span>
                      }
                    </div>
                    <div class="calendar-grid">
                      @for (day of quickCalendarDays(); track day.key) {
                        <button
                          type="button"
                          [class.outside]="!day.inMonth"
                          [class.today]="day.isToday"
                          [class.available]="day.available"
                          [class.selected]="day.key === quickSelectedDate()"
                          [disabled]="!day.inMonth || day.isPast"
                          (click)="selectQuickDate(day.key)"
                        >
                          {{ day.label }}
                        </button>
                      }
                    </div>
                  </div>

                  <div class="time-section">
                    <h3>Horarios disponibles</h3>
                    @if (quickSlotsLoading()) {
                      <p class="empty-state">Buscando horarios disponibles...</p>
                    } @else {
                      <div class="time-group compact-times">
                        <div>
                          @for (slot of quickSlots(); track slot.startAt) {
                            <button
                              type="button"
                              [class.selected-time]="quickSelectedSlot()?.startAt === slot.startAt"
                              (click)="quickSelectedSlot.set(slot)"
                            >
                              {{ slot.startAt | date: 'shortTime' }}
                            </button>
                          }
                        </div>
                      </div>
                      @if (!quickSlots().length) {
                        <p class="empty-state">No hay horarios disponibles para este día.</p>
                      }
                    }
                  </div>
                </div>
              }

              @if (quickIntakeMessage()) {
                <p class="save-message" [class.error-message]="quickIntakeError()">{{ quickIntakeMessage() }}</p>
              }

              <button class="btn btn-primary" type="submit" [disabled]="quickIntakeSaving()">
                {{ quickIntakeSaving() ? 'Creando...' : 'Crear paciente y link' }}
              </button>
            </form>
          </article>

          <article class="panel-card quick-link-panel">
            <div class="panel-title compact">
              <h2>Link para WhatsApp</h2>
              <span class="soft-count">7 días</span>
            </div>
            @if (quickIntakeResult(); as result) {
              <div class="generated-link">
                <span>Paciente</span>
                <strong>{{ result.patient.name }}</strong>
                <input class="input" readonly [value]="result.completionUrl">
                <div class="hero-actions">
                  <button class="btn btn-soft" type="button" (click)="copyQuickLink()">Copiar link</button>
                  <a class="btn btn-primary" [href]="whatsappShareUrl(result)" target="_blank" rel="noopener">WhatsApp</a>
                </div>
                <small>Expira: {{ invitationExpiryLabel(result.expiresAt) }}</small>
              </div>
            } @else {
              <p class="empty-state">Cuando crees el paciente, aquí aparecerá el link listo para enviar.</p>
            }
          </article>
        </section>
      }
    </main>

    @if (drawerOpen()) {
      <aside class="detail-backdrop" (click)="closeDrawer()"></aside>
      <aside class="detail-drawer" aria-label="Detalle rápido">
        <header>
          <div>
            <span class="eyebrow">{{ selectedAppointment() ? 'Detalle de cita' : 'Perfil rápido' }}</span>
            <h2>{{ drawerPatientName() }}</h2>
            @if (selectedAppointment(); as appointment) {
              <p>{{ appointmentDateTimeLabel(appointment.startAt, appointment.endAt) }}</p>
            }
          </div>
          <button class="dock-icon" type="button" aria-label="Cerrar detalle" (click)="closeDrawer()">x</button>
        </header>

        @if (selectedAppointment(); as appointment) {
          <section [class]="'drawer-status ' + statusTone(appointment)">
            <strong>{{ statusLabel(appointment) }}</strong>
            <span>{{ timeRemaining(appointment.startAt, appointment.endAt) }}</span>
          </section>
          <section class="drawer-actions">
            <button type="button" (click)="openChatForAppointment(appointment)">Abrir chat</button>
            <button type="button" (click)="openReschedule(appointment)">Reagendar</button>
            <button class="danger" type="button" (click)="cancelAppointment(appointment)">Cancelar</button>
          </section>

          @if (reschedulingAppointmentId() === appointment._id) {
            <section class="admin-reschedule">
              <div class="mini-calendar">
                <div class="month-nav">
                  <button class="dock-icon" type="button" (click)="previousRescheduleMonth()" aria-label="Mes anterior">&lsaquo;</button>
                  <strong>{{ rescheduleMonthLabel() }}</strong>
                  <button class="dock-icon" type="button" (click)="nextRescheduleMonth()" aria-label="Mes siguiente">&rsaquo;</button>
                </div>
                <div class="weekdays">
                  @for (weekday of weekdays; track weekday) {
                    <span>{{ weekday }}</span>
                  }
                </div>
                <div class="calendar-grid">
                  @for (day of rescheduleCalendarDays(); track day.key) {
                    <button
                      type="button"
                      [class.outside]="!day.inMonth"
                      [class.today]="day.isToday"
                      [class.available]="day.available"
                      [class.selected]="day.key === rescheduleSelectedDate()"
                      [disabled]="!day.inMonth || day.isPast"
                      (click)="selectRescheduleDate(day.key)"
                    >
                      {{ day.label }}
                    </button>
                  }
                </div>
              </div>

              <div class="time-section">
                <h3>Horarios disponibles</h3>
                @if (loadingRescheduleSlots()) {
                  <p class="empty-state">Buscando horarios disponibles...</p>
                } @else {
                  @for (group of groupedRescheduleSlots(); track group.label) {
                    @if (group.slots.length) {
                      <div class="time-group">
                        <span>{{ group.label }}</span>
                        <div>
                          @for (slot of group.slots; track slot.startAt) {
                            <button
                              type="button"
                              [class.selected-time]="selectedRescheduleSlot()?.startAt === slot.startAt"
                              (click)="selectedRescheduleSlot.set(slot)"
                            >
                              {{ slot.startAt | date: 'shortTime' }}
                            </button>
                          }
                        </div>
                      </div>
                    }
                  }
                  @if (!rescheduleSlots().length) {
                    <p class="empty-state">No hay horarios disponibles para este día.</p>
                  }
                }
              </div>

              <button class="btn btn-primary" type="button" [disabled]="!selectedRescheduleSlot()" (click)="submitReschedule()">Guardar reagenda</button>
            </section>
          }
        }

        @if (selectedPatient(); as patient) {
          <section class="patient-snapshot">
            <div>
              <span>Email</span>
              <strong>{{ patient.email || 'Pendiente' }}</strong>
            </div>
            <div>
              <span>Teléfono</span>
              <strong>{{ patient.phone || 'Pendiente' }}</strong>
            </div>
            <div>
              <span>Estado</span>
              <strong>{{ patientCompletionLabel(patient) }}</strong>
            </div>
            <div>
              <span>Sesiones</span>
              <strong>{{ patient.profile.totalSessions }}</strong>
            </div>
          </section>
          <section class="drawer-actions">
            <button type="button" (click)="openPatientSchedule()">Agendar cita</button>
          </section>
          @if (patientSchedulingOpen()) {
            <section class="admin-reschedule">
              <div class="mini-calendar">
                <div class="month-nav">
                  <button class="dock-icon" type="button" (click)="previousPatientScheduleMonth()" aria-label="Mes anterior">&lsaquo;</button>
                  <strong>{{ patientScheduleMonthLabel() }}</strong>
                  <button class="dock-icon" type="button" (click)="nextPatientScheduleMonth()" aria-label="Mes siguiente">&rsaquo;</button>
                </div>
                <div class="weekdays">
                  @for (weekday of weekdays; track weekday) {
                    <span>{{ weekday }}</span>
                  }
                </div>
                <div class="calendar-grid">
                  @for (day of patientScheduleCalendarDays(); track day.key) {
                    <button
                      type="button"
                      [class.outside]="!day.inMonth"
                      [class.today]="day.isToday"
                      [class.available]="day.available"
                      [class.selected]="day.key === patientScheduleSelectedDate()"
                      [disabled]="!day.inMonth || day.isPast"
                      (click)="selectPatientScheduleDate(day.key)"
                    >
                      {{ day.label }}
                    </button>
                  }
                </div>
              </div>

              <div class="time-section">
                <h3>Horarios disponibles</h3>
                @if (patientScheduleSlotsLoading()) {
                  <p class="empty-state">Buscando horarios disponibles...</p>
                } @else {
                  @for (group of groupedPatientScheduleSlots(); track group.label) {
                    @if (group.slots.length) {
                      <div class="time-group">
                        <span>{{ group.label }}</span>
                        <div>
                          @for (slot of group.slots; track slot.startAt) {
                            <button
                              type="button"
                              [class.selected-time]="patientScheduleSelectedSlot()?.startAt === slot.startAt"
                              (click)="patientScheduleSelectedSlot.set(slot)"
                            >
                              {{ slot.startAt | date: 'shortTime' }}
                            </button>
                          }
                        </div>
                      </div>
                    }
                  }
                  @if (!patientScheduleSlots().length) {
                    <p class="empty-state">No hay horarios disponibles para este dÃ­a.</p>
                  }
                }
              </div>

              <button class="btn btn-primary" type="button" [disabled]="!patientScheduleSelectedSlot() || patientScheduleSaving()" (click)="submitPatientSchedule()">
                {{ patientScheduleSaving() ? 'Agendando...' : 'Guardar cita' }}
              </button>
            </section>
          }
          @if (isIncompletePatient(patient)) {
            <section class="pending-profile">
              <strong>Perfil pendiente de completar</strong>
              <p>Regenera un link si el anterior expiró o se perdió.</p>
              <button class="btn btn-soft" type="button" (click)="regeneratePatientLink(patient)">Generar link nuevo</button>
            </section>
          }
          <form class="notes-form" [formGroup]="notesForm" (ngSubmit)="saveNotes()">
            <label class="field">
              <span>Nota administrativa</span>
              <textarea class="input" rows="5" formControlName="administrativeNotes" placeholder="Agregar contexto útil para la siguiente sesión"></textarea>
            </label>
            <button class="btn btn-soft" type="submit">Guardar nota</button>
          </form>
          @if (drawerMessage()) {
            <p class="save-message" [class.error-message]="drawerError()">{{ drawerMessage() }}</p>
          }
        }
      </aside>
    }

    <aside class="chat-dock" [class.open]="chatOpen()">
      @if (chatOpen()) {
        <section class="chat-window admin-chat-window" aria-label="Mensajes privados">
          <header class="chat-header">
            <div>
              <span class="avatar">Ps</span>
              <div>
                <strong>Mensajes</strong>
                <small>{{ chatInbox().length }} conversaciones</small>
              </div>
            </div>
            <button class="dock-icon" type="button" aria-label="Cerrar chat" (click)="chatOpen.set(false)">x</button>
          </header>
          <div class="chat-body">
            <nav class="conversation-list" aria-label="Conversaciones con pacientes">
              @for (item of chatInbox(); track item.patient._id) {
                <button type="button" [class.active]="item.patient._id === selectedChatPatientId()" [class.has-unread]="item.unread > 0" (click)="selectChatPatient(item.patient._id)">
                  <span class="conversation-avatar">{{ initials(item.patient.name) }}</span>
                  <span>
                    <strong>{{ item.patient.name }}</strong>
                    <small>{{ item.lastMessageAt ? messageDayLabel(item.lastMessageAt) : item.patient.email }}</small>
                  </span>
                  @if (item.unread > 0) {
                    <b>{{ item.unread }}</b>
                  }
                </button>
              } @empty {
                <p class="chat-empty">Aún no hay conversaciones con pacientes.</p>
              }
            </nav>
            <section class="thread-panel">
              <div class="thread-title">
                <div>
                  <strong>{{ selectedPatientName() }}</strong>
                  <small>Chat privado</small>
                </div>
              </div>
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
                  <p class="empty-state">Selecciona un paciente para ver o responder su conversación.</p>
                }
              </div>
              <form class="compose-admin" [formGroup]="chatForm" (ngSubmit)="sendAdminMessage()">
                <input class="input" formControlName="content" placeholder="Responder al paciente">
                <button class="btn btn-primary" type="submit" [disabled]="!selectedChatPatientId() || chatForm.invalid">Enviar</button>
              </form>
              @if (chatStatus()) {
                <p class="save-message" [class.error-message]="chatError()">{{ chatStatus() }}</p>
              }
            </section>
          </div>
        </section>
      } @else {
        <button class="chat-bubble" type="button" aria-label="Abrir mensajes" (click)="openChatDock()">
          <span>Mensajes</span>
          @if (totalUnread() > 0) {
            <b>{{ totalUnread() }}</b>
          }
        </button>
      }
    </aside>

    <aside class="suggestions-dock" [class.open]="suggestionsOpen()">
      @if (suggestionsOpen()) {
        <section class="suggestions-window" aria-label="Sugerencias recibidas">
          <header class="chat-header">
            <div>
              <span class="avatar">Sg</span>
              <div>
                <strong>Sugerencias recibidas</strong>
                <small>{{ suggestions().length }} en bandeja</small>
              </div>
            </div>
            <button class="dock-icon" type="button" aria-label="Cerrar sugerencias" (click)="suggestionsOpen.set(false)">x</button>
          </header>
          <div class="suggestions-tray">
            @for (suggestion of suggestions(); track suggestion._id) {
              <article class="suggestion-card" [class.new]="suggestion.status === 'new'">
                <div>
                  <span class="status-pill">{{ suggestionStatusLabel(suggestion.status) }}</span>
                  @if (suggestion.patientId?.name) {
                    <small>{{ suggestion.patientId?.name }}</small>
                  }
                </div>
                <p>{{ suggestion.message }}</p>
                @if (suggestion.status !== 'reviewed' && suggestion.status !== 'answered') {
                  <button class="btn btn-soft" type="button" (click)="markSuggestionReviewed(suggestion._id)">Marcar como revisada</button>
                }
              </article>
            } @empty {
              <p class="chat-empty">No hay sugerencias pendientes.</p>
            }
          </div>
        </section>
      } @else {
        <button class="suggestions-bubble" type="button" aria-label="Abrir sugerencias recibidas" (click)="suggestionsOpen.set(true)">
          <span>Sugerencias</span>
          @if (newSuggestionsCount() > 0) {
            <b>{{ newSuggestionsCount() }}</b>
          }
        </button>
      }
    </aside>
  `,
  styles: [
    `
      :host {
        display: block;
      }

      .admin-console {
        padding: 32px 0 72px;
      }

      .admin-hero {
        display: flex;
        align-items: end;
        justify-content: space-between;
        gap: 20px;
        margin-bottom: 18px;
      }

      .admin-hero h1 {
        margin: 10px 0 8px;
        color: #45343b;
        font-size: clamp(34px, 5vw, 58px);
        line-height: 0.98;
        letter-spacing: 0;
      }

      .admin-hero p,
      .panel-title p {
        margin: 0;
        color: var(--muted);
        line-height: 1.55;
      }

      .eyebrow {
        display: inline-flex;
        align-items: center;
        min-height: 26px;
        border-radius: 999px;
        padding: 4px 10px;
        background: #fff1f6;
        color: #8d3159;
        font-size: 12px;
        font-weight: 800;
      }

      .hero-actions {
        display: flex;
        flex-wrap: wrap;
        gap: 10px;
      }

      .btn-danger-soft {
        border: 1px solid #f2c8c8;
        background: #fff1f1;
        color: #934242;
      }

      .workspace-tabs {
        position: sticky;
        top: 71px;
        z-index: 10;
        display: flex;
        gap: 8px;
        margin-bottom: 18px;
        padding: 8px;
        border: 1px solid var(--border);
        border-radius: 8px;
        background: rgba(255, 255, 255, 0.84);
        backdrop-filter: blur(14px);
      }

      .workspace-tabs button {
        min-height: 42px;
        border: 0;
        border-radius: 8px;
        padding: 0 18px;
        background: transparent;
        color: #6f5964;
        cursor: pointer;
        font-weight: 850;
      }

      .workspace-tabs button.active {
        background: var(--pink-bg);
        color: #7d3150;
        box-shadow: 0 10px 22px rgba(216, 95, 141, 0.14);
      }

      .today-grid,
      .patients-grid {
        display: grid;
        grid-template-columns: minmax(0, 1.45fr) minmax(320px, 0.75fr);
        gap: 18px;
        align-items: start;
      }

      .main-column,
      .side-column {
        display: grid;
        gap: 18px;
      }

      .metric-strip {
        display: grid;
        grid-template-columns: repeat(5, minmax(0, 1fr));
        gap: 10px;
      }

      .metric-strip article,
      .panel-card,
      .next-session-card {
        border: 1px solid rgba(234, 220, 225, 0.92);
        border-radius: 8px;
        background: rgba(255, 255, 255, 0.94);
        box-shadow: 0 20px 55px rgba(80, 62, 72, 0.1);
      }

      .metric-strip article {
        min-height: 96px;
        padding: 15px;
      }

      .metric-strip span,
      .patient-snapshot span {
        display: block;
        color: var(--muted);
        font-size: 12px;
        font-weight: 800;
      }

      .metric-strip strong {
        display: block;
        margin-top: 10px;
        color: #73314c;
        font-size: 26px;
      }

      .next-session-card {
        display: grid;
        gap: 18px;
        padding: 24px;
        background:
          linear-gradient(135deg, rgba(252, 228, 236, 0.82), rgba(255, 255, 255, 0.96) 48%),
          var(--white);
      }

      .next-session-card h2 {
        margin: 10px 0 6px;
        color: #49363e;
        font-size: clamp(28px, 4vw, 44px);
        line-height: 1.02;
      }

      .next-session-card p {
        margin: 0;
        color: var(--muted);
        font-weight: 700;
      }

      .next-content {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 18px;
      }

      .countdown {
        display: grid;
        gap: 5px;
        min-width: 170px;
        border-radius: 8px;
        padding: 16px;
        background: var(--white);
        text-align: right;
        box-shadow: inset 4px 0 0 #b7d9ff;
      }

      .countdown span {
        color: #365b86;
        font-size: 24px;
        font-weight: 950;
      }

      .countdown small,
      .soft-count {
        color: var(--muted);
        font-weight: 800;
      }

      .quick-actions,
      .drawer-actions {
        display: flex;
        flex-wrap: wrap;
        gap: 10px;
      }

      .icon-action,
      .drawer-actions button,
      .timeline-actions button,
      .mini-button {
        min-height: 38px;
        border: 1px solid #eed7df;
        border-radius: 8px;
        padding: 0 13px;
        background: #fff9fb;
        color: #743650;
        cursor: pointer;
        font-weight: 850;
      }

      .icon-action.strong,
      .drawer-actions button:first-child {
        border-color: #c8e6c9;
        background: #edf8ef;
        color: #2f6f44;
      }

      .panel-card {
        padding: 20px;
      }

      .panel-title {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 16px;
        margin-bottom: 16px;
      }

      .panel-title.compact {
        margin-bottom: 12px;
      }

      .panel-title h2 {
        margin: 8px 0 0;
        color: #4a3740;
        font-size: 24px;
      }

      .panel-title.compact h2 {
        margin: 0;
        font-size: 19px;
      }

      .timeline {
        position: relative;
        display: grid;
        gap: 10px;
      }

      .timeline::before {
        content: '';
        position: absolute;
        top: 16px;
        bottom: 16px;
        left: 87px;
        width: 2px;
        background: #f2dce4;
      }

      .timeline-item {
        position: relative;
        display: grid;
        grid-template-columns: 72px 18px minmax(0, 1fr) auto;
        gap: 14px;
        align-items: center;
        width: 100%;
        border: 1px solid var(--border);
        border-radius: 8px;
        padding: 13px;
        background: var(--white);
        color: var(--text);
        cursor: pointer;
        text-align: left;
        transition: transform 160ms ease, box-shadow 160ms ease, border-color 160ms ease;
      }

      .timeline-item:hover,
      .patient-card:hover,
      .upcoming-list button:hover {
        border-color: #f2b8cc;
        box-shadow: 0 14px 34px rgba(80, 62, 72, 0.1);
        transform: translateY(-1px);
      }

      .timeline-item .time {
        color: #5f4c55;
        font-weight: 900;
      }

      .line-dot {
        z-index: 1;
        width: 14px;
        height: 14px;
        border: 3px solid var(--white);
        border-radius: 999px;
        background: #f8bbd0;
        box-shadow: 0 0 0 2px #f2dce4;
      }

      .timeline-copy {
        display: grid;
        gap: 4px;
        min-width: 0;
      }

      .timeline-copy strong {
        color: #47353d;
        font-size: 16px;
      }

      .timeline-copy small,
      .empty-state,
      small {
        color: var(--muted);
      }

      .timeline-actions {
        display: flex;
        gap: 7px;
      }

      .status-confirmed .line-dot {
        background: #a5d6a7;
      }

      .status-pending .line-dot {
        background: #ffe6a8;
      }

      .status-cancelled .line-dot {
        background: #d9d9d9;
      }

      .status-no-show .line-dot {
        background: #ef9a9a;
      }

      .status-next .line-dot {
        background: #b7d9ff;
      }

      .status-current .line-dot {
        background: #d7b7ef;
      }

      .upcoming-list,
      .inactive-list,
      .patient-list {
        display: grid;
        gap: 10px;
      }

      .upcoming-list button,
      .patient-card {
        display: grid;
        align-items: center;
        width: 100%;
        border: 1px solid var(--border);
        border-radius: 8px;
        background: #fff;
        color: var(--text);
        cursor: pointer;
        text-align: left;
      }

      .upcoming-list button {
        grid-template-columns: 104px 1fr auto;
        gap: 10px;
        padding: 12px;
      }

      .upcoming-list span {
        color: #365b86;
        font-size: 13px;
        font-weight: 900;
      }

      .inactive-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        border: 1px solid #f0dce2;
        border-radius: 8px;
        padding: 12px;
        background: #fffafb;
      }

      .inactive-row div {
        display: grid;
        gap: 3px;
      }

      .calendar-panel {
        overflow: hidden;
      }

      .calendar-legend {
        display: grid;
        gap: 10px;
        margin-bottom: 14px;
        border: 1px solid #f0dce2;
        border-radius: 8px;
        padding: 12px;
        background: #fffafb;
      }

      .legend-title {
        color: #74475a;
        font-size: 0.78rem;
        font-weight: 900;
        letter-spacing: 0.08em;
        text-transform: uppercase;
      }

      .legend-items {
        display: flex;
        flex-wrap: wrap;
        gap: 8px 12px;
      }

      .legend-items span {
        display: inline-flex;
        align-items: center;
        gap: 7px;
        min-height: 26px;
        border-radius: 999px;
        padding: 4px 9px;
        background: #ffffff;
        color: #5b4b52;
        font-size: 0.85rem;
        font-weight: 800;
        white-space: nowrap;
      }

      .legend-items i {
        width: 12px;
        height: 12px;
        flex: 0 0 12px;
        border: 1px solid rgba(68, 51, 59, 0.18);
        border-radius: 999px;
        background: var(--legend-color);
      }

      .calendar-panel ::ng-deep .fc {
        --fc-border-color: #eadce1;
        --fc-today-bg-color: #fff3f7;
        --fc-button-bg-color: #d85f8d;
        --fc-button-border-color: #d85f8d;
        --fc-button-hover-bg-color: #be4a77;
        --fc-button-hover-border-color: #be4a77;
        --fc-button-active-bg-color: #8d3159;
        color: #4a4a4a;
      }

      .calendar-panel ::ng-deep .fc-event {
        border: 0;
        border-radius: 8px;
        padding: 3px 5px;
        font-weight: 800;
      }

      .patients-grid {
        grid-template-columns: minmax(0, 1fr) minmax(320px, 0.55fr);
      }

      .search-input {
        max-width: 320px;
      }

      .patient-card {
        grid-template-columns: 44px minmax(0, 1fr) auto;
        gap: 12px;
        padding: 13px;
      }

      .patient-avatar,
      .avatar,
      .conversation-avatar {
        display: grid;
        place-items: center;
        width: 38px;
        height: 38px;
        flex: 0 0 38px;
        border-radius: 999px;
        background: var(--pink-bg);
        color: #8d3159;
        font-weight: 950;
      }

      .patient-card span:nth-child(2) {
        display: grid;
        gap: 4px;
        min-width: 0;
      }

      .patient-card small {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .patient-card b {
        border-radius: 999px;
        padding: 5px 9px;
        background: #fff1f6;
        color: #88415f;
        font-size: 12px;
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

      .field span {
        color: #4f4249;
        font-weight: 850;
      }

      .field-wide,
      .schedule-preview,
      .save-message,
      .rules button {
        grid-column: 1 / -1;
      }

      .schedule-preview {
        border-radius: 8px;
        padding: 14px;
        background: #fff7fa;
        color: #74475a;
        font-weight: 800;
      }

      .quick-intake-grid {
        display: grid;
        grid-template-columns: minmax(0, 1.25fr) minmax(320px, 0.75fr);
        gap: 18px;
        align-items: start;
      }

      .quick-intake-form,
      .generated-link,
      .quick-schedule-box {
        display: grid;
        gap: 14px;
      }

      .check-line {
        display: flex;
        align-items: center;
        gap: 10px;
        color: #594851;
        font-weight: 850;
      }

      .quick-schedule-box {
        border: 1px solid var(--border);
        border-radius: 8px;
        padding: 14px;
        background: #fffafb;
      }

      .generated-link span,
      .generated-link small {
        color: var(--muted);
        font-weight: 800;
      }

      .generated-link strong {
        color: #4a3740;
        font-size: 22px;
      }

      .week-rules {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 10px;
        margin-top: 18px;
      }

      .week-rules button {
        display: grid;
        gap: 5px;
        min-height: 96px;
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
        outline: 3px solid #f8bbd0;
        background: #fce4ec;
      }

      .detail-backdrop {
        position: fixed;
        inset: 0;
        z-index: 49;
        background: rgba(54, 41, 48, 0.22);
        backdrop-filter: blur(3px);
      }

      .detail-drawer {
        position: fixed;
        top: 0;
        right: 0;
        z-index: 50;
        display: grid;
        grid-template-rows: auto;
        gap: 16px;
        width: min(460px, 100vw);
        height: 100vh;
        overflow: auto;
        padding: 22px;
        border-left: 1px solid var(--border);
        background: #fff;
        box-shadow: -18px 0 60px rgba(80, 62, 72, 0.18);
      }

      .detail-drawer header {
        display: flex;
        align-items: start;
        justify-content: space-between;
        gap: 12px;
      }

      .detail-drawer h2 {
        margin: 10px 0 6px;
        color: #44333b;
        font-size: 30px;
      }

      .detail-drawer p {
        margin: 0;
        color: var(--muted);
      }

      .drawer-status {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        border-radius: 8px;
        padding: 14px;
        background: #eef6ff;
        color: #365b86;
      }

      .drawer-status.status-current {
        background: #f5edfb;
        color: #6a3d83;
      }

      .drawer-status.status-confirmed,
      .drawer-status.status-completed {
        background: #edf8ef;
        color: #2f6f44;
      }

      .drawer-status.status-pending {
        background: #fff7dc;
        color: #7a5c17;
      }

      .drawer-status.status-cancelled {
        background: #f4f4f4;
        color: #686868;
      }

      .drawer-status.status-no-show {
        background: #ffeded;
        color: #934242;
      }

      .drawer-actions .danger {
        border-color: #f2c8c8;
        background: #fff1f1;
        color: #934242;
      }

      .patient-snapshot {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 10px;
      }

      .patient-snapshot div {
        border: 1px solid var(--border);
        border-radius: 8px;
        padding: 12px;
        background: #fffafb;
      }

      .patient-snapshot strong {
        display: block;
        margin-top: 4px;
        overflow-wrap: anywhere;
        color: #4a3740;
      }

      .notes-form,
      .admin-reschedule {
        display: grid;
        gap: 12px;
      }

      .pending-profile {
        display: grid;
        gap: 8px;
        border: 1px solid #efd3a6;
        border-radius: 8px;
        padding: 12px;
        background: #fff8ea;
        color: #6f4e1f;
      }

      .pending-profile p {
        margin: 0;
        color: #7b6645;
      }

      .mini-calendar {
        border: 1px solid var(--border);
        border-radius: 8px;
        padding: 14px;
        background: #fffafb;
      }

      .month-nav {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 10px;
        margin-bottom: 14px;
      }

      .month-nav strong {
        color: #8d3159;
        font-size: 18px;
      }

      .weekdays,
      .calendar-grid {
        display: grid;
        grid-template-columns: repeat(7, 1fr);
        text-align: center;
      }

      .weekdays {
        margin-bottom: 8px;
        color: #9b7890;
        font-size: 12px;
        font-weight: 850;
      }

      .calendar-grid {
        row-gap: 6px;
      }

      .calendar-grid button {
        justify-self: center;
        width: 34px;
        height: 34px;
        border: 0;
        border-radius: 8px;
        background: transparent;
        color: #b23f70;
        cursor: pointer;
        font-weight: 900;
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
        display: grid;
        gap: 10px;
      }

      .time-section h3 {
        margin: 0;
        color: #4a3740;
        font-size: 17px;
      }

      .time-group {
        display: grid;
        gap: 8px;
      }

      .time-group > span {
        color: #9b7890;
        font-size: 12px;
        font-weight: 850;
      }

      .time-group div {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
      }

      .time-group button {
        min-height: 38px;
        border: 0;
        border-radius: 8px;
        padding: 0 12px;
        background: #d85f8d;
        color: var(--white);
        cursor: pointer;
        font-weight: 900;
      }

      .time-group .selected-time {
        outline: 3px solid #8d3159;
        background: #b94777;
      }

      .chat-dock {
        position: fixed;
        right: 24px;
        bottom: 24px;
        z-index: 40;
        max-width: calc(100vw - 32px);
        max-height: calc(100dvh - 48px);
      }

      .suggestions-dock {
        position: fixed;
        right: 24px;
        bottom: 92px;
        z-index: 39;
      }

      .chat-bubble,
      .suggestions-bubble {
        position: relative;
        min-width: 142px;
        border: 0;
        border-radius: 999px;
        padding: 15px 20px;
        color: var(--white);
        cursor: pointer;
        font-weight: 950;
        box-shadow: 0 18px 38px rgba(141, 49, 89, 0.28);
      }

      .chat-bubble {
        background: #8d3159;
      }

      .suggestions-bubble {
        background: #6f4a7d;
      }

      .chat-bubble b,
      .suggestions-bubble b {
        position: absolute;
        top: -7px;
        right: -4px;
        display: grid;
        place-items: center;
        min-width: 26px;
        height: 26px;
        border: 2px solid var(--white);
        border-radius: 999px;
        background: #2d8f63;
        color: var(--white);
        font-size: 12px;
      }

      .chat-window,
      .suggestions-window {
        overflow: hidden;
        border: 1px solid var(--border);
        border-radius: 8px;
        background: var(--white);
        box-shadow: 0 24px 70px rgba(80, 62, 72, 0.22);
      }

      .chat-window {
        width: min(760px, calc(100vw - 32px));
        height: min(640px, calc(100dvh - 48px));
        display: grid;
        grid-template-rows: auto minmax(0, 1fr);
      }

      .suggestions-window {
        width: min(420px, calc(100vw - 32px));
        max-height: min(560px, calc(100vh - 120px));
      }

      .chat-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 14px 16px;
        border-bottom: 1px solid var(--border);
        background: #fffafb;
      }

      .chat-header > div,
      .thread-title,
      .conversation-list button {
        display: flex;
        align-items: center;
        gap: 12px;
      }

      .dock-icon {
        width: 34px;
        height: 34px;
        border: 0;
        border-radius: 8px;
        background: #fff1f6;
        color: #6b5661;
        cursor: pointer;
        font-weight: 950;
      }

      .chat-body {
        display: grid;
        grid-template-columns: 260px 1fr;
        min-height: 0;
      }

      .conversation-list {
        overflow: auto;
        min-height: 0;
        border-right: 1px solid var(--border);
        background: #fff7fa;
      }

      .conversation-list button {
        position: relative;
        width: 100%;
        border: 0;
        border-bottom: 1px solid var(--border);
        padding: 13px;
        background: transparent;
        color: var(--text);
        cursor: pointer;
        text-align: left;
      }

      .conversation-list button.active,
      .conversation-list button:hover {
        background: var(--white);
      }

      .conversation-list b {
        margin-left: auto;
        min-width: 23px;
        border-radius: 999px;
        padding: 3px 7px;
        background: #2d8f63;
        color: var(--white);
        font-size: 12px;
        text-align: center;
      }

      .conversation-list span:nth-child(2) {
        display: grid;
        min-width: 0;
      }

      .conversation-list small {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .thread-panel {
        display: grid;
        grid-template-rows: auto 1fr auto auto;
        min-width: 0;
        min-height: 0;
        padding: 14px;
      }

      .admin-messages {
        display: grid;
        align-content: start;
        gap: 10px;
        min-height: 0;
        overflow: auto;
        overscroll-behavior: contain;
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
        overflow-wrap: anywhere;
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
        font-weight: 850;
      }

      .compose-admin {
        display: grid;
        grid-template-columns: 1fr auto;
        gap: 10px;
        margin-top: 10px;
      }

      .suggestions-tray {
        display: grid;
        gap: 12px;
        max-height: calc(min(560px, calc(100vh - 120px)) - 67px);
        overflow: auto;
        padding: 14px;
        background: #fffafb;
      }

      .suggestion-card {
        display: grid;
        gap: 10px;
        border: 1px solid var(--border);
        border-radius: 8px;
        padding: 13px;
        background: var(--white);
      }

      .suggestion-card.new {
        border-color: #b98ac8;
        box-shadow: inset 4px 0 0 #6f4a7d;
      }

      .suggestion-card > div {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
      }

      .save-message {
        margin: 0;
        border-radius: 8px;
        padding: 10px 12px;
        background: #edf8ef;
        color: #2f6f44;
        font-weight: 800;
      }

      .error-message {
        background: #fff1f1;
        color: #934242;
      }

      @media (max-width: 1080px) {
        .today-grid,
        .patients-grid,
        .metric-strip {
          grid-template-columns: 1fr;
        }

        .metric-strip {
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }
      }

      @media (max-width: 760px) {
        .admin-console {
          padding-top: 22px;
        }

        .admin-hero,
        .next-content,
        .panel-title,
        .inactive-row {
          align-items: stretch;
          flex-direction: column;
        }

        .workspace-tabs {
          top: 0;
          overflow-x: auto;
        }

        .metric-strip,
        .rules,
        .week-rules,
        .patient-snapshot {
          grid-template-columns: 1fr;
        }

        .timeline::before {
          left: 20px;
        }

        .timeline-item {
          grid-template-columns: 18px minmax(0, 1fr);
        }

        .timeline-item .time {
          grid-column: 2;
          grid-row: 1;
        }

        .timeline-item .line-dot {
          grid-column: 1;
          grid-row: 1 / span 2;
        }

        .timeline-copy {
          grid-column: 2;
        }

        .timeline-actions {
          grid-column: 2;
        }

        .calendar-panel ::ng-deep .fc {
          display: none;
        }

        .calendar-panel::after {
          content: 'En móvil, el timeline es la vista principal para evitar saturación visual.';
          display: block;
          border-radius: 8px;
          padding: 16px;
          background: #fff7fa;
          color: #74475a;
          font-weight: 850;
        }

        .chat-dock,
        .suggestions-dock {
          right: 12px;
        }

        .chat-dock {
          bottom: 12px;
        }

        .suggestions-dock {
          bottom: 76px;
        }

        .chat-window {
          width: calc(100vw - 24px);
          height: min(650px, calc(100dvh - 24px));
        }

        .chat-body {
          grid-template-columns: 1fr;
          grid-template-rows: auto minmax(0, 1fr);
        }

        .conversation-list {
          max-height: 150px;
          border-right: 0;
          border-bottom: 1px solid var(--border);
        }
      }
    `,
  ],
})
export class AdminDashboardComponent implements OnInit {
  readonly activeTab = signal<AdminTab>('today');
  readonly summary = signal<CrmSummary | null>(null);
  readonly patients = signal<PatientRow[]>([]);
  readonly appointments = signal<AppointmentRow[]>([]);
  readonly inactivePatients = signal<InactivePatient[]>([]);
  readonly suggestions = signal<Array<{ _id: string; message: string; status?: string; patientId?: { name?: string; email?: string } }>>([]);
  readonly availabilityRules = signal<AvailabilityRule[]>([]);
  readonly conversations = signal<ChatConversation[]>([]);
  readonly selectedChatPatientId = signal('');
  readonly chatMessages = signal<ChatMessage[]>([]);
  readonly chatOpen = signal(false);
  readonly suggestionsOpen = signal(false);
  readonly currentAdminId = signal('');
  readonly chatStatus = signal('');
  readonly chatError = signal(false);
  readonly scheduleMessage = signal('');
  readonly scheduleError = signal(false);
  readonly reminderMessage = signal('');
  readonly reminderError = signal(false);
  readonly drawerMessage = signal('');
  readonly drawerError = signal(false);
  readonly quickIntakeMessage = signal('');
  readonly quickIntakeError = signal(false);
  readonly quickIntakeSaving = signal(false);
  readonly quickSlotsLoading = signal(false);
  readonly quickSlots = signal<Slot[]>([]);
  readonly quickSelectedSlot = signal<Slot | null>(null);
  readonly quickSelectedDate = signal(this.formatDateKey(new Date()));
  readonly quickVisibleMonth = signal(new Date());
  readonly quickAvailableDayKeys = signal<Set<string>>(new Set());
  readonly quickIntakeResult = signal<QuickIntakeResult | null>(null);
  readonly editingRuleId = signal<string | null>(null);
  readonly editingWeekday = signal<number | null>(null);
  readonly drawerOpen = signal(false);
  readonly selectedAppointment = signal<AppointmentRow | null>(null);
  readonly selectedPatient = signal<PatientRow | null>(null);
  readonly reschedulingAppointmentId = signal<string | null>(null);
  readonly rescheduleSlots = signal<Slot[]>([]);
  readonly loadingRescheduleSlots = signal(false);
  readonly rescheduleAvailableDayKeys = signal<Set<string>>(new Set());
  readonly selectedRescheduleSlot = signal<Slot | null>(null);
  readonly rescheduleSelectedDate = signal(this.formatDateKey(new Date()));
  readonly rescheduleVisibleMonth = signal(new Date());
  readonly patientSchedulingOpen = signal(false);
  readonly patientScheduleSaving = signal(false);
  readonly patientScheduleSlotsLoading = signal(false);
  readonly patientScheduleSlots = signal<Slot[]>([]);
  readonly patientScheduleSelectedSlot = signal<Slot | null>(null);
  readonly patientScheduleSelectedDate = signal(this.formatDateKey(new Date()));
  readonly patientScheduleVisibleMonth = signal(new Date());
  readonly patientScheduleAvailableDayKeys = signal<Set<string>>(new Set());
  readonly weekdays = ['Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sab', 'Dom'];

  readonly search = this.fb.control('');
  readonly ruleForm = this.fb.group({
    weekday: [1],
    startTime: ['09:00'],
    endTime: ['14:00'],
    sessionDurationMinutes: [50],
    bufferMinutes: [10],
    active: [true],
  });
  readonly chatForm = this.fb.group({ content: [''] });
  readonly notesForm = this.fb.group({ administrativeNotes: [''] });
  readonly quickIntakeForm = this.fb.group({
    name: ['', [Validators.required]],
    scheduleNow: [false],
  });

  readonly sortedAppointments = computed(() =>
    [...this.appointments()].sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime()),
  );

  readonly allTodayAppointments = computed(() => this.sortedAppointments().filter((appointment) => this.isToday(appointment.startAt)));
  readonly todayAppointments = computed(() => this.allTodayAppointments().filter((appointment) => appointment.status !== 'cancelled'));

  readonly upcomingAppointments = computed(() => {
    const now = Date.now();
    return this.sortedAppointments().filter((appointment) => {
      const end = new Date(appointment.endAt).getTime();
      return end >= now && !['cancelled', 'completed', 'no_show'].includes(appointment.status);
    });
  });

  readonly nextAppointment = computed(() => this.upcomingAppointments()[0] ?? null);
  readonly scheduledPatientIds = computed(() => {
    const ids = new Set<string>();
    for (const appointment of this.upcomingAppointments()) {
      const patientId = appointment.patientId?._id;
      if (patientId) {
        ids.add(patientId);
      }
    }
    return ids;
  });
  readonly visibleInactivePatients = computed(() =>
    this.inactivePatients().filter((patient) => {
      const patientId = patient.userId?._id;
      return !patientId || !this.scheduledPatientIds().has(patientId);
    }),
  );

  readonly confirmedTodayCount = computed(() => this.todayAppointments().filter((appointment) => appointment.status === 'confirmed').length);
  readonly cancelledTodayCount = computed(() => this.allTodayAppointments().filter((appointment) => appointment.status === 'cancelled').length);

  readonly calendarEvents = computed<EventInput[]>(() =>
    this.sortedAppointments().map((appointment) => ({
      id: appointment._id,
      title: `${this.appointmentPatientName(appointment)} · ${this.statusLabel(appointment)}`,
      start: appointment.startAt,
      end: appointment.endAt,
      backgroundColor: this.calendarColor(appointment),
      textColor: '#44333b',
      extendedProps: { appointmentId: appointment._id },
    })),
  );

  readonly calendarOptions = computed<CalendarOptions>(() => ({
    plugins: [dayGridPlugin, timeGridPlugin, interactionPlugin],
    initialView: 'timeGridWeek',
    locale: 'es',
    height: 'auto',
    nowIndicator: true,
    slotMinTime: '07:00:00',
    slotMaxTime: '22:00:00',
    allDaySlot: false,
    headerToolbar: {
      left: 'prev,next today',
      center: 'title',
      right: 'timeGridDay,timeGridWeek,dayGridMonth',
    },
    buttonText: {
      today: 'Hoy',
      day: 'Día',
      week: 'Semana',
      month: 'Mes',
    },
    events: this.calendarEvents(),
    eventClick: (info: EventClickArg) => this.openAppointmentById(info.event.id),
  }));

  constructor(
    private readonly api: ApiService,
    private readonly fb: FormBuilder,
  ) { }

  ngOnInit() {
    this.refresh();
  }

  refresh() {
    this.api.get<CrmSummary>('/crm/summary').subscribe((summary) => this.summary.set(summary));
    this.loadPatients();
    this.loadInactivePatients();
    this.loadAvailabilityRules();
    this.api.get<AppointmentRow[]>('/appointments').subscribe((appointments) => this.appointments.set(appointments));
    this.loadSuggestions();
    this.api.get<{ sub: string }>('/auth/me').subscribe((user) => this.currentAdminId.set(user.sub));
    this.loadConversations();
  }

  loadPatients() {
    const search = this.search.value ?? '';
    this.api.get<PatientRow[]>(`/patients?search=${encodeURIComponent(search)}`).subscribe((patients) => this.patients.set(patients));
  }

  loadInactivePatients() {
    this.api.get<InactivePatient[]>('/crm/inactive-patients?days=30').subscribe({
      next: (patients) => this.inactivePatients.set(patients),
      error: () => this.inactivePatients.set([]),
    });
  }

  loadAvailabilityRules() {
    this.api.get<AvailabilityRule[]>('/availability/rules').subscribe({
      next: (rules) => this.availabilityRules.set(rules),
      error: () => this.availabilityRules.set([]),
    });
  }

  loadConversations() {
    this.api.get<ChatConversation[]>('/conversations/me').subscribe({
      next: (conversations) => this.conversations.set(conversations),
      error: () => this.conversations.set([]),
    });
  }

  loadSuggestions() {
    this.api
      .get<Array<{ _id: string; message: string; status?: string; patientId?: { name?: string; email?: string } }>>('/suggestions')
      .subscribe((suggestions) => this.suggestions.set(suggestions));
  }

  openQuickIntake() {
    this.activeTab.set('quick-intake');
    this.quickIntakeMessage.set('');
    this.quickIntakeError.set(false);
    if (this.quickIntakeForm.value.scheduleNow) {
      this.loadQuickMonthAvailability();
      this.loadQuickSlots();
    }
  }

  toggleQuickSchedule() {
    this.quickSelectedSlot.set(null);
    if (this.quickIntakeForm.value.scheduleNow) {
      this.loadQuickMonthAvailability();
      this.loadQuickSlots();
    } else {
      this.quickSlots.set([]);
    }
  }

  loadQuickSlots() {
    const date = this.quickSelectedDate();
    const from = new Date(`${date}T00:00:00`);
    const to = new Date(`${date}T23:59:59`);
    this.quickSlotsLoading.set(true);
    this.quickSelectedSlot.set(null);
    this.api.get<Slot[]>(`/availability/slots?from=${from.toISOString()}&to=${to.toISOString()}`).subscribe({
      next: (slots) => {
        this.quickSlots.set(this.uniqueSlots(slots));
        this.quickSlotsLoading.set(false);
      },
      error: () => {
        this.quickSlots.set([]);
        this.quickSlotsLoading.set(false);
      },
    });
  }

  selectQuickDate(date: string) {
    this.quickSelectedDate.set(date);
    this.loadQuickSlots();
  }

  previousQuickMonth() {
    const current = this.quickVisibleMonth();
    this.quickVisibleMonth.set(new Date(current.getFullYear(), current.getMonth() - 1, 1));
    this.loadQuickMonthAvailability();
  }

  nextQuickMonth() {
    const current = this.quickVisibleMonth();
    this.quickVisibleMonth.set(new Date(current.getFullYear(), current.getMonth() + 1, 1));
    this.loadQuickMonthAvailability();
  }

  quickMonthLabel() {
    return this.quickVisibleMonth().toLocaleDateString('es-MX', { month: 'long', year: 'numeric' });
  }

  quickCalendarDays() {
    const month = this.quickVisibleMonth();
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
        available: this.quickAvailableDayKeys().has(key),
      };
    });
  }

  loadQuickMonthAvailability() {
    const month = this.quickVisibleMonth();
    const from = new Date(month.getFullYear(), month.getMonth(), 1, 0, 0, 0);
    const to = new Date(month.getFullYear(), month.getMonth() + 1, 0, 23, 59, 59);
    this.api.get<Slot[]>(`/availability/slots?from=${from.toISOString()}&to=${to.toISOString()}`).subscribe({
      next: (slots) => {
        this.quickAvailableDayKeys.set(new Set(this.uniqueSlots(slots).map((slot) => this.formatDateKey(new Date(slot.startAt)))));
      },
      error: () => this.quickAvailableDayKeys.set(new Set()),
    });
  }

  createQuickPatient() {
    const value = this.quickIntakeForm.getRawValue();
    const name = value.name?.trim() ?? '';
    const slot = this.quickSelectedSlot();
    this.quickIntakeMessage.set('');
    this.quickIntakeError.set(false);

    if (!name) {
      this.quickIntakeForm.markAllAsTouched();
      this.quickIntakeError.set(true);
      this.quickIntakeMessage.set('Debes llenar los campos para dar de alta al paciente.');
      return;
    }

    if (value.scheduleNow && !slot) {
      this.quickIntakeError.set(true);
      this.quickIntakeMessage.set('Selecciona un horario disponible para agendar la cita.');
      return;
    }

    const payload = {
      name,
      appointment: value.scheduleNow && slot ? { startAt: slot.startAt, endAt: slot.endAt } : undefined,
    };
    this.quickIntakeSaving.set(true);
    this.api.post<QuickIntakeResult>('/patient-invitations', payload).subscribe({
      next: (result) => {
        this.quickIntakeSaving.set(false);
        this.quickIntakeResult.set(result);
        this.quickIntakeMessage.set('Paciente creado. Link listo para enviar.');
        this.quickIntakeForm.patchValue({ name: '', scheduleNow: false });
        this.quickSlots.set([]);
        this.quickSelectedSlot.set(null);
        this.refresh();
      },
      error: (error) => {
        this.quickIntakeSaving.set(false);
        this.quickIntakeError.set(true);
        this.quickIntakeMessage.set(this.apiErrorMessage(error, 'No se pudo crear el paciente.'));
      },
    });
  }

  copyQuickLink() {
    const link = this.quickIntakeResult()?.completionUrl;
    if (!link) return;
    void navigator.clipboard?.writeText(link);
    this.quickIntakeMessage.set('Link copiado.');
    this.quickIntakeError.set(false);
  }

  whatsappShareUrl(result: QuickIntakeResult) {
    const message = `Hola ${result.patient.name}, completa tu perfil para tu cita con este link: ${result.completionUrl}`;
    return `https://wa.me/?text=${encodeURIComponent(message)}`;
  }

  invitationExpiryLabel(value: string) {
    return new Date(value).toLocaleString('es-MX', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  }

  openAppointmentById(id: string) {
    const appointment = this.appointments().find((item) => item._id === id);
    if (appointment) {
      this.openAppointmentDetails(appointment);
    }
  }

  openAppointmentDetails(appointment: AppointmentRow) {
    this.selectedAppointment.set(appointment);
    this.reschedulingAppointmentId.set(null);
    this.drawerMessage.set('');
    this.drawerError.set(false);
    const patientId = appointment.patientId?._id;
    if (patientId) {
      this.openPatientDetails(patientId, false);
    } else {
      this.drawerOpen.set(true);
    }
  }

  openPatientDetails(patientId: string, clearAppointment = true) {
    if (clearAppointment) {
      this.selectedAppointment.set(null);
    }
    this.patientSchedulingOpen.set(false);
    this.patientScheduleSelectedSlot.set(null);
    this.patientScheduleSlots.set([]);
    const existing = this.patients().find((patient) => patient._id === patientId);
    if (existing) {
      this.selectedPatient.set(existing);
      this.notesForm.patchValue({ administrativeNotes: existing.profile.administrativeNotes ?? '' });
      this.drawerOpen.set(true);
    }
    this.api.get<PatientRow>(`/patients/${patientId}`).subscribe({
      next: (patient) => {
        this.selectedPatient.set(patient);
        this.notesForm.patchValue({ administrativeNotes: patient.profile.administrativeNotes ?? '' });
        this.drawerOpen.set(true);
      },
      error: () => {
        this.drawerOpen.set(true);
        this.drawerError.set(true);
        this.drawerMessage.set('No se pudo cargar el perfil completo del paciente.');
      },
    });
  }

  closeDrawer() {
    this.drawerOpen.set(false);
    this.selectedAppointment.set(null);
    this.selectedPatient.set(null);
    this.reschedulingAppointmentId.set(null);
    this.rescheduleSlots.set([]);
    this.selectedRescheduleSlot.set(null);
    this.patientSchedulingOpen.set(false);
    this.patientScheduleSlots.set([]);
    this.patientScheduleSelectedSlot.set(null);
  }

  drawerPatientName() {
    return this.selectedPatient()?.name ?? (this.selectedAppointment() ? this.appointmentPatientName(this.selectedAppointment()!) : 'Paciente');
  }

  saveNotes() {
    const patient = this.selectedPatient();
    if (!patient) return;
    this.drawerMessage.set('');
    this.drawerError.set(false);
    this.api.post(`/patients/${patient._id}/notes`, this.notesForm.getRawValue()).subscribe({
      next: () => {
        this.drawerMessage.set('Nota guardada.');
        this.loadPatients();
      },
      error: () => {
        this.drawerError.set(true);
        this.drawerMessage.set('No se pudo guardar la nota.');
      },
    });
  }

  openPatientSchedule() {
    const patient = this.selectedPatient();
    if (!patient) return;
    const today = new Date();
    this.patientSchedulingOpen.set(true);
    this.patientScheduleVisibleMonth.set(new Date(today.getFullYear(), today.getMonth(), 1));
    this.patientScheduleSelectedDate.set(this.formatDateKey(today));
    this.patientScheduleSelectedSlot.set(null);
    this.drawerMessage.set('');
    this.drawerError.set(false);
    this.loadPatientScheduleMonthAvailability();
    this.loadPatientScheduleSlots();
  }

  submitPatientSchedule() {
    const patient = this.selectedPatient();
    const slot = this.patientScheduleSelectedSlot();
    if (!patient || !slot) return;
    this.patientScheduleSaving.set(true);
    this.drawerMessage.set('');
    this.drawerError.set(false);
    this.api
      .post(`/appointments/admin/patients/${patient._id}`, {
        startAt: slot.startAt,
        endAt: slot.endAt,
      })
      .subscribe({
        next: () => {
          this.patientScheduleSaving.set(false);
          this.patientSchedulingOpen.set(false);
          this.patientScheduleSelectedSlot.set(null);
          this.drawerMessage.set('Cita agendada.');
          this.refresh();
        },
        error: (error) => {
          this.patientScheduleSaving.set(false);
          this.drawerError.set(true);
          this.drawerMessage.set(this.apiErrorMessage(error, 'No se pudo agendar la cita.'));
        },
      });
  }

  selectPatientScheduleDate(date: string) {
    this.patientScheduleSelectedDate.set(date);
    this.loadPatientScheduleSlots();
  }

  previousPatientScheduleMonth() {
    const current = this.patientScheduleVisibleMonth();
    this.patientScheduleVisibleMonth.set(new Date(current.getFullYear(), current.getMonth() - 1, 1));
    this.loadPatientScheduleMonthAvailability();
  }

  nextPatientScheduleMonth() {
    const current = this.patientScheduleVisibleMonth();
    this.patientScheduleVisibleMonth.set(new Date(current.getFullYear(), current.getMonth() + 1, 1));
    this.loadPatientScheduleMonthAvailability();
  }

  patientScheduleMonthLabel() {
    return this.patientScheduleVisibleMonth().toLocaleDateString('es-MX', { month: 'long', year: 'numeric' });
  }

  patientScheduleCalendarDays() {
    const month = this.patientScheduleVisibleMonth();
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
        available: this.patientScheduleAvailableDayKeys().has(key),
      };
    });
  }

  loadPatientScheduleSlots() {
    const date = this.patientScheduleSelectedDate();
    const from = new Date(`${date}T00:00:00`);
    const to = new Date(`${date}T23:59:59`);
    this.patientScheduleSlotsLoading.set(true);
    this.patientScheduleSelectedSlot.set(null);
    this.api.get<Slot[]>(`/availability/slots?from=${from.toISOString()}&to=${to.toISOString()}`).subscribe({
      next: (slots) => {
        this.patientScheduleSlots.set(this.uniqueSlots(slots));
        this.patientScheduleSlotsLoading.set(false);
      },
      error: () => {
        this.patientScheduleSlots.set([]);
        this.patientScheduleSlotsLoading.set(false);
      },
    });
  }

  loadPatientScheduleMonthAvailability() {
    const month = this.patientScheduleVisibleMonth();
    const from = new Date(month.getFullYear(), month.getMonth(), 1, 0, 0, 0);
    const to = new Date(month.getFullYear(), month.getMonth() + 1, 0, 23, 59, 59);
    this.api.get<Slot[]>(`/availability/slots?from=${from.toISOString()}&to=${to.toISOString()}`).subscribe({
      next: (slots) => {
        this.patientScheduleAvailableDayKeys.set(new Set(this.uniqueSlots(slots).map((slot) => this.formatDateKey(new Date(slot.startAt)))));
      },
      error: () => this.patientScheduleAvailableDayKeys.set(new Set()),
    });
  }

  groupedPatientScheduleSlots() {
    return [
      { label: 'MaÃ±ana', slots: this.patientScheduleSlots().filter((slot) => new Date(slot.startAt).getHours() < 12) },
      {
        label: 'MediodÃ­a',
        slots: this.patientScheduleSlots().filter((slot) => {
          const hour = new Date(slot.startAt).getHours();
          return hour >= 12 && hour < 17;
        }),
      },
      { label: 'Tarde', slots: this.patientScheduleSlots().filter((slot) => new Date(slot.startAt).getHours() >= 17) },
    ];
  }

  openReschedule(appointment: AppointmentRow) {
    this.selectedAppointment.set(appointment);
    this.drawerOpen.set(true);
    this.patientSchedulingOpen.set(false);
    this.patientScheduleSelectedSlot.set(null);
    this.reschedulingAppointmentId.set(appointment._id);
    const appointmentDate = new Date(appointment.startAt);
    this.rescheduleVisibleMonth.set(new Date(appointmentDate.getFullYear(), appointmentDate.getMonth(), 1));
    this.rescheduleSelectedDate.set(this.formatDateKey(appointmentDate));
    this.selectedRescheduleSlot.set(null);
    this.loadRescheduleMonthAvailability();
    this.loadRescheduleSlots();
  }

  submitReschedule() {
    const appointment = this.selectedAppointment();
    const slot = this.selectedRescheduleSlot();
    if (!appointment || !slot) return;
    this.api
      .post(`/appointments/${appointment._id}/reschedule`, {
        startAt: slot.startAt,
        endAt: slot.endAt,
      })
      .subscribe({
        next: () => {
          this.drawerMessage.set('Cita reagendada.');
          this.reschedulingAppointmentId.set(null);
          this.selectedRescheduleSlot.set(null);
          this.refresh();
        },
        error: () => {
          this.drawerError.set(true);
          this.drawerMessage.set('No se pudo reagendar la cita.');
        },
      });
  }

  selectRescheduleDate(date: string) {
    this.rescheduleSelectedDate.set(date);
    this.loadRescheduleSlots();
  }

  previousRescheduleMonth() {
    const current = this.rescheduleVisibleMonth();
    this.rescheduleVisibleMonth.set(new Date(current.getFullYear(), current.getMonth() - 1, 1));
    this.loadRescheduleMonthAvailability();
  }

  nextRescheduleMonth() {
    const current = this.rescheduleVisibleMonth();
    this.rescheduleVisibleMonth.set(new Date(current.getFullYear(), current.getMonth() + 1, 1));
    this.loadRescheduleMonthAvailability();
  }

  rescheduleMonthLabel() {
    return this.rescheduleVisibleMonth().toLocaleDateString('es-MX', { month: 'long', year: 'numeric' });
  }

  rescheduleCalendarDays() {
    const month = this.rescheduleVisibleMonth();
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
        available: this.rescheduleAvailableDayKeys().has(key),
      };
    });
  }

  loadRescheduleSlots() {
    const date = this.rescheduleSelectedDate();
    const from = new Date(`${date}T00:00:00`);
    const to = new Date(`${date}T23:59:59`);
    this.loadingRescheduleSlots.set(true);
    this.selectedRescheduleSlot.set(null);
    this.api.get<Slot[]>(`/availability/slots?from=${from.toISOString()}&to=${to.toISOString()}`).subscribe({
      next: (slots) => {
        this.rescheduleSlots.set(this.uniqueSlots(slots));
        this.loadingRescheduleSlots.set(false);
      },
      error: () => {
        this.rescheduleSlots.set([]);
        this.loadingRescheduleSlots.set(false);
      },
    });
  }

  loadRescheduleMonthAvailability() {
    const month = this.rescheduleVisibleMonth();
    const from = new Date(month.getFullYear(), month.getMonth(), 1, 0, 0, 0);
    const to = new Date(month.getFullYear(), month.getMonth() + 1, 0, 23, 59, 59);
    this.api.get<Slot[]>(`/availability/slots?from=${from.toISOString()}&to=${to.toISOString()}`).subscribe({
      next: (slots) => {
        this.rescheduleAvailableDayKeys.set(new Set(this.uniqueSlots(slots).map((slot) => this.formatDateKey(new Date(slot.startAt)))));
      },
      error: () => this.rescheduleAvailableDayKeys.set(new Set()),
    });
  }

  groupedRescheduleSlots() {
    return [
      { label: 'Mañana', slots: this.rescheduleSlots().filter((slot) => new Date(slot.startAt).getHours() < 12) },
      {
        label: 'Mediodía',
        slots: this.rescheduleSlots().filter((slot) => {
          const hour = new Date(slot.startAt).getHours();
          return hour >= 12 && hour < 17;
        }),
      },
      { label: 'Tarde', slots: this.rescheduleSlots().filter((slot) => new Date(slot.startAt).getHours() >= 17) },
    ];
  }

  uniqueSlots(slots: Slot[]) {
    return Array.from(new Map(slots.map((slot) => [`${slot.startAt}-${slot.endAt}`, slot])).values());
  }

  cancelAppointment(appointment: AppointmentRow) {
    if (!confirm(`¿Cancelar la sesión de ${this.appointmentPatientName(appointment)}?`)) return;
    this.api.post(`/appointments/${appointment._id}/cancel`, {}).subscribe(() => this.refresh());
  }

  deleteAllAppointments() {
    const firstConfirm = confirm('Esta acción borrará TODAS las citas de la base de datos. Úsala solo para pruebas. ¿Continuar?');
    if (!firstConfirm) return;
    const secondConfirm = prompt('Escribe BORRAR CITAS para confirmar.');
    if (secondConfirm !== 'BORRAR CITAS') return;

    this.api.delete<{ ok: boolean; deletedCount: number }>('/appointments').subscribe({
      next: (result) => {
        this.appointments.set([]);
        this.drawerOpen.set(false);
        this.selectedAppointment.set(null);
        this.reminderError.set(false);
        this.reminderMessage.set(`Se eliminaron ${result.deletedCount} citas de prueba.`);
        this.refresh();
      },
      error: () => {
        this.reminderError.set(true);
        this.reminderMessage.set('No se pudieron eliminar las citas.');
      },
    });
  }

  sendReminder(patient: InactivePatient) {
    const patientId = patient.userId?._id;
    if (!patientId) return;
    this.reminderMessage.set('');
    this.reminderError.set(false);
    this.api.post<{ ok: boolean }>(`/crm/patients/${patientId}/reminder`, {}).subscribe({
      next: () => {
        this.reminderMessage.set(`Recordatorio enviado a ${this.inactiveName(patient)}.`);
        this.loadInactivePatients();
      },
      error: (error) => {
        this.reminderError.set(true);
        this.reminderMessage.set(error?.error?.message ?? 'No se pudo enviar el recordatorio.');
      },
    });
  }

  updateStatus(id: string, status: AppointmentStatus) {
    this.api.patch(`/appointments/${id}/status`, { status }).subscribe(() => this.refresh());
  }

  openChatForAppointment(appointment: AppointmentRow) {
    const patientId = appointment.patientId?._id;
    if (!patientId) return;
    this.selectedChatPatientId.set(patientId);
    this.chatOpen.set(true);
    this.loadChat(patientId);
  }

  appointmentPatientName(appointment: AppointmentRow) {
    return appointment.patientId?.name ?? 'Paciente';
  }

  statusLabel(appointment: AppointmentRow) {
    const tone = this.statusTone(appointment);
    if (tone === 'status-current') return 'En curso';
    if (tone === 'status-next') return 'Próxima';
    const labels: Record<AppointmentStatus, string> = {
      pending: 'Agendada',
      confirmed: 'Agendada',
      cancelled: 'Cancelada',
      completed: 'Finalizada',
      no_show: 'No asistió',
    };
    return labels[appointment.status] ?? appointment.status;
  }

  statusTone(appointment: AppointmentRow) {
    const now = Date.now();
    const start = new Date(appointment.startAt).getTime();
    const end = new Date(appointment.endAt).getTime();
    if (!['cancelled', 'completed', 'no_show'].includes(appointment.status) && now >= start && now <= end) {
      return 'status-current';
    }
    if (this.nextAppointment()?._id === appointment._id) {
      return 'status-next';
    }
    if (appointment.status === 'no_show') return 'status-no-show';
    return `status-${appointment.status}`;
  }

  timelineClass(appointment: AppointmentRow) {
    return `timeline-item ${this.statusTone(appointment)}`;
  }

  calendarColor(appointment: AppointmentRow) {
    const colors: Record<string, string> = {
      'status-current': '#d7b7ef',
      'status-next': '#b7d9ff',
      'status-confirmed': '#c8e6c9',
      'status-pending': '#ffe6a8',
      'status-cancelled': '#dddddd',
      'status-completed': '#d8efdc',
      'status-no-show': '#ffc9c9',
    };
    return colors[this.statusTone(appointment)] ?? '#f8bbd0';
  }

  timeRemaining(startValue: string, endValue?: string) {
    const now = Date.now();
    const start = new Date(startValue).getTime();
    const end = endValue ? new Date(endValue).getTime() : start;
    if (now >= start && now <= end) return 'Ahora';
    const diff = start - now;
    if (diff < 0) return 'Terminada';
    const minutes = Math.round(diff / 60000);
    if (minutes < 60) return `En ${minutes} min`;
    const hours = Math.floor(minutes / 60);
    const rest = minutes % 60;
    return rest ? `En ${hours} h ${rest} min` : `En ${hours} h`;
  }

  appointmentDateTimeLabel(startValue: string, endValue: string) {
    const start = new Date(startValue);
    const end = new Date(endValue);
    const date = start.toLocaleDateString('es-MX', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
    });
    const startTime = start.toLocaleTimeString('es-MX', {
      hour: 'numeric',
      minute: '2-digit',
    });
    const endTime = end.toLocaleTimeString('es-MX', {
      hour: 'numeric',
      minute: '2-digit',
    });
    return `${date.charAt(0).toUpperCase() + date.slice(1)} · ${startTime} - ${endTime}`;
  }

  isToday(value: string) {
    const date = new Date(value);
    const today = new Date();
    return date.getFullYear() === today.getFullYear() && date.getMonth() === today.getMonth() && date.getDate() === today.getDate();
  }

  formatDateKey(date: Date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  inactiveName(patient: InactivePatient) {
    return patient.userId?.name ?? 'Paciente';
  }

  inactiveDays(patient: InactivePatient) {
    const last = patient.lastBookedAt ?? patient.lastSessionAt;
    if (!last) return 30;
    return Math.max(0, Math.floor((Date.now() - new Date(last).getTime()) / 86400000));
  }

  patientStatusLabel(status = 'new') {
    const labels: Record<string, string> = {
      new: 'Nuevo',
      active: 'Activo',
      inactive: 'Inactivo',
      follow_up: 'Seguimiento',
      discharged: 'Alta',
    };
    return labels[status] ?? status;
  }

  isIncompletePatient(patient: PatientRow) {
    return patient.status === 'incomplete' || !patient.email || !patient.phone;
  }

  patientCompletionLabel(patient: PatientRow) {
    return this.isIncompletePatient(patient) ? 'Pendiente de completar' : this.patientStatusLabel(patient.profile.patientStatus);
  }

  patientContactLabel(patient: PatientRow) {
    if (this.isIncompletePatient(patient)) return 'Datos pendientes';
    return `${patient.email} · ${patient.phone}`;
  }

  regeneratePatientLink(patient: PatientRow) {
    this.drawerMessage.set('');
    this.drawerError.set(false);
    this.api.post<{ completionUrl: string; expiresAt: string }>(`/patient-invitations/${patient._id}/regenerate`, {}).subscribe({
      next: (result) => {
        this.quickIntakeResult.set({ patient, completionUrl: result.completionUrl, expiresAt: result.expiresAt });
        this.drawerMessage.set('Link regenerado. Lo dejamos listo en Alta paciente para copiar o enviar.');
        this.activeTab.set('quick-intake');
      },
      error: (error) => {
        this.drawerError.set(true);
        this.drawerMessage.set(this.apiErrorMessage(error, 'No se pudo generar un link nuevo.'));
      },
    });
  }

  private apiErrorMessage(error: any, fallback: string) {
    const message = error?.error?.message;
    return Array.isArray(message) ? message.join(' ') : message ?? fallback;
  }

  newSuggestionsCount() {
    return this.suggestions().filter((suggestion) => suggestion.status === 'new').length;
  }

  suggestionStatusLabel(status = 'new') {
    const labels: Record<string, string> = {
      new: 'Nueva',
      reviewed: 'Revisada',
      answered: 'Respondida',
      closed: 'Archivada',
    };
    return labels[status] ?? status;
  }

  openChatDock() {
    this.chatOpen.set(true);
    this.loadConversations();
    if (!this.selectedChatPatientId() && this.chatInbox()[0]) {
      this.selectChatPatient(this.chatInbox()[0].patient._id);
    }
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
      next: (messages) => {
        this.chatMessages.set(this.normalizeMessages(messages));
        this.loadConversations();
      },
      error: () => {
        this.chatError.set(true);
        this.chatStatus.set('No se pudo actualizar la conversación. Los mensajes visibles se conservan.');
      },
    });
  }

  selectedChatMessages() {
    return this.chatMessages();
  }

  chatInbox() {
    const conversationByPatient = new Map(this.conversations().map((conversation) => [String(conversation.patientId), conversation]));
    return this.patients()
      .map((patient) => {
        const conversation = conversationByPatient.get(patient._id);
        return {
          patient,
          lastMessageAt: conversation?.lastMessageAt,
          unread: Number(conversation?.unread ?? 0),
          hasConversation: Boolean(conversation),
        };
      })
      .filter((item) => item.hasConversation)
      .sort((a, b) => {
        const unreadDelta = b.unread - a.unread;
        if (unreadDelta) return unreadDelta;
        return new Date(b.lastMessageAt ?? 0).getTime() - new Date(a.lastMessageAt ?? 0).getTime();
      });
  }

  selectedPatientName() {
    const patient = this.patients().find((item) => item._id === this.selectedChatPatientId());
    return patient?.name ?? 'Selecciona un paciente';
  }

  totalUnread() {
    return this.conversations().reduce((total, conversation) => total + Number(conversation.unread ?? 0), 0);
  }

  initials(name: string) {
    return (
      name
        .split(' ')
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part[0]?.toUpperCase())
        .join('') || 'P'
    );
  }

  chatTimeline() {
    const items: Array<{ type: 'day'; key: string; label: string } | { type: 'message'; key: string; message: ChatMessage }> = [];
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
        this.loadConversations();
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
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
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
    const firstRule = this.uniqueRules(this.availabilityRules().filter((rule) => Number(rule.weekday) === weekday && rule.active))[0];
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
      new Map(rules.map((rule) => [`${rule.weekday}-${rule.startTime}-${rule.endTime}-${rule.sessionDurationMinutes}-${rule.bufferMinutes}`, rule])).values(),
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

  markSuggestionReviewed(id: string) {
    this.api.patch(`/suggestions/${id}/status`, { status: 'reviewed' }).subscribe(() => this.loadSuggestions());
  }
}
