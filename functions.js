// ═══════════════════════════════════════════════════════════════════
// EDENA — Cloud Functions (Node.js 20 + Firebase Admin SDK)
// Deploy: firebase deploy --only functions
// ═══════════════════════════════════════════════════════════════════

const functions  = require('firebase-functions/v2/https');
const { onCall, HttpsError } = require('firebase-functions/v2/https');
const admin   = require('firebase-admin');

admin.initializeApp();
const db = admin.firestore();

// ── Sanitização server-side ──────────────────────────────────────
function sanitize(s, max = 200) {
  return String(s ?? '').replace(/<[^>]*>/g, '').trim().slice(0, max);
}

// ── Valida formato de ID do Firestore (20 chars alfanuméricos) ──────────
function validarId(id) {
  if (typeof id !== 'string') return false;
  // IDs do Firestore gerados automaticamente: 20 chars [a-zA-Z0-9]
  // IDs manuais aceitos até 128 chars alfanuméricos (sem path traversal)
  return /^[a-zA-Z0-9_-]{1,128}$/.test(id);
}

// ── Rate limit por UID (Firestore-based) ────────────────────────
async function checkRateLimit(uid, key, max, windowMs) {
  const ref   = db.collection('_ratelimits').doc(`${uid}_${key}`);
  const now   = Date.now();
  const cutoff = now - windowMs;

  return db.runTransaction(async t => {
    const snap = await t.get(ref);
    // Filtra hits dentro da janela e limita o array a 2× o máximo
    // para evitar crescimento ilimitado do documento no Firestore.
    const raw  = (snap.data()?.hits || []).filter(ts => typeof ts === 'number' && ts > cutoff);
    const hits = raw.slice(-(max * 2)); // guarda no máximo 2×max entradas recentes
    if (hits.length >= max) throw new HttpsError('resource-exhausted', 'Rate limit atingido. Tente mais tarde.');
    hits.push(now);
    t.set(ref, { hits, updatedAt: now }, { merge: true });
  });
}

// ════════════════════════════════════════════════════════════════
// 1. CADASTRAR RESTAURANTE
// ════════════════════════════════════════════════════════════════
exports.cadastrarRestaurante = onCall({ region: 'southamerica-east1' }, async (req) => {
  const { auth, data } = req;
  if (!auth) throw new HttpsError('unauthenticated', 'Login necessário');

  // Rate limit: 3 cadastros por hora por usuário
  await checkRateLimit(auth.uid, 'cadastro', 3, 60 * 60 * 1000);

  // Validação de campos obrigatórios
  const nome   = sanitize(data.nome, 100);
  const cidade = data.cidade;
  const tipo   = sanitize(data.tipo, 80);
  const CIDADES = ['Vitoria','Vila Velha','Cariacica','Serra','Guarapari','Linhares','Cachoeiro','Colatina'];

  if (!nome || nome.length < 3)       throw new HttpsError('invalid-argument', 'Nome inválido');
  if (!CIDADES.includes(cidade))       throw new HttpsError('invalid-argument', 'Cidade inválida');
  if (!tipo || tipo.length < 3)        throw new HttpsError('invalid-argument', 'Tipo inválido');

  // Verifica duplicata
  const dup = await db.collection('restaurantes')
    .where('nome_norm', '==', nome.toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu,''))
    .where('cidade', '==', cidade)
    .limit(1).get();
  if (!dup.empty) throw new HttpsError('already-exists', 'Restaurante já cadastrado nesta cidade');

  // Valida preco
  const PRECOS = ['$','$$','$$$'];
  const preco = PRECOS.includes(data.preco) ? data.preco : '$$';

  const doc = {
    nome,
    nome_norm: nome.toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu,''),
    cidade,
    tipo,
    bairro:    sanitize(data.bairro, 60),
    preco,
    telefone:  (data.telefone || '').replace(/[^\d\s()\-+]/g,'').slice(0,20),
    horario:   sanitize(data.horario, 60),
    descricao: sanitize(data.descricao, 400),
    tags:      Array.isArray(data.tags) ? data.tags.filter(t => typeof t==='string').slice(0,10).map(t=>sanitize(t,30)) : ['vegano'],
    delivery:  !!data.delivery,
    acessivel: !!data.acessivel,
    semgluten: !!data.semgluten,
    fotoUrl:   (() => {
      // Aceita apenas URLs https:// de domínios confiáveis (Firebase Storage, Imgur, etc.)
      const ALLOWED_FOTO_HOSTS = [
        'firebasestorage.googleapis.com',
        'storage.googleapis.com',
        'lh3.googleusercontent.com',
        'i.imgur.com',
      ];
      if (typeof data.fotoUrl !== 'string') return null;
      try {
        const u = new URL(data.fotoUrl);
        if (u.protocol !== 'https:') return null;
        if (!ALLOWED_FOTO_HOSTS.some(h => u.hostname === h || u.hostname.endsWith('.' + h))) return null;
        return data.fotoUrl;
      } catch { return null; }
    })(),
    lat:       typeof data.lat === 'number' ? data.lat : null,
    lng:       typeof data.lng === 'number' ? data.lng : null,
    emoji:     '🌿',
    rating:    0,
    reviews:   0,
    aberto:    false,
    novo:      true,
    destaque:  false, // NUNCA aceito do cliente
    promo:     false, // NUNCA aceito do cliente
    pratos:    [],
    donoId:    auth.uid,
    // donoEmail removido do documento público para proteger a privacidade do dono.
    // O e-mail fica apenas em /usuarios/{uid} que tem regras de leitura restrita.
    criadoEm:  admin.firestore.FieldValue.serverTimestamp(),
  };

  const ref = await db.collection('restaurantes').add(doc);

  // Atualiza role do usuário
  await db.collection('usuarios').doc(auth.uid).set({
    role:        'restaurante',
    email:       auth.token.email || '',
    atualizadoEm: admin.firestore.FieldValue.serverTimestamp(),
  }, { merge: true });

  return { id: ref.id, success: true };
});

// ════════════════════════════════════════════════════════════════
// 2. CRIAR REVIEW
// ════════════════════════════════════════════════════════════════
exports.criarReview = onCall({ region: 'southamerica-east1' }, async (req) => {
  const { auth, data } = req;
  if (!auth) throw new HttpsError('unauthenticated', 'Login necessário');

  const { restauranteId, rating, texto } = data;
  if (!validarId(restauranteId)) throw new HttpsError('invalid-argument', 'ID de restaurante inválido');

  // Verifica se o restaurante existe antes de qualquer operação
  const restRef  = db.collection('restaurantes').doc(restauranteId);
  const restSnap = await restRef.get();
  if (!restSnap.exists) throw new HttpsError('not-found', 'Restaurante não encontrado');
  if (typeof rating !== 'number' || rating < 1 || rating > 5) throw new HttpsError('invalid-argument', 'Nota deve ser 1-5');
  const textoClean = sanitize(texto, 300);
  if (!textoClean || textoClean.length < 10) throw new HttpsError('invalid-argument', 'Texto muito curto');

  // Rate limit: 10 reviews por dia
  await checkRateLimit(auth.uid, 'reviews', 10, 24 * 60 * 60 * 1000);

  // 1 review por restaurante por usuário
  const prevQ = await db.collection('restaurantes').doc(restauranteId)
    .collection('reviews').where('uid','==',auth.uid).limit(1).get();
  if (!prevQ.empty) throw new HttpsError('already-exists', 'Você já avaliou este restaurante');

  // Salva review e recalcula rating em transação única para evitar race condition.
  // A review entra como aprovada:false — o rating SÓ muda quando um admin aprovar.
  // O recálculo aqui é preventivo: se houver reviews aprovadas anteriores, mantém correto.
  await db.runTransaction(async t => {
    // 1. Verifica duplicata dentro da transação (evita dupla submissão concorrente)
    const prevSnap = await t.get(
      db.collection('restaurantes').doc(restauranteId)
        .collection('reviews').where('uid','==',auth.uid).limit(1)
    );
    if (!prevSnap.empty) throw new HttpsError('already-exists', 'Você já avaliou este restaurante');

    // 2. Cria a review
    const reviewRef = db.collection('restaurantes').doc(restauranteId).collection('reviews').doc();
    t.set(reviewRef, {
      uid:           auth.uid,
      userName:      sanitize(auth.token.name || auth.token.email?.split('@')[0] || 'Anônimo', 50),
      rating,
      texto:         textoClean,
      criadoEm:      admin.firestore.FieldValue.serverTimestamp(),
      aprovada:      false,
      pendenteSince: admin.firestore.FieldValue.serverTimestamp(),
    });

    // 3. Recalcula rating com base apenas nas reviews JÁ aprovadas (a nova ainda é false)
    //    Protege contra NaN quando não há reviews aprovadas.
    const aprovSnap = await t.get(
      db.collection('restaurantes').doc(restauranteId)
        .collection('reviews').where('aprovada','==',true)
    );
    if (aprovSnap.size > 0) {
      const total = aprovSnap.docs.reduce((s,d) => s + (d.data().rating || 0), 0);
      const avg   = Math.round((total / aprovSnap.size) * 10) / 10;
      t.update(restRef, { rating: avg, reviews: aprovSnap.size });
    }
    // Se não há aprovadas ainda, não altera rating (evita NaN/0 no campo)
  });

  return { success: true };
});

// ════════════════════════════════════════════════════════════════
// 3. ATIVAR PLANO PRO (chamado após pagamento confirmado)
// ════════════════════════════════════════════════════════════════
exports.ativarPlanoPro = onCall({ region: 'southamerica-east1' }, async (req) => {
  const { auth, data } = req;
  if (!auth) throw new HttpsError('unauthenticated', 'Login necessário');

  const { restauranteId, paymentRef } = data;
  if (!validarId(restauranteId) || !paymentRef || typeof paymentRef !== 'string') {
    throw new HttpsError('invalid-argument', 'Dados incompletos ou inválidos');
  }

  // Verifica ownership: apenas o dono do restaurante pode ativar PRO nele
  const restSnap = await db.collection('restaurantes').doc(restauranteId).get();
  if (!restSnap.exists) throw new HttpsError('not-found', 'Restaurante não encontrado');

  const isAdmin = auth.token.admin === true; // custom claim definido via Admin SDK
  if (!isAdmin && restSnap.data().donoId !== auth.uid) {
    throw new HttpsError('permission-denied', 'Você não é o dono deste restaurante');
  }

  // ── VALIDAÇÃO DE PAGAMENTO (obrigatória em produção) ──────────────────
  // Descomente e configure com seu provedor antes do deploy em produção.
  // Opção A — Stripe:
  //   const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
  //   const session = await stripe.checkout.sessions.retrieve(paymentRef);
  //   if (session.payment_status !== 'paid') {
  //     throw new HttpsError('failed-precondition', 'Pagamento não confirmado');
  //   }
  //   if (session.metadata?.restauranteId !== restauranteId) {
  //     throw new HttpsError('invalid-argument', 'Pagamento não corresponde a este restaurante');
  //   }
  //
  // Opção B — Mercado Pago:
  //   const mp = new MercadoPago({ accessToken: process.env.MP_ACCESS_TOKEN });
  //   const payment = await mp.payment.get(paymentRef);
  //   if (payment.status !== 'approved') {
  //     throw new HttpsError('failed-precondition', 'Pagamento não aprovado');
  //   }
  // ─────────────────────────────────────────────────────────────────────

  // 🚨 REMOVA O BLOCO ABAIXO EM PRODUÇÃO (existe apenas para testes em DEV)
  if (process.env.FUNCTIONS_EMULATOR !== 'true') {
    // Em produção sem validação de pagamento ativa, bloqueia por segurança
    // até que o TODO acima seja implementado.
    // Comente esta linha quando integrar o SDK do Stripe/MP.
    throw new HttpsError('unimplemented', 'Validação de pagamento não configurada em produção');
  }

  await db.collection('restaurantes').doc(restauranteId).update({
    destaque: true,
    plano:    'pro',
    planoAte: admin.firestore.Timestamp.fromDate(new Date(Date.now() + 30*24*60*60*1000)),
  });

  await db.collection('usuarios').doc(auth.uid).set({
    plano:       'pro',
    atualizadoEm: admin.firestore.FieldValue.serverTimestamp(),
  }, { merge: true });

  return { success: true };
});

// ════════════════════════════════════════════════════════════════
// 4. ATUALIZAR ABERTO/FECHADO (dono do restaurante)
// ════════════════════════════════════════════════════════════════
exports.toggleAberto = onCall({ region: 'southamerica-east1' }, async (req) => {
  const { auth, data } = req;
  if (!auth) throw new HttpsError('unauthenticated', 'Login necessário');

  if (!validarId(data.restauranteId)) throw new HttpsError('invalid-argument', 'ID inválido');
  const ref  = db.collection('restaurantes').doc(data.restauranteId);
  const snap = await ref.get();
  if (!snap.exists) throw new HttpsError('not-found', 'Restaurante não encontrado');
  if (snap.data().donoId !== auth.uid) throw new HttpsError('permission-denied', 'Acesso negado');

  await ref.update({ aberto: !!data.aberto });
  return { success: true };
});

// ════════════════════════════════════════════════════════════════
// 5. MODERAÇÃO ADMIN — aprovar/rejeitar restaurantes e reviews
//    Requer custom claim `admin: true` no token do usuário.
//    Para definir: admin.auth().setCustomUserClaims(uid, { admin: true })
// ════════════════════════════════════════════════════════════════
const { onCall: onCallAdmin } = require('firebase-functions/v2/https');

function assertAdmin(auth) {
  if (!auth) throw new HttpsError('unauthenticated', 'Login necessário');
  if (auth.token.admin !== true) throw new HttpsError('permission-denied', 'Acesso restrito a administradores');
}

exports.aprovarRestaurante = onCall({ region: 'southamerica-east1' }, async (req) => {
  assertAdmin(req.auth);
  const { restauranteId } = req.data;
  if (!validarId(restauranteId)) throw new HttpsError('invalid-argument', 'ID inválido');

  const ref  = db.collection('restaurantes').doc(restauranteId);
  const snap = await ref.get();
  if (!snap.exists) throw new HttpsError('not-found', 'Restaurante não encontrado');

  await ref.update({
    aprovado:      true,
    aprovadoEm:    admin.firestore.FieldValue.serverTimestamp(),
    aprovadoPor:   req.auth.uid,
  });

  // Notifica o dono via documento de notificação (processado por Trigger Email extension)
  const donoId = snap.data().donoId;
  if (donoId) {
    const usuarioSnap = await db.collection('usuarios').doc(donoId).get();
    const email = usuarioSnap.data()?.email;
    if (email) {
      await db.collection('mail').add({
        to:      email,
        message: {
          subject: '✅ Seu estabelecimento foi aprovado no EDENA!',
          text:    `Olá! Seu estabelecimento "${snap.data().nome}" foi aprovado e já está visível para todos os usuários do EDENA. Obrigado por fazer parte da nossa comunidade vegana do ES!`,
        },
      });
    }
  }

  return { success: true };
});

exports.rejeitarRestaurante = onCall({ region: 'southamerica-east1' }, async (req) => {
  assertAdmin(req.auth);
  const { restauranteId, motivo } = req.data;
  if (!validarId(restauranteId)) throw new HttpsError('invalid-argument', 'ID inválido');

  const ref  = db.collection('restaurantes').doc(restauranteId);
  const snap = await ref.get();
  if (!snap.exists) throw new HttpsError('not-found', 'Restaurante não encontrado');

  // Notifica o dono antes de deletar
  const donoId = snap.data().donoId;
  if (donoId) {
    const usuarioSnap = await db.collection('usuarios').doc(donoId).get();
    const email = usuarioSnap.data()?.email;
    if (email) {
      await db.collection('mail').add({
        to:      email,
        message: {
          subject: 'Atualização sobre seu cadastro no EDENA',
          text:    `Olá! Seu cadastro de "${snap.data().nome}" foi revisado e não pôde ser aprovado no momento.${motivo ? '\n\nMotivo: ' + motivo : ''}\n\nSe tiver dúvidas, entre em contato com nossa equipe.`,
        },
      });
    }
  }

  await ref.delete();
  return { success: true };
});

exports.aprovarReview = onCall({ region: 'southamerica-east1' }, async (req) => {
  assertAdmin(req.auth);
  const { restauranteId, reviewId } = req.data;
  if (!validarId(restauranteId) || !validarId(reviewId)) {
    throw new HttpsError('invalid-argument', 'IDs inválidos');
  }

  const restRef   = db.collection('restaurantes').doc(restauranteId);
  const reviewRef = restRef.collection('reviews').doc(reviewId);

  await db.runTransaction(async t => {
    const reviewSnap = await t.get(reviewRef);
    if (!reviewSnap.exists) throw new HttpsError('not-found', 'Review não encontrada');
    if (reviewSnap.data().aprovada) return; // já aprovada, idempotente

    t.update(reviewRef, {
      aprovada:   true,
      aprovadaEm: admin.firestore.FieldValue.serverTimestamp(),
      aprovadaPor: req.auth.uid,
    });

    // Recalcula rating incluindo a nova review aprovada
    const aprovSnap = await t.get(
      restRef.collection('reviews').where('aprovada', '==', true)
    );
    // +1 porque a review atual ainda não foi commitada como aprovada
    const novaRating  = reviewSnap.data().rating || 0;
    const totalAntes  = aprovSnap.docs.reduce((s, d) => s + (d.data().rating || 0), 0);
    const totalComNova = totalAntes + novaRating;
    const countComNova = aprovSnap.size + 1;
    const avg = Math.round((totalComNova / countComNova) * 10) / 10;
    t.update(restRef, { rating: avg, reviews: countComNova });
  });

  return { success: true };
});

exports.rejeitarReview = onCall({ region: 'southamerica-east1' }, async (req) => {
  assertAdmin(req.auth);
  const { restauranteId, reviewId } = req.data;
  if (!validarId(restauranteId) || !validarId(reviewId)) {
    throw new HttpsError('invalid-argument', 'IDs inválidos');
  }

  const ref = db.collection('restaurantes').doc(restauranteId)
    .collection('reviews').doc(reviewId);
  const snap = await ref.get();
  if (!snap.exists) throw new HttpsError('not-found', 'Review não encontrada');

  await ref.delete();
  return { success: true };
});

// ════════════════════════════════════════════════════════════════
// 6. TRIGGER — expira badge "novo" após 30 dias automaticamente
//    Roda diariamente via Cloud Scheduler (cron: "0 3 * * *")
// ════════════════════════════════════════════════════════════════
const { onSchedule } = require('firebase-functions/v2/scheduler');

exports.expirarBadgeNovo = onSchedule(
  { schedule: '0 3 * * *', region: 'southamerica-east1', timeZone: 'America/Sao_Paulo' },
  async () => {
    const TRINTA_DIAS_MS = 30 * 24 * 60 * 60 * 1000;
    const corte = admin.firestore.Timestamp.fromDate(new Date(Date.now() - TRINTA_DIAS_MS));

    const snap = await db.collection('restaurantes')
      .where('novo', '==', true)
      .where('criadoEm', '<=', corte)
      .get();

    if (snap.empty) return;

    const batch = db.batch();
    snap.docs.forEach(d => batch.update(d.ref, { novo: false }));
    await batch.commit();

    console.log(`[EDENA] Badge "novo" expirado em ${snap.size} restaurante(s).`);
  }
);
