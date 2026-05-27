import { BadRequestException, ConflictException } from '@nestjs/common';
import { UsersService } from './users.service';

describe('UsersService email validation', () => {
  it('rejects duplicate emails during normal registration using normalized email', async () => {
    const userModel = {
      exists: jest.fn().mockResolvedValueOnce(true),
      create: jest.fn(),
    };
    const service = new UsersService(userModel as any);

    await expect(
      service.create({
        name: 'Paciente',
        email: '  Patient@Example.com ',
        phone: '4491234567',
        passwordHash: 'hash',
      }),
    ).rejects.toBeInstanceOf(ConflictException);

    expect(userModel.exists).toHaveBeenCalledWith({ email: 'patient@example.com' });
    expect(userModel.create).not.toHaveBeenCalled();
  });

  it('rejects duplicate phones during normal registration using normalized phone', async () => {
    const userModel = {
      exists: jest.fn().mockResolvedValueOnce(false).mockResolvedValueOnce(true),
      aggregate: jest.fn(),
      create: jest.fn(),
    };
    const service = new UsersService(userModel as any);

    await expect(
      service.create({
        name: 'Paciente',
        email: 'patient@example.com',
        phone: ' +52 (449) 123-4567 ',
        passwordHash: 'hash',
      }),
    ).rejects.toBeInstanceOf(ConflictException);

    expect(userModel.exists).toHaveBeenCalledWith({ email: 'patient@example.com' });
    expect(userModel.exists).toHaveBeenCalledWith({ phoneNormalized: { $in: ['4491234567', '524491234567'] } });
    expect(userModel.create).not.toHaveBeenCalled();
  });

  it('rejects duplicate phones from legacy users without phoneNormalized', async () => {
    const aggregateExec = jest.fn().mockResolvedValue([{ _id: 'existing-id' }]);
    const userModel = {
      exists: jest.fn().mockResolvedValueOnce(false).mockResolvedValueOnce(false),
      aggregate: jest.fn().mockReturnValue({ exec: aggregateExec }),
      create: jest.fn(),
    };
    const service = new UsersService(userModel as any);

    await expect(
      service.create({
        name: 'Paciente',
        email: 'patient@example.com',
        phone: '+52 (449) 123-4567',
        passwordHash: 'hash',
      }),
    ).rejects.toBeInstanceOf(ConflictException);

    expect(userModel.aggregate).toHaveBeenCalled();
    expect(userModel.create).not.toHaveBeenCalled();
  });

  it('rejects duplicate emails when completing an invited patient profile', async () => {
    const userModel = {
      exists: jest.fn().mockResolvedValueOnce(true),
      findById: jest.fn(),
    };
    const service = new UsersService(userModel as any);

    await expect(
      service.completeIncompletePatient('patient-id', {
        name: 'Paciente',
        email: '  Patient@Example.com ',
        phone: '4491234567',
        passwordHash: 'hash',
        privacyConsentAcceptedAt: new Date(),
      }),
    ).rejects.toBeInstanceOf(ConflictException);

    expect(userModel.exists).toHaveBeenCalledWith({ email: 'patient@example.com', _id: { $ne: 'patient-id' } });
    expect(userModel.findById).not.toHaveBeenCalled();
  });

  it('rejects duplicate phones when completing an invited patient profile', async () => {
    const userModel = {
      exists: jest.fn().mockResolvedValueOnce(false).mockResolvedValueOnce(true),
      aggregate: jest.fn(),
      findById: jest.fn(),
    };
    const service = new UsersService(userModel as any);

    await expect(
      service.completeIncompletePatient('patient-id', {
        name: 'Paciente',
        email: 'patient@example.com',
        phone: ' +52 (449) 123-4567 ',
        passwordHash: 'hash',
        privacyConsentAcceptedAt: new Date(),
      }),
    ).rejects.toBeInstanceOf(ConflictException);

    expect(userModel.exists).toHaveBeenCalledWith({ email: 'patient@example.com', _id: { $ne: 'patient-id' } });
    expect(userModel.exists).toHaveBeenCalledWith({ phoneNormalized: { $in: ['4491234567', '524491234567'] }, _id: { $ne: 'patient-id' } });
    expect(userModel.findById).not.toHaveBeenCalled();
  });

  it('rejects incomplete phone numbers', async () => {
    const userModel = {
      exists: jest.fn().mockResolvedValueOnce(false),
      create: jest.fn(),
    };
    const service = new UsersService(userModel as any);

    await expect(
      service.create({
        name: 'Paciente',
        email: 'patient@example.com',
        phone: '44',
        passwordHash: 'hash',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(userModel.create).not.toHaveBeenCalled();
  });

  it('rejects phone numbers with letters', async () => {
    const userModel = {
      exists: jest.fn().mockResolvedValueOnce(false),
      create: jest.fn(),
    };
    const service = new UsersService(userModel as any);

    await expect(
      service.create({
        name: 'Paciente',
        email: 'patient@example.com',
        phone: '449ABC4567',
        passwordHash: 'hash',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(userModel.create).not.toHaveBeenCalled();
  });
});
