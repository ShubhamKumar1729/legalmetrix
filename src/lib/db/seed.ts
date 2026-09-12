/**
 * Standalone seed script:  npm run seed
 *
 * - Always fills the in-memory demo store (users, rules, inspections, products).
 * - If MONGODB_URI is reachable, mirrors the same data into MongoDB so the
 *   database path can be demoed too. If not reachable, that's fine — the app
 *   automatically uses the in-memory store.
 */
import fs from 'fs';
import path from 'path';

// Minimal .env loader (keeps the script dependency-free when run via tsx)
const envPath = path.resolve(process.cwd(), '.env');
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2];
  }
}

async function main() {
  const { seedMemoryDB, memoryDB } = await import('./memory-store');
  await seedMemoryDB();
  console.log(`In-memory demo data ready: ${memoryDB.users.all().length} users, ${memoryDB.rules.all().length} rules, ${memoryDB.inspections.all().length} inspections, ${memoryDB.products.all().length} products`);

  try {
    const { connectDB, isDBConnected } = await import('./connection');
    const { hashPassword } = await import('../auth/auth');
    const models = await import('./models');
    const ok = await connectDB();
    if (ok && isDBConnected()) {
      const passwordHash = await hashPassword('Gov@2026');
      if ((await models.UserModel.countDocuments()) === 0) {
        await models.UserModel.create([
          { email: 'admin@gov.in', name: 'Super Administrator', officialId: 'GOV-SA-001', role: 'SUPER_ADMIN', department: 'Department of Consumer Affairs', passwordHash, active: true },
          { email: 'officer@gov.in', name: 'Rajesh Kumar', officialId: 'GOV-EO-042', role: 'ENFORCEMENT_OFFICER', department: 'Legal Metrology - Punjab', passwordHash, active: true },
          { email: 'reviewer@gov.in', name: 'Priya Sharma', officialId: 'GOV-RV-018', role: 'REVIEWER', department: 'Legal Metrology - Central', passwordHash, active: true },
          { email: 'analyst@gov.in', name: 'Amit Patel', officialId: 'GOV-AN-007', role: 'ANALYST', department: 'Enforcement Analytics', passwordHash, active: true },
        ]);
        console.log('MongoDB: created 4 demo users');
      }
      if ((await models.RegulatoryRuleModel.countDocuments()) === 0) {
        await models.RegulatoryRuleModel.create(
          memoryDB.rules.all().map(({ id, createdAt, updatedAt, ...r }: any) => ({
            ...r,
            effectiveFrom: new Date(r.effectiveFrom),
          }))
        );
        console.log(`MongoDB: imported ${memoryDB.rules.all().length} rules`);
      }
      console.log('Seeding complete (MongoDB path).');
    } else {
      console.log('MongoDB not reachable — the app will use the in-memory demo store automatically.');
    }
  } catch (e) {
    console.log('MongoDB step skipped:', (e as Error).message);
  }
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
