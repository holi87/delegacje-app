#!/usr/bin/env node
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';
import { randomBytes } from 'crypto';
import { parseArgs } from 'node:util';

const prisma = new PrismaClient();

async function main() {
  const { values } = parseArgs({
    options: {
      email: { type: 'string' },
      password: { type: 'string' },
      'first-admin': { type: 'boolean', default: false },
      'list-admins': { type: 'boolean', default: false },
    },
  });

  try {
    // --- List admins ---
    if (values['list-admins']) {
      const admins = await prisma.user.findMany({
        where: { role: 'ADMIN' },
        include: { profile: true },
        orderBy: { createdAt: 'asc' },
      });

      if (admins.length === 0) {
        console.log('Brak adminów w bazie. Uruchom Setup Wizard.');
        process.exit(0);
      }

      console.log('\nAdministratorzy:\n');
      for (const admin of admins) {
        const name = admin.profile
          ? `${admin.profile.firstName} ${admin.profile.lastName}`
          : '(brak profilu)';
        const status = admin.isActive ? 'aktywny' : 'NIEAKTYWNY';
        console.log(`  ${admin.email}  —  ${name}  [${status}]`);
      }
      console.log('');
      process.exit(0);
    }

    // --- Find user ---
    let user;
    if (values['first-admin']) {
      user = await prisma.user.findFirst({
        where: { role: 'ADMIN' },
        orderBy: { createdAt: 'asc' },
      });
      if (!user) {
        console.error('Brak adminów w bazie. Uruchom Setup Wizard.');
        process.exit(1);
      }
      console.log(`Znaleziono pierwszego admina: ${user.email}`);
    } else if (values.email) {
      user = await prisma.user.findUnique({
        where: { email: values.email },
      });
      if (!user) {
        console.error(`Nie znaleziono użytkownika: ${values.email}`);
        process.exit(1);
      }
    } else {
      console.error(
        'Użycie:\n' +
        '  --email <email>       Reset hasła użytkownika\n' +
        '  --first-admin         Reset hasła pierwszego admina\n' +
        '  --password <haslo>    Ustaw konkretne hasło (opcjonalnie)\n' +
        '  --list-admins         Wyświetl listę adminów\n'
      );
      process.exit(1);
    }

    // --- Generate or use password ---
    let newPassword: string;
    if (values.password) {
      if (values.password.length < 8) {
        console.error('Hasło musi mieć minimum 8 znaków.');
        process.exit(1);
      }
      newPassword = values.password;
    } else {
      // Generate random password
      newPassword = randomBytes(12).toString('base64url').slice(0, 16);
    }

    // --- Hash and update ---
    const passwordHash = await bcrypt.hash(newPassword, 12);
    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash,
        isActive: true, // odblokuj konto jeśli było zablokowane
      },
    });

    console.log(`\nHasło zresetowane pomyślnie!`);
    console.log(`   Email:     ${user.email}`);
    console.log(`   Nowe hasło: ${newPassword}`);
    console.log(`\n   Zmień hasło po pierwszym logowaniu!\n`);
  } catch (error) {
    console.error('Błąd:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
