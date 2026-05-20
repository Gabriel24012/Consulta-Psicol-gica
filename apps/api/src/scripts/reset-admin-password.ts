import 'reflect-metadata';
import * as argon2 from 'argon2';
import mongoose from 'mongoose';
import { config } from 'dotenv';
import { UserSchema } from '../modules/users/schemas/user.schema';

config({ path: '.env' });
config({ path: '../../.env' });

async function main() {
  const uri = process.env.MONGODB_URI;
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;

  if (!uri) {
    throw new Error('MONGODB_URI no está configurado.');
  }
  if (!email || !password) {
    throw new Error('ADMIN_EMAIL y ADMIN_PASSWORD deben estar configurados.');
  }

  await mongoose.connect(uri);
  const User = mongoose.model('User', UserSchema);
  const admin = await User.findOne({ email, role: 'admin' }).select('+passwordHash').exec();

  if (!admin) {
    throw new Error(`No existe admin con correo ${email}. Ejecuta seed:admin primero.`);
  }

  admin.passwordHash = await argon2.hash(password);
  admin.refreshTokenHash = undefined;
  await admin.save();
  console.log(`Contraseña actualizada para admin: ${email}`);
  await mongoose.disconnect();
}

main().catch(async (error) => {
  console.error(error.message ?? error);
  await mongoose.disconnect();
  process.exit(1);
});
