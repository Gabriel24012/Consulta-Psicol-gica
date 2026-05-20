export type UserRole = 'admin' | 'patient';
export type UserStatus = 'active' | 'inactive' | 'blocked';
export type PatientStatus = 'new' | 'active' | 'inactive' | 'follow_up' | 'discharged';
export type AppointmentStatus = 'pending' | 'confirmed' | 'cancelled' | 'completed' | 'no_show';
export type PatientConfirmation = 'pending' | 'yes' | 'no';
export type SuggestionStatus = 'new' | 'reviewed' | 'answered' | 'closed';
export type NotificationType = 'appointment' | 'message' | 'suggestion' | 'crm' | 'system';

export interface AuthUser {
  sub: string;
  email: string;
  role: UserRole;
  name: string;
}

export interface AvailabilitySlot {
  startAt: string;
  endAt: string;
}
