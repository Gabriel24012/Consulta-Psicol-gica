import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { AppointmentsService } from './appointments.service';

@Processor('appointments')
export class AppointmentsProcessor extends WorkerHost {
  constructor(private readonly appointmentsService: AppointmentsService) {
    super();
  }

  async process(job: Job<{ appointmentId: string }>) {
    if (job.name !== 'appointment-reminder') {
      return;
    }
    await this.appointmentsService.sendAppointmentReminder(job.data.appointmentId);
  }
}
