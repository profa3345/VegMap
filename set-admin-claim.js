// ═══════════════════════════════════════════════════════════════════
// EDENA — Script para definir/revogar custom claim de admin
//
// Pré-requisitos:
//   1. Node.js instalado
//   2. firebase-admin instalado: npm install firebase-admin
//   3. Service Account JSON baixado do Firebase Console:
//      Firebase Console → Configurações do projeto → Contas de serviço
//      → "Gerar nova chave privada" → salve como serviceAccount.json
//      na mesma pasta deste script
//
// Uso:
//   Definir admin:   node set-admin-claim.js set   email@exemplo.com
//   Revogar admin:   node set-admin-claim.js revoke email@exemplo.com
//   Checar claims:   node set-admin-claim.js check  email@exemplo.com
//   Listar admins:   node set-admin-claim.js list
// ═══════════════════════════════════════════════════════════════════

const admin = require('firebase-admin');
const path  = require('path');

// ── Inicialização ─────────────────────────────────────────────────
const serviceAccount = require(path.join(__dirname, 'serviceAccount.json'));

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

// ── Args ──────────────────────────────────────────────────────────
const [,, command, target] = process.argv;
const COMMANDS = ['set', 'revoke', 'check', 'list'];

if (!command || !COMMANDS.includes(command)) {
  console.error(`
Uso:
  node set-admin-claim.js set    email@exemplo.com   → torna admin
  node set-admin-claim.js revoke email@exemplo.com   → remove admin
  node set-admin-claim.js check  email@exemplo.com   → mostra claims
  node set-admin-claim.js list                       → lista todos os admins
`);
  process.exit(1);
}

if (command !== 'list' && !target) {
  console.error('❌ Informe o e-mail do usuário.');
  process.exit(1);
}

// ── Helpers ───────────────────────────────────────────────────────
async function getUserByEmail(email) {
  try {
    return await admin.auth().getUserByEmail(email);
  } catch (e) {
    if (e.code === 'auth/user-not-found') {
      console.error(`❌ Nenhum usuário encontrado com o e-mail: ${email}`);
      process.exit(1);
    }
    throw e;
  }
}

function formatClaims(user) {
  const claims = user.customClaims || {};
  return Object.keys(claims).length
    ? JSON.stringify(claims, null, 2)
    : '(nenhum claim definido)';
}

// ── Comandos ──────────────────────────────────────────────────────
async function setClaim(email) {
  const user = await getUserByEmail(email);
  const current = user.customClaims || {};

  if (current.admin === true) {
    console.log(`ℹ️  ${email} já é admin. Nada alterado.`);
    return;
  }

  await admin.auth().setCustomUserClaims(user.uid, { ...current, admin: true });
  console.log(`✅ Custom claim { admin: true } definido para ${email} (uid: ${user.uid})`);
  console.log('⚠️  O usuário precisa fazer logout e login novamente para o claim ser aplicado no token.');
}

async function revokeClaim(email) {
  const user = await getUserByEmail(email);
  const current = { ...(user.customClaims || {}) };

  if (!current.admin) {
    console.log(`ℹ️  ${email} não é admin. Nada alterado.`);
    return;
  }

  delete current.admin;
  await admin.auth().setCustomUserClaims(user.uid, current);
  console.log(`✅ Claim admin removido de ${email} (uid: ${user.uid})`);
  console.log('⚠️  O usuário precisa fazer logout e login novamente para a mudança ter efeito.');
}

async function checkClaims(email) {
  const user = await getUserByEmail(email);
  console.log(`\nUsuário: ${user.email} (uid: ${user.uid})`);
  console.log(`Claims:\n${formatClaims(user)}`);
  console.log(`Admin: ${user.customClaims?.admin === true ? '✅ SIM' : '❌ NÃO'}`);
}

async function listAdmins() {
  console.log('Listando usuários com admin: true...\n');
  let pageToken;
  const admins = [];

  do {
    const result = await admin.auth().listUsers(1000, pageToken);
    result.users.forEach(u => {
      if (u.customClaims?.admin === true) {
        admins.push({ email: u.email, uid: u.uid });
      }
    });
    pageToken = result.pageToken;
  } while (pageToken);

  if (admins.length === 0) {
    console.log('Nenhum admin encontrado.');
  } else {
    console.log(`${admins.length} admin(s) encontrado(s):\n`);
    admins.forEach(a => console.log(`  • ${a.email}  (uid: ${a.uid})`));
  }
}

// ── Main ──────────────────────────────────────────────────────────
(async () => {
  try {
    if (command === 'set')    await setClaim(target);
    if (command === 'revoke') await revokeClaim(target);
    if (command === 'check')  await checkClaims(target);
    if (command === 'list')   await listAdmins();
  } catch (e) {
    console.error('❌ Erro:', e.message);
    process.exit(1);
  } finally {
    process.exit(0);
  }
})();
