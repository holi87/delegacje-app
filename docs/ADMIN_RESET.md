# Reset hasła admina — CLI tool

## Problem

Admin utracił hasło, nie ma mechanizmu "zapomniałem hasła" (brak SMTP w MVP). Potrzebny jest sposób na reset hasła z poziomu serwera / kontenera Docker.

## Rozwiązanie

Skrypt CLI w backendzie: `backend/src/cli/reset-password.ts`

Uruchamiany:
- bezpośrednio w kontenerze Docker
- przez `docker compose exec`
- lokalnie w dev

## Użycie

### Z Dockera (produkcja):
```bash
# Reset hasła konkretnego usera po emailu
docker compose exec backend npx ts-node src/cli/reset-password.ts --email admin@firma.pl

# Reset z podanym hasłem (bez interaktywnego promptu)
docker compose exec backend npx ts-node src/cli/reset-password.ts --email admin@firma.pl --password NoweHaslo123!

# Reset pierwszego admina (jeśli nie pamiętasz emaila)
docker compose exec backend npx ts-node src/cli/reset-password.ts --first-admin

# Lista adminów
docker compose exec backend npx ts-node src/cli/reset-password.ts --list-admins
```

### Lokalnie (dev):
```bash
cd backend
npx ts-node src/cli/reset-password.ts --email admin@firma.pl
```

### Po buildzie (prod bez ts-node):
```bash
docker compose exec backend node dist/cli/reset-password.js --email admin@firma.pl
```

## Implementacja

### Plik: `backend/src/cli/reset-password.ts`

```typescript
#!/usr/bin/env node
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';
import { randomBytes } from 'crypto';
import { parseArgs } from 'util';

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

    console.log(`\n✅ Hasło zresetowane pomyślnie!`);
    console.log(`   Email:     ${user.email}`);
    console.log(`   Nowe hasło: ${newPassword}`);
    console.log(`\n⚠️  Zmień hasło po pierwszym logowaniu!\n`);
  } catch (error) {
    console.error('Błąd:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
```

## Lokalizacja pliku

```
backend/
├── src/
│   ├── cli/
│   │   └── reset-password.ts    # ← tutaj
│   ├── index.ts
│   └── ...
```

## Konfiguracja tsconfig

Upewnij się, że `backend/tsconfig.json` kompiluje folder `cli/`:
```json
{
  "include": ["src/**/*"]
}
```

## Script w package.json

```json
{
  "scripts": {
    "cli:reset-password": "ts-node src/cli/reset-password.ts",
    "cli:list-admins": "ts-node src/cli/reset-password.ts --list-admins"
  }
}
```

Użycie z npm:
```bash
docker compose exec backend npm run cli:reset-password -- --email admin@firma.pl
docker compose exec backend npm run cli:list-admins
```

## Dockerfile — uwaga

W produkcyjnym Dockerfile upewnij się, że plik CLI jest włączony do builda:
```dockerfile
# W multi-stage build, kopiuj też dist/cli/
COPY --from=builder /app/dist ./dist
```

## Bezpieczeństwo

1. Skrypt wymaga dostępu do kontenera / serwera — nie jest dostępny przez HTTP
2. Wygenerowane hasło wyświetlane TYLKO na stdout — nie logowane do pliku
3. Wymusza `isActive: true` — odblokowuje konto
4. Min. 8 znaków jeśli podawane ręcznie
5. bcrypt z 12 rundami (taki sam jak w auth service)
