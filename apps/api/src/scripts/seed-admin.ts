import 'reflect-metadata';
import * as argon2 from 'argon2';
import mongoose from 'mongoose';
import { config } from 'dotenv';
import { UserSchema } from '../modules/users/schemas/user.schema';

config({ path: '.env' });
config({ path: '../../.env' });

async function main() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error('MONGODB_URI no está configurado.');
  }

  const email = process.env.ADMIN_EMAIL ?? 'admin@consulta.local';
  const password = process.env.ADMIN_PASSWORD ?? 'CambiarPassword123!';
  const name = process.env.ADMIN_NAME ?? 'Psicólogo Administrador';
  const phone = process.env.ADMIN_PHONE ?? '+520000000000';

  await mongoose.connect(uri);
  const User = mongoose.model('User', UserSchema);
  const exists = await User.exists({ email });
  if (exists) {
    console.log(`Admin existente: ${email}`);
    await mongoose.disconnect();
    return;
  }

  await User.create({
    name,
    email,
    phone,
    role: 'admin',
    status: 'active',
    passwordHash: await argon2.hash(password),
    privacyConsentAcceptedAt: new Date(),
  });

  console.log(`Admin creado: ${email}`);
  console.log('Cambia ADMIN_PASSWORD después del primer acceso.');
  await mongoose.disconnect();
}

main().catch(async (error) => {
  console.error(error);
  await mongoose.disconnect();
  process.exit(1);
});
