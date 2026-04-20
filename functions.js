// ═══════════════════════════════════════════════════════════════════
// EDENA — Cloud Functions (Node.js 20 + Firebase Admin SDK)
// Deploy: firebase deploy --only functions
// ═══════════════════════════════════════════════════════════════════

const functions  = require('firebase-functions/v2/https');
const { onCall, HttpsError } = require('firebase-functions/v2/https');
const admin   = require('firebase-admin');
const { Filter } = require('firebase-admin/firestore');

admin.initializeApp();
const db = admin.firestore();

// ── Sanitização server-side ──────────────────────────────────────
function sanitize(s, max = 200) {
  return String(s ?? '').replace(/<[^>]*>/g, '').trim().slice(0, max);
}

// ── Rate limit por UID (Firestore-based) ────────────────────────
async function checkRateLimit(uid, key, max, windowMs) {
  const ref   = db.collection('_ratelimits').doc(`${uid}_${key}`);
  const now   = Date.now();
  const cutoff = now - windowMs;

  return db.runTransaction(async t => {
    const snap = await t.get(ref);
    const hits  = (snap.data()?.hits || []).filter(ts => ts > cutoff);
    if (hits.length >= max) throw new HttpsError('resource-exhausted', 'Rate limit atingido');
    hits.push(now);
    t.set(ref, { hits }, { merge: true });
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
    fotoUrl:   typeof data.fotoUrl === 'string' ? data.fotoUrl : null,
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
    donoEmail: auth.token.email || '',
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
  if (!restauranteId || typeof restauranteId !== 'string') throw new HttpsError('invalid-argument', 'ID inválido');
  if (typeof rating !== 'number' || rating < 1 || rating > 5) throw new HttpsError('invalid-argument', 'Nota deve ser 1-5');
  const textoClean = sanitize(texto, 300);
  if (!textoClean || textoClean.length < 10) throw new HttpsError('invalid-argument', 'Texto muito curto');

  // Rate limit: 10 reviews por dia
  await checkRateLimit(auth.uid, 'reviews', 10, 24 * 60 * 60 * 1000);

  // 1 review por restaurante por usuário
  const prevQ = await db.collection('restaurantes').doc(restauranteId)
    .collection('reviews').where('uid','==',auth.uid).limit(1).get();
  if (!prevQ.empty) throw new HttpsError('already-exists', 'Você já avaliou este restaurante');

  // Salva review
  await db.collection('restaurantes').doc(restauranteId).collection('reviews').add({
    uid:      auth.uid,
    nome:     sanitize(auth.token.name || auth.token.email?.split('@')[0] || 'Anônimo', 50),
    rating,
    texto:    textoClean,
    criadoEm: admin.firestore.FieldValue.serverTimestamp(),
    aprovada: true,
  });

  // Recalcula rating médio (transação atômica)
  await db.runTransaction(async t => {
    const reviewsSnap = await t.get(
      db.collection('restaurantes').doc(restauranteId)
        .collection('reviews').where('aprovada','==',true)
    );
    const total = reviewsSnap.docs.reduce((s,d) => s + (d.data().rating||0), 0);
    const avg   = Math.round(total / reviewsSnap.size * 10) / 10;
    t.update(db.collection('restaurantes').doc(restauranteId), {
      rating:  avg,
      reviews: reviewsSnap.size,
    });
  });

  return { success: true };
});

// ════════════════════════════════════════════════════════════════
// 3. ATIVAR PLANO PRO (chamado após pagamento confirmado)
// ════════════════════════════════════════════════════════════════
exports.ativarPlanoPro = onCall({ region: 'southamerica-east1' }, async (req) => {
  const { auth, data } = req;
  if (!auth) throw new HttpsError('unauthenticated', 'Login necessário');

  // Em produção: verificar webhook do Stripe/Mercado Pago antes de chamar esta função
  const { restauranteId, paymentRef } = data;
  if (!restauranteId || !paymentRef) throw new HttpsError('invalid-argument', 'Dados incompletos');

  // TODO: validar paymentRef com Stripe SDK aqui
  // const session = await stripe.checkout.sessions.retrieve(paymentRef);
  // if (session.payment_status !== 'paid') throw new HttpsError('failed-precondition', 'Pagamento pendente');

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

  const ref  = db.collection('restaurantes').doc(data.restauranteId);
  const snap = await ref.get();
  if (!snap.exists) throw new HttpsError('not-found', 'Restaurante não encontrado');
  if (snap.data().donoId !== auth.uid) throw new HttpsError('permission-denied', 'Acesso negado');

  await ref.update({ aberto: !!data.aberto });
  return { success: true };
});
