import { BadRequestException, ConflictException, ForbiddenException } from '@nestjs/common';
import { AppointmentsService } from './appointments.service';

function createService(overrides: Partial<Record<string, any>> = {}) {
  const config = overrides.config ?? { get: jest.fn() };
  const appointmentModel = {
    create: jest.fn(),
    deleteMany: jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue({ deletedCount: 1 }) }),
    findById: jest.fn(),
    findOne: jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue(null) }),
  };
  const service = new AppointmentsService(
    appointmentModel as any,
    { add: jest.fn() } as any,
    { findAdmin: jest.fn().mockResolvedValue({ _id: 'admin-id' }) } as any,
    { touchBooked: jest.fn() } as any,
    { isSlotBookable: jest.fn().mockResolvedValue(true) } as any,
    { create: jest.fn() } as any,
    {} as any,
    config as any,
  );

  return {
    service,
    appointmentModel,
    config,
    ...(overrides as any),
  };
}

describe('AppointmentsService booking safeguards', () => {
  it('rejects appointments that are not bookable configured slots', async () => {
    const { service } = createService();
    (service as any).availabilityService.isSlotBookable.mockResolvedValue(false);

    await expect(
      service.create(
        { sub: 'patient-id', email: 'p@example.com', role: 'patient', name: 'Patient' },
        { startAt: '2030-01-01T10:00:00.000Z', endAt: '2030-01-01T10:50:00.000Z' },
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects invalid appointment dates before checking availability', async () => {
    const { service } = createService();

    await expect(
      service.create(
        { sub: 'patient-id', email: 'p@example.com', role: 'patient', name: 'Patient' },
        { startAt: 'not-a-date', endAt: '2030-01-01T10:50:00.000Z' },
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect((service as any).availabilityService.isSlotBookable).not.toHaveBeenCalled();
  });

  it('rejects a new appointment when the patient already has an upcoming active appointment', async () => {
    const { service, appointmentModel } = createService();
    appointmentModel.findOne.mockReturnValue({
      exec: jest.fn().mockResolvedValue({
        startAt: new Date('2030-01-02T16:00:00.000Z'),
      }),
    });

    await expect(
      service.create(
        { sub: 'patient-id', email: 'p@example.com', role: 'patient', name: 'Patient' },
        { startAt: '2030-01-01T10:00:00.000Z', endAt: '2030-01-01T10:50:00.000Z' },
      ),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(appointmentModel.create).not.toHaveBeenCalled();
  });

  it('excludes the old appointment when validating a reschedule', async () => {
    const { service, appointmentModel } = createService();
    const oldAppointment = {
      _id: { toString: () => 'old-id' },
      patientId: { toString: () => 'patient-id' },
      status: 'confirmed',
      reason: 'Follow up',
      save: jest.fn(),
    };
    const newAppointment = {
      _id: { toString: () => 'new-id' },
      rescheduledFrom: undefined,
      save: jest.fn(),
    };
    appointmentModel.findById.mockReturnValue({ exec: jest.fn().mockResolvedValue(oldAppointment) });
    appointmentModel.create.mockResolvedValue(newAppointment);

    await service.reschedule(
      'old-id',
      { sub: 'patient-id', email: 'p@example.com', role: 'patient', name: 'Patient' },
      { startAt: '2030-01-01T10:00:00.000Z', endAt: '2030-01-01T10:50:00.000Z' },
    );

    expect(appointmentModel.findOne).toHaveBeenCalledWith(
      expect.objectContaining({
        _id: { $ne: 'old-id' },
        patientId: 'patient-id',
      }),
    );
  });

  it('does not cancel the old appointment when the new reschedule slot fails', async () => {
    const { service, appointmentModel } = createService();
    const oldAppointment = {
      _id: 'old-id',
      patientId: { toString: () => 'patient-id' },
      status: 'confirmed',
      reason: 'Follow up',
      save: jest.fn(),
    };
    appointmentModel.findById.mockReturnValue({ exec: jest.fn().mockResolvedValue(oldAppointment) });
    jest.spyOn(service, 'create').mockRejectedValue(new BadRequestException('slot unavailable'));

    await expect(
      service.reschedule(
        'old-id',
        { sub: 'patient-id', email: 'p@example.com', role: 'patient', name: 'Patient' },
        { startAt: '2030-01-01T10:00:00.000Z', endAt: '2030-01-01T10:50:00.000Z' },
      ),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(oldAppointment.status).toBe('confirmed');
    expect(oldAppointment.save).not.toHaveBeenCalled();
  });

  it('allows delete all in development for test cleanup', async () => {
    const { service } = createService();

    await expect(service.deleteAll()).resolves.toEqual({ ok: true, deletedCount: 1 });
  });

  it('protects delete all in production unless the explicit flag is enabled', async () => {
    const config = { get: jest.fn((key: string) => (key === 'NODE_ENV' ? 'production' : undefined)) };
    const { service } = createService({ config });

    await expect(service.deleteAll()).rejects.toBeInstanceOf(ForbiddenException);
  });
});
