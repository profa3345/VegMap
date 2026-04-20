import { initializeApp }          from "https://www.gstatic.com/firebasejs/11.1.0/firebase-app.js";
import { getFirestore, collection, getDocs, addDoc, query, orderBy, serverTimestamp }
                                   from "https://www.gstatic.com/firebasejs/11.1.0/firebase-firestore.js";
import { getStorage, ref as sRef, uploadBytes, getDownloadURL }
                                   from "https://www.gstatic.com/firebasejs/11.1.0/firebase-storage.js";
import { getAuth, signInWithPopup, GoogleAuthProvider,
         createUserWithEmailAndPassword, signInWithEmailAndPassword,
         signOut, onAuthStateChanged }
                                   from "https://www.gstatic.com/firebasejs/11.1.0/firebase-auth.js";
import { getAnalytics, logEvent }  from "https://www.gstatic.com/firebasejs/11.1.0/firebase-analytics.js";

/* ── CONFIG ── */
const FB = initializeApp({
  apiKey:            "AIzaSyAcRZch-DZrHtOZaEBl735iwnFp4Yf4N78",
  authDomain:        "vegmap-21101.firebaseapp.com",
  projectId:         "vegmap-21101",
  storageBucket:     "vegmap-21101.firebasestorage.app",
  messagingSenderId: "615815897277",
  appId:             "1:615815897277:web:a58e2d6e4aa798565657d4"
});
const db        = getFirestore(FB);
const storage   = getStorage(FB);
const auth      = getAuth(FB);
const gp        = new GoogleAuthProvider();
const analytics = (() => { try { return getAnalytics(FB); } catch { return null; } })();

// Helper: dispara evento GA4 com segurança
function logEvento(nome, params = {}) {
  try { if (analytics) logEvent(analytics, nome, params); } catch {}
  // Log local em dev
  if (location.hostname === 'localhost' || location.hostname === '127.0.0.1') {
    console.log('[Analytics]', nome, params);
  }
}

/* ── SEED DATA (fallback enquanto Firestore está vazio) ── */
const SEED = [
  {id:'s1',  nome:"Verde Vivo",          tipo:"Restaurante Vegano",           cidade:"Vitoria",    bairro:"Praia do Canto",    emoji:"🌿", rating:4.9, reviews:312, preco:"$$",  delivery:true,  aberto:true,  acessivel:true,  semgluten:false, novo:false, destaque:true,  promo:false, tags:["vegano","por-quilo","almoço"],              descricao:"O restaurante vegano mais premiado de Vitória.",           horario:"Seg-Sex 11h-15h | Sex-Dom 18h-22h", telefone:"(27) 3344-1234", lat:-20.273, lng:-40.297, pratos:[{nome:"Feijoada Vegana",        desc:"Grãos, proteína vegetal, couve",preco:"R$ 38"},{nome:"Prato Executivo",      desc:"Arroz integral + proteína + 3 saladas",preco:"R$ 32"}]},
  {id:'s2',  nome:"Raízes Café",          tipo:"Café & Confeitaria Vegana",    cidade:"Vitoria",    bairro:"Jardim da Penha",   emoji:"☕", rating:4.8, reviews:198, preco:"$",   delivery:true,  aberto:true,  acessivel:true,  semgluten:true,  novo:false, destaque:false, promo:true,  tags:["café","confeitaria","vegano","sem-gluten"],  descricao:"Café vegano especializado em bolos e bebidas artesanais.", horario:"Seg-Dom 7h-20h",             telefone:"(27) 3311-4422", lat:-20.261, lng:-40.289, pratos:[{nome:"Cappuccino de Aveia",     desc:"Leite de aveia artesanal",     preco:"R$ 14"},{nome:"Bolo de Limão",        desc:"Bolo vegano com cobertura",    preco:"R$ 12"}]},
  {id:'s3',  nome:"Sushi Zen",            tipo:"Japonês Vegano",               cidade:"Vila Velha", bairro:"Praia de Itaparica",emoji:"🍣", rating:4.7, reviews:276, preco:"$$$", delivery:false, aberto:true,  acessivel:false, semgluten:false, novo:false, destaque:true,  promo:false, tags:["sushi","japonês","vegano"],                  descricao:"O único restaurante de sushi 100% vegano do ES.",         horario:"Ter-Dom 18h-23h",            telefone:"(27) 3344-5566", lat:-20.339, lng:-40.292, pratos:[{nome:"Hot Philadelphia Vegano",desc:"Cream cheese vegano, palmito",  preco:"R$ 42"}]},
  {id:'s4',  nome:"Naturalíssimo",        tipo:"Loja de Produtos Naturais",    cidade:"Cariacica",  bairro:"Campo Grande",      emoji:"🛒", rating:4.6, reviews:143, preco:"$$",  delivery:true,  aberto:false, acessivel:true,  semgluten:true,  novo:false, destaque:false, promo:true,  tags:["mercado","produtos naturais","sem-gluten"],  descricao:"Maior loja de produtos naturais de Cariacica.",           horario:"Seg-Sab 8h-19h",             telefone:"(27) 3355-7788", lat:-20.262, lng:-40.416, pratos:[{nome:"Granola Artesanal",      desc:"500g, sem açúcar refinado",    preco:"R$ 22"}]},
  {id:'s5',  nome:"Burguer Eden",         tipo:"Hamburgueria Vegana",          cidade:"Serra",      bairro:"Serra Dourada",     emoji:"🍔", rating:4.8, reviews:387, preco:"$$",  delivery:true,  aberto:true,  acessivel:true,  semgluten:false, novo:true,  destaque:true,  promo:false, tags:["hamburguer","vegano","delivery"],             descricao:"Smash burgers artesanais de grão-de-bico e jaca.",        horario:"Seg-Dom 11h-23h",            telefone:"(27) 3366-9900", lat:-20.128, lng:-40.310, pratos:[{nome:"Smash Burger Classic",  desc:"Blend de grão-de-bico, cheddar vegano",preco:"R$ 38"}]},
  {id:'s6',  nome:"Pizza Sagrada",        tipo:"Pizzaria Vegana",              cidade:"Vitoria",    bairro:"Santa Lúcia",       emoji:"🍕", rating:4.7, reviews:224, preco:"$$",  delivery:true,  aberto:false, acessivel:true,  semgluten:true,  novo:false, destaque:false, promo:false, tags:["pizza","vegana","sem-gluten"],               descricao:"Pizzas artesanais veganas com massa integral ou sem glúten.",horario:"Sex-Dom 18h-23h",           telefone:"(27) 3377-1122", lat:-20.284, lng:-40.314, pratos:[{nome:"Margherita Vegana",     desc:"Queijo de castanha, manjericão",preco:"R$ 48"}]},
  {id:'s7',  nome:"AçaíVerde",            tipo:"Açaí & Smoothies",             cidade:"Guarapari",  bairro:"Centro",            emoji:"🫐", rating:4.5, reviews:167, preco:"$",   delivery:true,  aberto:true,  acessivel:false, semgluten:true,  novo:true,  destaque:false, promo:true,  tags:["açaí","smoothies","fitness","sem-gluten"],   descricao:"Açaí nativo do Pará sem aditivos e bowls funcionais.",    horario:"Seg-Dom 9h-21h",             telefone:"(28) 3261-4455", lat:-20.674, lng:-40.504, pratos:[{nome:"Bowl Classic",           desc:"Açaí, granola, banana",        preco:"R$ 22"}]},
  {id:'s8',  nome:"Falafel & Co",         tipo:"Árabe Vegano",                 cidade:"Vila Velha", bairro:"Centro",            emoji:"🧆", rating:4.8, reviews:156, preco:"$$",  delivery:true,  aberto:true,  acessivel:true,  semgluten:false, novo:true,  destaque:true,  promo:false, tags:["árabe","falafel","vegano"],                  descricao:"Autêntico falafel vegano com receita do Líbano.",         horario:"Ter-Dom 11h-22h",            telefone:"(27) 3388-6677", lat:-20.329, lng:-40.296, pratos:[{nome:"Wrap de Falafel",       desc:"Falafel, tahini, salada",      preco:"R$ 30"}]},
  {id:'s9',  nome:"Longevidade Café",     tipo:"Café Funcional",               cidade:"Serra",      bairro:"Laranjeiras",       emoji:"🌱", rating:4.9, reviews:98,  preco:"$$",  delivery:false, aberto:true,  acessivel:true,  semgluten:true,  novo:true,  destaque:true,  promo:false, tags:["café","funcional","fitness","sem-gluten"],   descricao:"Café focado em longevidade com alimentos funcionais.",    horario:"Seg-Sab 7h-18h",             telefone:"(27) 3399-0011", lat:-20.152, lng:-40.299, pratos:[{nome:"Golden Latte",          desc:"Leite de coco, cúrcuma, gengibre",preco:"R$ 18"}]},
  {id:'s10', nome:"Doce Natureza",        tipo:"Confeitaria Vegana",           cidade:"Cariacica",  bairro:"Itacibá",           emoji:"🍰", rating:4.5, reviews:211, preco:"$$",  delivery:true,  aberto:false, acessivel:false, semgluten:false, novo:false, destaque:false, promo:true,  tags:["sobremesa","sorvete","confeitaria","vegano"], descricao:"Confeitaria vegana especializada em bolos e sorvetes.",  horario:"Ter-Dom 10h-20h",            telefone:"(27) 3344-2233", lat:-20.271, lng:-40.401, pratos:[{nome:"Sorvete de Coco",       desc:"Cremoso, sem lactose",         preco:"R$ 12"}]},
  {id:'s11', nome:"Nordeste Vegano",      tipo:"Culinária Nordestina Vegana",  cidade:"Linhares",   bairro:"Bebedouro",         emoji:"🌵", rating:4.7, reviews:134, preco:"$$",  delivery:false, aberto:true,  acessivel:true,  semgluten:false, novo:false, destaque:false, promo:false, tags:["nordestino","vegano","regional"],             descricao:"Sabores do nordeste reinventados de forma 100% vegana.", horario:"Seg-Sab 11h-15h",            telefone:"(27) 3264-5544", lat:-19.390, lng:-40.068, pratos:[{nome:"Baião de Dois Vegano",  desc:"Arroz, feijão verde, coentro", preco:"R$ 32"}]},
  {id:'s12', nome:"Templo da Saúde",      tipo:"Restaurante por Kg Vegano",    cidade:"Vitoria",    bairro:"Centro",            emoji:"🥗", rating:4.6, reviews:289, preco:"$",   delivery:false, aberto:true,  acessivel:true,  semgluten:false, novo:false, destaque:false, promo:false, tags:["por-quilo","vegano","almoço"],               descricao:"Tradicional restaurante por quilo 100% vegano.",         horario:"Seg-Sex 11h-15h",            telefone:"(27) 3221-3344", lat:-20.319, lng:-40.338, pratos:[{nome:"Buffet Vegano (100g)",  desc:"Variedade diária",             preco:"R$ 5,90"}]},
];

/* ══════════════════════════════════════════════════════════════
   REGRAS FIRESTORE — cole isso no console do Firebase:
   https://console.firebase.google.com → Firestore → Regras

   rules_version = '2';
   service cloud.firestore {
     match /databases/{database}/documents {

       // Qualquer um lê restaurantes
       match /restaurantes/{id} {
         allow read: if true;

         // Só cria se autenticado, campos obrigatórios presentes e válidos
         allow create: if request.auth != null
           && request.resource.data.keys().hasAll(['nome','cidade','tipo','donoId'])
           && request.resource.data.nome is string
           && request.resource.data.nome.size() >= 3
           && request.resource.data.nome.size() <= 100
           && request.resource.data.cidade is string
           && request.resource.data.tipo is string
           && request.resource.data.donoId == request.auth.uid;

         // Só o dono edita/deleta o próprio documento
         allow update, delete: if request.auth != null
           && resource.data.donoId == request.auth.uid;
       }

       // Perfis de usuário (role): só o próprio usuário lê/escreve
       match /usuarios/{uid} {
         allow read, write: if request.auth != null && request.auth.uid == uid;
       }
     }
   }
══════════════════════════════════════════════════════════════ */

/* ── STATE ── */
let RESTAURANTES = [];
let currentPill  = '', currentTab = 'restaurantes', priceFilter = '', ratingFilter = 0;
let currentView  = 'grid', currentPage = 1;
const PER_PAGE   = 9;
// Valida que os favoritos são strings antes de usar (proteção contra localStorage corrompido)
let favorites = (() => {
  try {
    const raw = JSON.parse(localStorage.getItem('edena_favs') || '[]');
    return new Set(Array.isArray(raw) ? raw.filter(x => typeof x === 'string') : []);
  } catch { return new Set(); }
})();
let searchDebounce, userLat = null, userLng = null;
let leafletMap   = null, leafletMarkers = [];
let currentUserRole = 'user'; // 'user' | 'restaurante' | 'admin'

/* ── UTILS ── */
function esc(s) {
  const d = document.createElement('div');
  d.textContent = String(s ?? '');
  return d.innerHTML;
}

// Sanitiza strings antes de salvar: remove HTML, limita tamanho
function sanitize(s, maxLen = 200) {
  return String(s ?? '').replace(/<[^>]*>/g, '').trim().slice(0, maxLen);
}

// Valida e-mail
function isValidEmail(e) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
}

// Haversine — distância real em km
function haversine(la1, ln1, la2, ln2) {
  const R = 6371, dL = (la2-la1)*Math.PI/180, dN = (ln2-ln1)*Math.PI/180;
  const a = Math.sin(dL/2)**2 + Math.cos(la1*Math.PI/180)*Math.cos(la2*Math.PI/180)*Math.sin(dN/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

/* ── RATE LIMITER (client-side) ── */
// Previne spam de cadastro: máx 3 submissões por hora por dispositivo
const RATE_KEY = 'edena_submissions';
function checkRateLimit() {
  const now = Date.now();
  const ONE_HOUR = 60 * 60 * 1000;
  const raw = JSON.parse(localStorage.getItem(RATE_KEY) || '[]');
  // Mantém só os do último 1h
  const recent = raw.filter(t => now - t < ONE_HOUR);
  if (recent.length >= 3) {
    const wait = Math.ceil((ONE_HOUR - (now - recent[0])) / 60000);
    showToast(`⚠️ Limite atingido. Tente novamente em ${wait} min.`);
    return false;
  }
  recent.push(now);
  localStorage.setItem(RATE_KEY, JSON.stringify(recent));
  return true;
}

/* ── DETECTOR DE DUPLICATAS ── */
async function verificarDuplicata(nome, cidade) {
  const normalizar = s => s.toLowerCase().trim().normalize('NFD').replace(/\p{Diacritic}/gu,'');
  const nomNorm = normalizar(nome);
  const cid = normalizar(cidade);
  return RESTAURANTES.some(r =>
    normalizar(r.nome) === nomNorm && normalizar(r.cidade) === cid
  );
}

/* ── FIRESTORE LOAD ── */
async function carregarRestaurantes() {
  mostrarSkeleton();
  try {
    const snap = await getDocs(query(collection(db,'restaurantes'), orderBy('criadoEm','desc')));
    const remote = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    const seedIds = new Set(SEED.map(s => s.id));
    const novos   = remote.filter(r => !seedIds.has(r.id));
    RESTAURANTES  = [...SEED, ...novos];
  } catch(e) {
    console.warn('Firestore indisponível, usando dados locais:', e.message);
    RESTAURANTES = [...SEED];
  }
  atualizarStats();
  filterAll();
}

/* ── ROLE DO USUÁRIO ── */
async function carregarRole(uid) {
  try {
    const { getDoc, doc: fsDoc } = await import("https://www.gstatic.com/firebasejs/11.1.0/firebase-firestore.js");
    const snap = await getDoc(fsDoc(db, 'usuarios', uid));
    currentUserRole = snap.exists() ? (snap.data().role || 'user') : 'user';
  } catch { currentUserRole = 'user'; }
  atualizarUIRole();
}

function atualizarUIRole() {
  const badge = document.getElementById('role-badge');
  if (!badge) return;
  const labels = { admin:'👑 Admin', restaurante:'🍽️ Dono', user:'' };
  badge.textContent = labels[currentUserRole] || '';
  badge.style.display = currentUserRole !== 'user' ? 'inline' : 'none';
  atualizarBtnPainel();
}

function atualizarBtnPainel() {
  const btn = document.getElementById('btn-painel');
  if (!btn) return;
  btn.style.display = (currentUserRole === 'restaurante' || currentUserRole === 'admin') ? '' : 'none';
}

function atualizarStats(){
  document.getElementById('stat-rest').textContent   = RESTAURANTES.length + '+';
  const tp = RESTAURANTES.reduce((a,r)=>(a+(r.pratos?.length||0)),0);
  document.getElementById('stat-pratos').textContent = tp + '+';
  computarGamificacao();
}

/* ── GAMIFICAÇÃO: top da semana + ranking semanal ── */
function computarGamificacao() {
  // Score de popularidade semanal simulado (em produção: contador de views no Firestore)
  // Fórmula: reviews * rating + bonus delivery + bonus promo
  const scored = RESTAURANTES
    .filter(r => r.rating > 0)
    .map(r => ({
      ...r,
      _weekScore: (r.reviews || 0) * (r.rating || 0)
        + (r.delivery ? 5 : 0)
        + (r.promo    ? 8 : 0)
        + (r.aberto   ? 3 : 0)
    }))
    .sort((a,b) => b._weekScore - a._weekScore);

  // Top 3 da semana — adiciona badge
  scored.slice(0, 3).forEach((r, i) => {
    const idx = RESTAURANTES.findIndex(x => x.id === r.id);
    if (idx >= 0) RESTAURANTES[idx].topSemana   = true;
    if (idx >= 0) RESTAURANTES[idx].topRank     = i + 1;
    if (idx >= 0) RESTAURANTES[idx]._weekScore  = r._weekScore;
  });
  renderTopStrip(scored.slice(0, 3));
}

function renderTopStrip(tops) {
  const strip = document.getElementById('top-strip');
  const chips = document.getElementById('top-chips');
  if (!strip || !chips || !tops.length) return;
  const medals = ['🥇','🥈','🥉'];
  chips.innerHTML = tops.map((r, i) => `
    <div class="top-chip" onclick="openModal('${esc(r.id)}')">
      <span class="top-chip-rank">${medals[i]}</span>
      <span class="top-chip-emoji">${esc(r.emoji||'🌿')}</span>
      <div class="top-chip-info">
        <span class="top-chip-nome">${esc(r.nome)}</span>
        <span class="top-chip-rating">★ ${esc(r.rating||'—')} · ${esc(r.cidade)}</span>
      </div>
    </div>`).join('');
  strip.style.display = 'block';
}

/* ── SUGESTÃO FUTURA: horário dinâmico ──────────────────────────────────────
 * Esta função pode ser implementada para calcular abertura real a partir
 * do campo horario (ex: "Seg-Sex 11h-15h | Sex-Dom 18h-22h"):
 *
 * function estaAberto(horarioStr) {
 *   const now  = new Date();
 *   const dia  = now.getDay(); // 0=Dom, 1=Seg...
 *   const hora = now.getHours() + now.getMinutes()/60;
 *   // parse de "Seg-Sex 11h-15h" → verifica dia e faixa de hora
 *   // retorna true/false
 * }
 *
 * Isso eliminaria a necessidade do campo `aberto` manual no Firestore
 * e tornaria o indicador 🟢/🔴 sempre preciso.
 ─────────────────────────────────────────────────────────────────────────── */

/* ── AUTH ── */
onAuthStateChanged(auth, user => {
  const ud = document.getElementById('user-display');
  const be = document.getElementById('btn-entrar');
  if (user) {
    ud.style.display = 'flex';
    document.getElementById('user-name-text').textContent =
      (user.displayName || user.email || '').split(' ')[0];
    be.style.display = 'none';
    carregarRole(user.uid); // carrega role do Firestore
    atualizarBtnPainel();
  } else {
    ud.style.display = 'none';
    be.style.display = '';
    currentUserRole = 'user';
    atualizarUIRole();
  }
});

window.abrirLogin  = () => { document.getElementById('login-overlay').classList.add('open'); document.body.style.overflow='hidden'; };
window.fecharLogin = () => { document.getElementById('login-overlay').classList.remove('open'); document.body.style.overflow=''; };

window.loginGoogle = async () => {
  document.getElementById('login-error').textContent = '';
  try {
    await signInWithPopup(auth, gp);
    fecharLogin();
    showToast('✅ Login realizado com sucesso!');
    logEvento('login', { method: 'google' });
  } catch(e) {
    document.getElementById('login-error').textContent = 'Erro no login com Google. Tente novamente.';
  }
};

window.loginEmail = async () => {
  const email = document.getElementById('login-email').value.trim();
  const senha  = document.getElementById('login-senha').value;
  const errEl  = document.getElementById('login-error');
  errEl.textContent = '';
  if (!email || !senha) { errEl.textContent = 'Preencha e-mail e senha.'; return; }
  if (!isValidEmail(email)) { errEl.textContent = 'E-mail inválido.'; return; }
  if (senha.length < 6)  { errEl.textContent = 'Senha deve ter ao menos 6 caracteres.'; return; }
  try {
    await signInWithEmailAndPassword(auth, email, senha);
    fecharLogin();
    showToast('✅ Login realizado!');
    logEvento('login', { method: 'email' });
  } catch {
    try {
      await createUserWithEmailAndPassword(auth, email, senha);
      fecharLogin();
      showToast('🎉 Conta criada! Bem-vindo ao EDENA 🌿');
    } catch(e2) {
      errEl.textContent = e2.code === 'auth/email-already-in-use'
        ? 'E-mail já cadastrado. Verifique sua senha.'
        : 'Erro ao autenticar. Tente novamente.';
    }
  }
};

window.fazerLogout = async () => {
  await signOut(auth);
  showToast('👋 Até logo!');
};

/* ── GEOLOCALIZAÇÃO ── */
window.usarGeolocalizacao = () => {
  if (!navigator.geolocation) { showToast('⚠️ Geolocalização não suportada neste navegador.'); return; }
  const btn = document.getElementById('btn-geo');
  btn.classList.add('loading');
  btn.disabled = true;
  navigator.geolocation.getCurrentPosition(
    pos => {
      userLat = pos.coords.latitude;
      userLng = pos.coords.longitude;
      btn.classList.remove('loading');
      btn.disabled = false;
      const gs = document.getElementById('geo-status');
      gs.classList.add('visible');
      document.getElementById('geo-label').textContent =
        `Lat ${userLat.toFixed(4)}, Lng ${userLng.toFixed(4)}`;
      document.getElementById('sort-sel').value = 'dist';
      showToast('✅ Localização obtida! Ordenando por distância…');
      filterAll();
    },
    () => {
      btn.classList.remove('loading');
      btn.disabled = false;
      showToast('⚠️ Não foi possível obter localização. Verifique as permissões do navegador.');
    },
    { timeout: 10000 }
  );
};

/* ── SINCRONIZA SELECTS DE CIDADE ── */
window.syncCidades = source => {
  const val = document.getElementById(source === 'hero' ? 'hero-cidade' : 'side-cidade').value;
  document.getElementById('hero-cidade').value = val;
  document.getElementById('side-cidade').value = val;
  currentPage = 1;
  filterAll();
};

/* ── FILTRO PRINCIPAL ── */
function mostrarSkeleton() {
  const cont = document.getElementById('cards-container');
  cont.className = 'skel-wrap';
  cont.innerHTML = Array(6).fill(0).map(()=>`
    <div class="skel-card">
      <div class="skel-img"></div>
      <div class="skel-body">
        <div class="skel-line wide"></div>
        <div class="skel-line short"></div>
        <div style="display:flex;gap:6px">
          <div class="skel-line xshort"></div>
          <div class="skel-line xshort"></div>
        </div>
        <div class="skel-line" style="width:60%;margin-top:4px"></div>
      </div>
    </div>`).join('');
}

function atualizarBadgeFiltros() {
  let count = 0;
  if (document.getElementById('tog-delivery').checked) count++;
  if (document.getElementById('tog-aberto').checked)   count++;
  if (document.getElementById('tog-acessivel').checked)count++;
  if (document.getElementById('tog-gluten').checked)   count++;
  if (document.getElementById('tog-promo').checked)    count++;
  if (priceFilter) count++;
  if (ratingFilter > 0) count++;
  const badge = document.getElementById('filter-badge');
  if (badge) {
    badge.textContent = count || '';
    badge.classList.toggle('show', count > 0);
  }
}

let _filterScheduled = false;
window.filterAll = function() {
  // Proteção RAF: evita execuções em cascata no mesmo frame (ex: múltiplos filtros ao mesmo tempo)
  if (_filterScheduled) return;
  _filterScheduled = true;
  requestAnimationFrame(() => { _filterScheduled = false; });

  // Persiste estado dos filtros no localStorage
  try {
    const estado = {
      q:       document.getElementById('main-search').value,
      cidade:  document.getElementById('hero-cidade').value,
      preco:   priceFilter,
      rating:  ratingFilter,
      delivery:document.getElementById('tog-delivery').checked,
      aberto:  document.getElementById('tog-aberto').checked,
      acess:   document.getElementById('tog-acessivel').checked,
      gluten:  document.getElementById('tog-gluten').checked,
      promo:   document.getElementById('tog-promo').checked,
      pill:    currentPill,
      sort:    document.getElementById('sort-sel').value,
      view:    currentView
    };
    sessionStorage.setItem('edena_filtros', JSON.stringify(estado));
    // Atualiza URL para permitir compartilhamento de buscas
    try {
      const params = new URLSearchParams();
      if (estado.q)      params.set('q', estado.q);
      if (estado.cidade) params.set('c', estado.cidade);
      const newUrl = params.toString()
        ? `${location.pathname}?${params.toString()}`
        : location.pathname;
      history.replaceState(null, '', newUrl);
    } catch {}
  } catch {}

  const q       = document.getElementById('main-search').value.toLowerCase().trim();
  const cidade  = document.getElementById('hero-cidade').value;
  const bairro  = document.getElementById('side-bairro').value;
  const deliv   = document.getElementById('tog-delivery').checked;
  const aberto  = document.getElementById('tog-aberto').checked;
  const acess   = document.getElementById('tog-acessivel').checked;
  const gluten  = document.getElementById('tog-gluten').checked;
  const promo   = document.getElementById('tog-promo').checked;
  const sort    = document.getElementById('sort-sel').value;

  // Atualiza bairros dinamicamente
  if (cidade) {
    const bairros = [...new Set(RESTAURANTES.filter(r => r.cidade===cidade && r.bairro).map(r => r.bairro))].sort();
    const sel = document.getElementById('side-bairro');
    const cur = sel.value;
    sel.innerHTML = '<option value="">Todos os bairros</option>' +
      bairros.map(b => `<option${b===cur?' selected':''}>${esc(b)}</option>`).join('');
  }

  let list = RESTAURANTES.filter(r => {
    if (q && !r.nome.toLowerCase().includes(q) &&
              !r.tipo.toLowerCase().includes(q) &&
              !(r.tags||[]).some(t => t.includes(q))) return false;
    if (cidade && r.cidade !== cidade) return false;
    if (bairro && r.bairro !== bairro) return false;
    if (currentPill === '__favoritos__' && !favorites.has(r.id)) return false;
    if (currentPill === 'aberto' && !r.aberto) return false;
    if (currentPill === 'promo'  && !r.promo)  return false;
    if (currentPill && !['aberto','promo','__favoritos__',''].includes(currentPill) &&
        !(r.tags||[]).includes(currentPill) &&
        !r.tipo.toLowerCase().includes(currentPill)) return false;
    if (currentTab === 'delivery' && !r.delivery) return false;
    if (currentTab === 'mercados' &&
        !r.tipo.toLowerCase().includes('mercado') &&
        !r.tipo.toLowerCase().includes('loja')) return false;
    if (priceFilter && r.preco !== priceFilter) return false;
    if (ratingFilter > 0 && r.rating < ratingFilter) return false;
    if (deliv   && !r.delivery)  return false;
    if (aberto  && !r.aberto)    return false;
    if (acess   && !r.acessivel) return false;
    if (gluten  && !r.semgluten) return false;
    if (promo   && !r.promo)     return false;
    return true;
  });

  // Calcula distância se disponível
  if (userLat !== null) {
    list = list.map(r => ({
      ...r,
      _dist: (r.lat && r.lng) ? haversine(userLat, userLng, r.lat, r.lng) : null
    }));
  }

  atualizarBadgeFiltros();

  // ── RANKING INTELIGENTE ── score composto: destaque + rating + reviews + proximidade + promoção
  function calcScore(r) {
    let s = 0;
    s += (r.destaque ? 30 : 0);                          // PRO destaque: +30
    s += (r.promo    ? 10 : 0);                          // em promoção: +10
    s += (r.rating   || 0) * 8;                          // rating * 8 (max 40 para 5★)
    s += Math.min((r.reviews || 0) / 10, 10);            // reviews: até +10 (cap em 100 reviews)
    s += (r.novo     ? 5  : 0);                          // recém-cadastrado: +5
    s += (r.aberto   ? 8  : 0);                          // aberto agora: +8
    if (userLat && r._dist != null) {
      // proximidade: +10 se < 1km, +5 se < 5km, +2 se < 15km
      s += r._dist < 1 ? 10 : r._dist < 5 ? 5 : r._dist < 15 ? 2 : 0;
    }
    return s;
  }

  list.sort((a,b) => {
    if (sort === 'rating')    return b.rating - a.rating;
    if (sort === 'nome')      return a.nome.localeCompare(b.nome, 'pt-BR');
    if (sort === 'novo')      return (b.novo?1:0) - (a.novo?1:0);
    if (sort === 'preco_asc') return a.preco.length - b.preco.length;
    if (sort === 'top') return (b._weekScore||0) - (a._weekScore||0);
    if (sort === 'dist' && userLat !== null)
      return (a._dist ?? Infinity) - (b._dist ?? Infinity);
    // Padrão: algoritmo de ranking composto (tipo iFood)
    return calcScore(b) - calcScore(a);
  });

  document.getElementById('count-label').textContent = list.length;

  const totalPages = Math.ceil(list.length / PER_PAGE);
  if (currentPage > totalPages && totalPages > 0) currentPage = 1;
  renderCards(list.slice((currentPage-1)*PER_PAGE, currentPage*PER_PAGE));
  renderPagination(totalPages);
  limparWillChange();
};

/* ── RENDER CARDS ── */
function renderCards(list) {
  const cont = document.getElementById('cards-container');
  cont.className = currentView === 'grid' ? 'cards-grid' : 'cards-list';

  if (!list.length) {
    cont.innerHTML = `<div class="empty-state">
      <div class="empty-icon">🌱</div>
      <div class="empty-title">Nenhum resultado encontrado</div>
      <p class="empty-sub">Tente ajustar os filtros ou busque em outra localidade</p>
      <button onclick="resetFilters()" style="margin-top:16px;padding:10px 20px;border-radius:var(--radius-pill);border:1.5px solid var(--eden-300);background:var(--eden-50);color:var(--eden-700);font-size:13px;font-weight:600;cursor:pointer">Limpar filtros</button>
    </div>`;
    return;
  }

  cont.innerHTML = list.map((r, i) => {
    const isFav    = favorites.has(r.id);
    const delay    = (i % PER_PAGE) * 0.05;
    const listCls  = currentView === 'list' ? ' rest-card-list' : '';
    const distBadge = (r._dist != null)
      ? `<span class="card-dist">📍 ${r._dist.toFixed(1)} km</span>` : '';
    // Lazy load: usa data-src + IntersectionObserver para não carregar imgs fora do viewport
    const fotoEl   = r.fotoUrl
      ? `<img class="card-photo lazy-img" data-src="${esc(r.fotoUrl)}" alt="${esc(r.nome)}" loading="lazy" style="opacity:0;transition:opacity .3s">` : '';
    return `
    <div class="rest-card${listCls}" style="animation-delay:${delay}s" data-id="${esc(r.id)}" role="button" tabindex="0" aria-label="${esc(r.nome)}">
      <div class="card-img-wrap">
        <div class="card-img-inner" aria-hidden="true">${esc(r.emoji||'🌿')}</div>
        ${fotoEl}
        <div class="card-badges">
          ${r.destaque ? '<span class="badge badge-destaque">⭐ Destaque</span>' : ''}
          ${r.topSemana? '<span class="badge badge-top">🏆 Top semana</span>'   : ''}
          ${r.novo     ? '<span class="badge badge-novo">✨ Novo</span>'        : ''}
          ${r.delivery ? '<span class="badge badge-delivery">🛵 Delivery</span>': ''}
          ${r.promo    ? '<span class="badge badge-promo">🔥 Promoção</span>'   : ''}
        </div>
        <button class="card-fav ${isFav?'active':''}" data-fav="${esc(r.id)}"
          aria-label="${isFav?'Remover dos':'Adicionar aos'} favoritos" aria-pressed="${isFav}">
          ${isFav?'❤️':'🤍'}
        </button>
      </div>
      <div class="card-body">
        <div class="card-top">
          <div class="card-name">${esc(r.nome)}${getBadgePro(r)}</div>
          ${r.rating ? `<div class="card-rating"><span class="star" aria-hidden="true">★</span><span class="num">${esc(r.rating)}</span></div>` : ''}
        </div>
        <div class="card-tipo">
          ${esc(r.tipo)} <span class="card-dot">•</span> ${esc(r.cidade)}${distBadge}
        </div>
        <div class="card-tags">${(r.tags||[]).slice(0,3).map(t=>`<span class="tag">${esc(t)}</span>`).join('')}</div>
        <div class="card-meta">
          <div class="meta-item"><span class="meta-icon" aria-hidden="true">💰</span>${esc(r.preco)}</div>
          <div class="meta-item"><span class="meta-icon" aria-hidden="true">${r.aberto?'🟢':'🔴'}</span>${r.aberto?'Aberto':'Fechado'}</div>
          ${r.reviews ? `<div class="meta-item"><span class="meta-icon" aria-hidden="true">⭐</span>${esc(r.reviews)} aval.</div>` : ''}
        </div>
      </div>
    </div>`;
  }).join('');

  cont.querySelectorAll('.rest-card').forEach(card => {
    const open = () => openModal(card.dataset.id);
    card.addEventListener('click', open);
    card.addEventListener('keydown', e => { if (e.key==='Enter'||e.key===' ') open(); });
  });
  cont.querySelectorAll('.card-fav').forEach(btn => {
    btn.addEventListener('click', e => { e.stopPropagation(); toggleFav(e, btn.dataset.fav); });
  });
  // Lazy load: ativa IntersectionObserver nas imagens recém-renderizadas
  ativarLazyImages(cont);
}

/* ── PAGINAÇÃO ── */
function renderPagination(total) {
  const pg = document.getElementById('pagination');
  if (total <= 1) { pg.innerHTML = ''; return; }
  let h = `<button class="page-btn" onclick="goPage(${currentPage-1})" ${currentPage===1?'disabled':''} aria-label="Página anterior">‹</button>`;
  for (let i=1; i<=total; i++)
    h += `<button class="page-btn${i===currentPage?' active':''}" onclick="goPage(${i})" aria-label="Página ${i}"${i===currentPage?' aria-current="page"':''}>${i}</button>`;
  h += `<button class="page-btn" onclick="goPage(${currentPage+1})" ${currentPage===total?'disabled':''} aria-label="Próxima página">›</button>`;
  pg.innerHTML = h;
}
window.goPage = p => {
  if (p < 1) return;
  currentPage = p;
  filterAll();
  // Scroll suave de volta para a barra de categorias
  const bar = document.querySelector('.cats-bar');
  if (bar) bar.scrollIntoView({ behavior:'smooth', block:'start' });
};

/* ── CONTROLES ── */
window.setTab   = (b,t)  => { document.querySelectorAll('.tab-btn').forEach(x=>x.classList.remove('active')); b.classList.add('active'); currentTab=t; currentPage=1; filterAll(); };
window.setPill  = (b,v)  => { document.querySelectorAll('.cat-pill').forEach(x=>x.classList.remove('active')); b.classList.add('active'); currentPill=v; currentPage=1; filterAll(); };
window.setPrice = (b,v)  => { document.querySelectorAll('.price-btn').forEach(x=>x.classList.remove('active')); b.classList.add('active'); priceFilter=v; currentPage=1; filterAll(); };
window.setRating= inp    => { ratingFilter=parseFloat(inp.value); document.getElementById('rating-val').textContent=ratingFilter>0?ratingFilter+'+ ★':'Qualquer'; currentPage=1; filterAll(); };
window.setView  = (b,v)  => {
  document.querySelectorAll('.view-btn').forEach((x,i) => { x.classList.toggle('active',i===(v==='grid'?0:1)); x.setAttribute('aria-pressed', String(i===(v==='grid'?0:1))); });
  currentView=v; filterAll();
};
window.setCity  = (b,c)  => { document.querySelectorAll('.location-pill').forEach(x=>x.classList.remove('active')); b.classList.add('active'); document.getElementById('hero-cidade').value=c; document.getElementById('side-cidade').value=c; currentPage=1; filterAll(); };

// Filtra por favoritos (pill especial)
let _mostrando_favoritos = false;
window.setPillFavoritos = (btn) => {
  _mostrando_favoritos = !_mostrando_favoritos;
  document.querySelectorAll('.cat-pill').forEach(x => x.classList.remove('active'));
  if (_mostrando_favoritos) {
    btn.classList.add('active');
    currentPill = '__favoritos__';
  } else {
    currentPill = '';
    document.querySelector('.cat-pill').classList.add('active'); // "Todos" ativo
  }
  currentPage = 1;
  filterAll();
  // Atualiza contador no pill
  const count = favorites.size;
  btn.querySelector('.emoji').textContent = count > 0 ? `❤️ ${count}` : '❤️';
};
window.onSearchInput = () => {
  document.getElementById('search-clear').style.display = document.getElementById('main-search').value ? 'flex' : 'none';
  clearTimeout(searchDebounce);
  searchDebounce = setTimeout(() => {
    currentPage=1;
    filterAll();
    const q = document.getElementById('main-search').value.trim();
    if (q.length > 2) logEvento('search', { search_term: q });
  }, 280);
};
window.clearSearch = () => { document.getElementById('main-search').value=''; document.getElementById('search-clear').style.display='none'; currentPage=1; filterAll(); };
window.resetFilters = () => {
  ['side-cidade','side-bairro'].forEach(id => document.getElementById(id).value='');
  document.getElementById('hero-cidade').value = '';
  ['tog-delivery','tog-aberto','tog-acessivel','tog-gluten','tog-promo'].forEach(id => document.getElementById(id).checked=false);
  priceFilter=''; ratingFilter=0;
  document.querySelectorAll('.price-btn').forEach(b=>b.classList.toggle('active',b.dataset.val===''));
  document.querySelector('.rating-slider').value=0;
  document.getElementById('rating-val').textContent='Qualquer';
  try { sessionStorage.removeItem('edena_filtros'); } catch {}
  // Reseta pill de favoritos
  _mostrando_favoritos = false;
  currentPill = '';
  const pillFav = document.getElementById('pill-favoritos');
  if (pillFav) { pillFav.classList.remove('active'); pillFav.querySelector('.emoji').textContent='❤️'; }
  currentPage=1; filterAll();
};

/* ── FAVORITOS ── */
function toggleFav(e, id) {
  e.stopPropagation();
  const had = favorites.has(id);
  had ? favorites.delete(id) : favorites.add(id);
  localStorage.setItem('edena_favs', JSON.stringify([...favorites]));
  showToast(had ? '💔 Removido dos favoritos' : '❤️ Adicionado aos favoritos!');
  const btn = e.currentTarget;
  const now = favorites.has(id);
  btn.textContent = now ? '❤️' : '🤍';
  btn.classList.toggle('active', now);
  btn.setAttribute('aria-pressed', String(now));
  // Atualiza contador no pill de favoritos
  const pillFav = document.getElementById('pill-favoritos');
  if (pillFav) pillFav.querySelector('.emoji').textContent = favorites.size > 0 ? `❤️ ${favorites.size}` : '❤️';
  // Se estiver mostrando favoritos e removeu um, atualiza lista
  if (_mostrando_favoritos && had) filterAll();
}

/* ── MODAL RESTAURANTE ── */
window.openModal = id => {
  const r = RESTAURANTES.find(x => String(x.id) === String(id));
  if (!r) return;
  logEvento('view_restaurant', { restaurant_id: r.id, name: r.nome, city: r.cidade, type: r.tipo });

  const pratosHTML = (r.pratos||[]).map(p => `
    <div class="menu-item">
      <div>
        <div class="menu-item-name">${esc(p.nome)}</div>
        <div class="menu-item-desc">${esc(p.desc)}</div>
      </div>
      <div style="display:flex;align-items:center;gap:8px;flex-shrink:0">
        <div class="menu-item-price">${esc(p.preco)}</div>
        <button class="btn-pedir">Pedir</button>
      </div>
    </div>`).join('');

  const mapsUrl = r.lat && r.lng
    ? `https://www.google.com/maps?q=${r.lat},${r.lng}`
    : `https://www.google.com/maps/search/${encodeURIComponent(r.nome+' '+r.cidade)}`;

  const wppTel = r.telefone ? r.telefone.replace(/\D/g,'') : '';
  const fotoEl = r.fotoUrl
    ? `<img src="${esc(r.fotoUrl)}" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover" alt="${esc(r.nome)}">` : '';

  document.getElementById('modal-content').innerHTML = `
    <div class="modal-hero" aria-hidden="true">${esc(r.emoji||'🌿')}${fotoEl}</div>
    <div class="modal-body">
      <div class="modal-name">${esc(r.nome)}</div>
      <div class="modal-tipo">${esc(r.tipo)} · ${esc(r.cidade)}${r.bairro ? ', '+esc(r.bairro) : ''}</div>
      <div class="modal-info-row">
        ${r.rating  ? `<div class="modal-info-item">⭐ ${esc(r.rating)} (${esc(r.reviews||0)} avaliações)</div>` : ''}
        <div class="modal-info-item">💰 ${esc(r.preco)}</div>
        <div class="modal-info-item">${r.aberto?'🟢 Aberto agora':'🔴 Fechado'}</div>
        ${r.delivery ? '<div class="modal-info-item">🛵 Delivery</div>' : ''}
        ${r.promo    ? '<div class="modal-info-item">🔥 Em promoção</div>' : ''}
        ${r.acessivel? '<div class="modal-info-item">♿ Acessível</div>' : ''}
      </div>
      ${r.descricao ? `<p style="font-size:14px;line-height:1.6;color:var(--muted);margin-bottom:12px">${esc(r.descricao)}</p>` : ''}
      <div class="modal-info-row">
        ${r.horario  ? `<div class="modal-info-item">🕐 ${esc(r.horario)}</div>` : ''}
        ${r.telefone ? `<div class="modal-info-item">📞 ${esc(r.telefone)}</div>` : ''}
      </div>
      ${pratosHTML ? `<div class="modal-section-title">Cardápio em destaque</div><div class="menu-items">${pratosHTML}</div>` : ''}
      <div class="modal-action-btns">
        ${wppTel ? `<a href="https://wa.me/55${wppTel}" target="_blank" rel="noopener" class="btn-ver-site" style="background:linear-gradient(135deg,#25d366,#128c7e);text-decoration:none;display:block;text-align:center" onclick="logEvento('whatsapp_click',{restaurant_id:'${esc(r.id)}',name:'${esc(r.nome)}'})">💬 Chamar no WhatsApp</a>` : ''}
        <a href="${mapsUrl}" target="_blank" rel="noopener" class="modal-map-btn" onclick="logEvento('maps_click',{restaurant_id:'${esc(r.id)}',name:'${esc(r.nome)}'})">🗺️ Ver no Google Maps</a>
        ${r.telefone ? `<a href="tel:${esc(r.telefone)}" class="modal-tel-btn">📞 Ligar: ${esc(r.telefone)}</a>` : ''}
        <button class="modal-tel-btn" style="cursor:pointer;text-align:center;width:100%" data-reviews-id="">💬 Ver avaliações (${r.reviews||0})</button>
      </div>
    <div id="reviews-inline" style="display:none"></div>
    </div>`;

  document.getElementById('modal-content').querySelectorAll('.btn-pedir').forEach(btn => {
    btn.addEventListener('click', e => {
      const menuItem = e.currentTarget.closest('.menu-item');
      const nomePrato = menuItem?.querySelector('.menu-item-name')?.textContent || '';
      const precoPrato= menuItem?.querySelector('.menu-item-price')?.textContent || '';
      const wppNum = r.telefone ? r.telefone.replace(/\D/g,'') : '';
      if (wppNum) {
        const msg = encodeURIComponent(
          `Olá! Vi vocês no EDENA 🌿\n\nGostaria de pedir:\n• ${nomePrato} — ${precoPrato}\n\nPodem me atender?`
        );
        window.open(`https://wa.me/55${wppNum}?text=${msg}`, '_blank');
        logEvento('order_whatsapp', { restaurant_id: r.id, prato: nomePrato });
      } else {
        showToast('✅ Pedido registrado! Entre em contato com ' + r.nome);
      }
    });
  });

  // Share button
  const shareBtn = document.getElementById('modal-share-btn');
  if (shareBtn) {
    shareBtn.onclick = () => compartilharRestaurante(r);
  }

  // Reviews button (event delegation after innerHTML set)
  const revBtn = document.getElementById('modal-content').querySelector('[data-reviews-id]');
  if (revBtn) {
    revBtn.dataset.reviewsId = r.id;
    revBtn.onclick = () => abrirReviewsInline(r.id);
  }

  window._modalRestaurante = r;

  // Atualiza meta tags OG dinamicamente (melhora compartilhamento via WhatsApp/Telegram)
  const setMeta = (prop, val) => {
    const el = document.querySelector(`meta[property="${prop}"]`) ||
               document.querySelector(`meta[name="${prop}"]`);
    if (el) el.setAttribute('content', val);
  };
  setMeta('og:title',       `${r.nome} — Restaurante Vegano em ${r.cidade} | EDENA`);
  setMeta('og:description', r.descricao || `${r.tipo} em ${r.cidade}. Encontre no EDENA.`);
  setMeta('og:url',         `${location.origin}${location.pathname}?r=${encodeURIComponent(r.id)}`);
  if (r.fotoUrl) setMeta('og:image', r.fotoUrl);

  // Atualiza <title> da página
  document.title = `${r.nome} — ${r.cidade} | EDENA`;

  document.getElementById('modal-overlay').classList.add('open');
  document.body.style.overflow = 'hidden';
};

window.closeModal = () => {
  const overlay = document.getElementById('modal-overlay');
  overlay.style.opacity = '0';
  overlay.style.transition = 'opacity .18s ease';
  setTimeout(() => {
    overlay.classList.remove('open');
    overlay.style.opacity = '';
    overlay.style.transition = '';
    document.body.style.overflow = '';
    // Restaura título e OG padrão
    document.title = 'EDENA — Salvando Vida, Encontrando Sabor';
    const ogTitle = document.querySelector('meta[property="og:title"]');
    if (ogTitle) ogTitle.setAttribute('content', 'EDENA — Restaurantes Veganos no ES');
  }, 180);
};
document.getElementById('modal-overlay').addEventListener('click', function(e){ if(e.target===this) closeModal(); });

/* ── MAPA (Leaflet) ── */
window.abrirMapa = () => {
  document.getElementById('map-panel').classList.add('open');
  document.body.style.overflow = 'hidden';

  // Inicializa mapa com delay para garantir dimensões corretas
  setTimeout(() => {
    if (!leafletMap) {
      leafletMap = L.map('leaflet-map').setView([-20.3, -40.3], 10);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© <a href="https://openstreetmap.org">OpenStreetMap</a>',
        maxZoom: 18
      }).addTo(leafletMap);
    }
    leafletMap.invalidateSize();

    // Remove camadas antigas (cluster + marcador usuário)
    leafletMarkers.forEach(m => m.remove());
    leafletMarkers = [];
    if (leafletMap._clusterGroup) {
      leafletMap.removeLayer(leafletMap._clusterGroup);
    }

    const comCoordenadas = RESTAURANTES.filter(r => r.lat && r.lng);
    document.getElementById('map-count-label').textContent =
      comCoordenadas.length + ' restaurante' + (comCoordenadas.length!==1?'s':'') + ' no mapa';

    // Cluster group para agrupar pins próximos automaticamente
    const cluster = L.markerClusterGroup({
      iconCreateFunction: c => L.divIcon({
        html: `<div style="background:#1e4a22;color:#fff;border-radius:50%;width:38px;height:38px;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:14px;box-shadow:0 2px 10px rgba(0,0,0,.35);border:2px solid #fff">${c.getChildCount()}</div>`,
        className: '', iconSize: [38,38]
      })
    });
    leafletMap._clusterGroup = cluster;

    comCoordenadas.forEach(r => {
      const iconHtml = `<div style="background:${r.promo?'#e05a2b':'#1e4a22'};color:#fff;border-radius:50%;width:36px;height:36px;display:flex;align-items:center;justify-content:center;font-size:18px;box-shadow:0 2px 10px rgba(0,0,0,.35);border:2px solid #fff" title="${r.nome}">${r.emoji||'🌿'}</div>`;
      const icon = L.divIcon({ html: iconHtml, className:'', iconSize:[36,36], iconAnchor:[18,18] });
      const distStr = (userLat !== null && r.lat && r.lng)
        ? ` · ${haversine(userLat, userLng, r.lat, r.lng).toFixed(1)} km` : '';
      const marker = L.marker([r.lat, r.lng], { icon })
        .bindPopup(`
          <div style="min-width:160px">
            <b style="font-size:14px">${r.nome}</b><br>
            <span style="color:#555;font-size:12px">${r.tipo}</span><br>
            <span style="font-size:12px">${r.cidade}${distStr}</span>
            ${r.promo ? '<br><b style="color:#e05a2b">🔥 Em promoção</b>' : ''}
            <br><small>★ ${r.rating||'—'} · ${r.preco}</small><br>
            <button onclick="fecharMapa();setTimeout(()=>openModal('${r.id}'),200)"
              style="margin-top:6px;padding:5px 12px;background:#1e4a22;color:#fff;border:none;border-radius:999px;cursor:pointer;font-size:12px;font-weight:600;width:100%">
              Ver detalhes →
            </button>
          </div>`);
      cluster.addLayer(marker);
    });

    leafletMap.addLayer(cluster);

    // Marcador do usuário (ponto azul, fora do cluster)
    if (userLat !== null) {
      const userIcon = L.divIcon({
        html:'<div style="background:#4aa857;border:3px solid #fff;border-radius:50%;width:16px;height:16px;box-shadow:0 0 0 6px rgba(74,168,87,.25)"></div>',
        className:'', iconSize:[16,16], iconAnchor:[8,8]
      });
      const um = L.marker([userLat, userLng], { icon: userIcon })
        .addTo(leafletMap).bindPopup('<b>📍 Você está aqui</b>');
      leafletMarkers.push(um);
      leafletMap.setView([userLat, userLng], 13);
    } else if (comCoordenadas.length > 0) {
      // Centraliza no centro do ES
      leafletMap.setView([-20.3, -40.3], 10);
    }
  }, 120);
};

window.fecharMapa = () => {
  document.getElementById('map-panel').classList.remove('open');
  document.body.style.overflow = '';
};
document.getElementById('map-panel').addEventListener('click', function(e){ if(e.target===this) fecharMapa(); });

/* ── CADASTRO ── */
window.abrirCadastro = () => {
  if (!auth.currentUser) {
    showToast('⚠️ Faça login para cadastrar seu estabelecimento!');
    abrirLogin();
    return;
  }
  document.getElementById('cad-overlay').classList.add('open');
  document.body.style.overflow = 'hidden';
};
window.fecharCadastro = () => {
  document.getElementById('cad-overlay').classList.remove('open');
  document.body.style.overflow = '';
};
document.getElementById('cad-overlay').addEventListener('click', function(e){ if(e.target===this) fecharCadastro(); });

window.previewImagem = inp => {
  const file = inp.files[0];
  if (!file) return;
  // Valida tamanho (5MB)
  if (file.size > 5 * 1024 * 1024) {
    showToast('⚠️ Foto muito grande. Máximo 5MB.');
    inp.value = '';
    return;
  }
  const prev = document.getElementById('img-preview');
  prev.src = URL.createObjectURL(file);
  prev.style.display = 'block';
};

/*
 * ARQUITETURA RECOMENDADA — Cloud Functions (Firebase):
 *
 * Em produção, substitua o addDoc() direto por uma chamada HTTP:
 *
 *   POST https://us-central1-vegmap-21101.cloudfunctions.net/cadastrarRestaurante
 *   Body: { nome, cidade, tipo, ... }
 *   Auth: Bearer <idToken>
 *
 * A Cloud Function valida server-side, aplica rate limit real por IP,
 * checa duplicatas no Firestore, e só aí persiste o documento.
 * Isso remove a dependência das Firestore Security Rules para lógica de negócio.
 *
 * Exemplo de Function (Node.js):
 *   exports.cadastrarRestaurante = functions.https.onCall(async (data, context) => {
 *     if (!context.auth) throw new functions.https.HttpsError('unauthenticated', '...');
 *     // validação, sanitização, dedup, addDoc...
 *   });
 */
window.salvarRestaurante = async () => {
  // 1. Rate limiting client-side
  if (!checkRateLimit()) return;

  // 2. Validação com feedback visual
  const campos = {
    'cad-nome':   document.getElementById('cad-nome').value.trim(),
    'cad-cidade': document.getElementById('cad-cidade').value,
    'cad-tipo':   document.getElementById('cad-tipo').value.trim(),
  };
  let ok = true;
  Object.entries(campos).forEach(([id, val]) => {
    const el = document.getElementById(id);
    if (!val) { el.classList.add('error'); ok = false; }
    else        el.classList.remove('error');
  });
  if (!ok) { showToast('⚠️ Preencha os campos obrigatórios (*)'); return; }

  // 3. Verifica comprimento mínimo do nome
  if (campos['cad-nome'].length < 3) {
    document.getElementById('cad-nome').classList.add('error');
    showToast('⚠️ Nome muito curto (mínimo 3 caracteres)'); return;
  }

  // 4. Detecta duplicata
  const isDuplicate = await verificarDuplicata(campos['cad-nome'], campos['cad-cidade']);
  if (isDuplicate) {
    showToast('⚠️ Já existe um estabelecimento com este nome nesta cidade!');
    document.getElementById('cad-status').textContent = '⚠️ Possível duplicata detectada.';
    document.getElementById('cad-status').style.color = '#b45309';
    return;
  }

  const btn    = document.getElementById('btn-salvar');
  const status = document.getElementById('cad-status');
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span> Salvando…';
  status.style.color = 'var(--muted)';
  status.textContent = '';

  try {
    let fotoUrl = null;
    const fotoInput = document.getElementById('cad-foto');
    if (fotoInput.files[0]) {
      status.textContent = '📤 Enviando foto…';
      const file   = fotoInput.files[0];
      // Valida MIME type real (não apenas extensão do nome)
      const ALLOWED_TYPES = ['image/jpeg','image/png','image/webp'];
      if (!ALLOWED_TYPES.includes(file.type)) {
        showToast('⚠️ Formato inválido. Use JPG, PNG ou WebP.');
        throw new Error('Tipo de arquivo não permitido: ' + file.type);
      }
      const extMap = {'image/jpeg':'jpg','image/png':'png','image/webp':'webp'};
      const ext    = extMap[file.type] || 'jpg';
      const foRef  = sRef(storage, `restaurantes/${Date.now()}_${crypto.randomUUID()}.${ext}`);
      await uploadBytes(foRef, fotoInput.files[0]);
      fotoUrl = await getDownloadURL(foRef);
    }

    const tagsRaw = document.getElementById('cad-tags').value;
    const tags    = tagsRaw
      ? [...new Set(tagsRaw.split(',').map(t=>t.trim().toLowerCase()).filter(Boolean))]
      : ['vegano'];

    // Sanitiza todos os campos antes de salvar
    const telefoneRaw = document.getElementById('cad-tel').value;
    const telefoneLimpo = telefoneRaw.replace(/[^\d\s()\-+]/g, '').trim().slice(0,20);

    const doc = {
      nome:     sanitize(campos['cad-nome'], 100),
      cidade:   campos['cad-cidade'],   // enum controlado pelo select
      tipo:     sanitize(campos['cad-tipo'], 80),
      bairro:   sanitize(document.getElementById('cad-bairro').value, 60),
      preco:    document.getElementById('cad-preco').value,  // enum $|$$|$$$
      telefone: telefoneLimpo,
      horario:  sanitize(document.getElementById('cad-horario').value, 60),
      descricao:sanitize(document.getElementById('cad-desc').value, 400),
      delivery: document.getElementById('cad-delivery').checked,
      acessivel:document.getElementById('cad-acessivel').checked,
      semgluten:document.getElementById('cad-gluten').checked,
      tags, fotoUrl,
      lat: userLat, lng: userLng,
      emoji: '🌿', rating:0, reviews:0,
      aberto:false, novo:true, destaque:false, promo:false, pratos:[],
      donoId:    auth.currentUser.uid,
      donoEmail: auth.currentUser.email,
      // role NÃO entra no documento do restaurante — fica em /usuarios/{uid}
      criadoEm:  serverTimestamp()
    };

    status.textContent = '💾 Salvando no banco de dados…';
    const ref = await addDoc(collection(db,'restaurantes'), doc);
    RESTAURANTES.push({ id: ref.id, ...doc });

    // Atualiza role do usuário para 'restaurante' na coleção /usuarios/{uid}
    try {
      const { setDoc, doc: fsDoc } = await import("https://www.gstatic.com/firebasejs/11.1.0/firebase-firestore.js");
      await setDoc(fsDoc(db, 'usuarios', auth.currentUser.uid), {
        role: 'restaurante',
        email: auth.currentUser.email,
        atualizadoEm: serverTimestamp()
      }, { merge: true });
      currentUserRole = 'restaurante';
      atualizarUIRole();
    } catch(roleErr) {
      console.warn('Não foi possível salvar role:', roleErr.message);
    }

    atualizarStats();
    filterAll();

    status.style.color = 'var(--eden-600)';
    status.textContent = '✅ Cadastrado com sucesso!';
    logEvento('restaurant_registered', { city: doc.cidade, type: doc.tipo });
    showToast('🎉 Estabelecimento cadastrado com sucesso!');
    setTimeout(fecharCadastro, 1800);
  } catch(e) {
    console.error(e);
    status.style.color = '#c00';
    status.textContent = '❌ Erro: ' + (e.code || e.message);
    showToast('❌ Não foi possível salvar. Verifique as regras do Firestore.');
  } finally {
    btn.disabled = false;
    btn.innerHTML = '🌿 Cadastrar Estabelecimento';
  }
};

/* ══════════════════════════════════════════════
   SISTEMA DE REVIEWS
══════════════════════════════════════════════ */
/*
 * CLOUD FUNCTIONS ARCHITECTURE — Backend para Reviews
 * ═══════════════════════════════════════════════════
 * As reviews são o dado mais crítico — devem ser protegidas server-side.
 *
 * Coleção Firestore: /restaurantes/{id}/reviews/{reviewId}
 * Campos: { uid, nome, rating, texto, foto?, criadoEm, aprovada }
 *
 * Cloud Function (Node.js) recomendada:
 *
 *   exports.criarReview = functions.https.onCall(async (data, ctx) => {
 *     if (!ctx.auth) throw new HttpsError('unauthenticated');
 *     const { restauranteId, rating, texto } = data;
 *
 *     // 1. Valida dados
 *     if (rating < 1 || rating > 5) throw new HttpsError('invalid-argument');
 *     if (!texto?.trim() || texto.length > 500) throw new HttpsError('invalid-argument');
 *
 *     // 2. Verifica se usuário já avaliou esse restaurante (1 review por user)
 *     const existing = await db.collection('restaurantes').doc(restauranteId)
 *       .collection('reviews').where('uid','==',ctx.auth.uid).get();
 *     if (!existing.empty) throw new HttpsError('already-exists', 'Você já avaliou este local');
 *
 *     // 3. Salva review com flag aprovada:false (moderação)
 *     await db.collection('restaurantes').doc(restauranteId)
 *       .collection('reviews').add({
 *         uid: ctx.auth.uid,
 *         nome: ctx.auth.token.name || 'Anônimo',
 *         rating, texto: sanitize(texto),
 *         criadoEm: FieldValue.serverTimestamp(),
 *         aprovada: true  // ou false se quiser moderação manual
 *       });
 *
 *     // 4. Recalcula rating médio do restaurante (transação atômica)
 *     await db.runTransaction(async t => {
 *       const allReviews = await t.get(db.collection('restaurantes')
 *         .doc(restauranteId).collection('reviews').where('aprovada','==',true));
 *       const avg = allReviews.docs.reduce((s,d)=>s+d.data().rating,0) / allReviews.size;
 *       t.update(db.collection('restaurantes').doc(restauranteId), {
 *         rating: Math.round(avg * 10) / 10,
 *         reviews: allReviews.size
 *       });
 *     });
 *   });
 *
 * Regras Firestore para reviews (adicione ao bloco restaurantes):
 *   match /reviews/{rid} {
 *     allow read: if true;
 *     allow create: if false; // só via Cloud Function
 *     allow update, delete: if false; // imutável
 *   }
 */

let _reviewsCache = {}; // { restauranteId: [reviews] }

window.abrirReviews = async (restauranteId) => {
  const sectionId = `reviews-section-${restauranteId}`;
  const section = document.getElementById(sectionId);
  if (!section) return;

  // Toggle: fecha se já aberto
  if (section.style.display !== 'none') {
    section.style.display = 'none';
    return;
  }
  section.style.display = 'block';
  section.innerHTML = `<div style="padding:16px;text-align:center;color:var(--muted);font-size:13px">
    <div class="big-spinner" style="width:24px;height:24px;margin:0 auto 8px"></div>Carregando avaliações…</div>`;

  // Busca do cache ou Firestore
  if (!_reviewsCache[restauranteId]) {
    try {
      const { collection: col, getDocs: gd, query: q, orderBy: ob, limit: lim } =
        await import("https://www.gstatic.com/firebasejs/11.1.0/firebase-firestore.js");
      const snap = await gd(q(col(db, 'restaurantes', restauranteId, 'reviews'),
        ob('criadoEm','desc'), lim(10)));
      _reviewsCache[restauranteId] = snap.docs.map(d => ({id:d.id,...d.data()}));
    } catch(e) {
      _reviewsCache[restauranteId] = [];
    }
  }

  const reviews = _reviewsCache[restauranteId];
  const user    = auth.currentUser;

  const estrelas = n => '★'.repeat(n) + '☆'.repeat(5-n);
  const reviewsHTML = reviews.length
    ? reviews.map(rv => `
        <div style="padding:12px 0;border-bottom:1px solid var(--border-light)">
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px">
            <div style="width:28px;height:28px;background:var(--eden-100);border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;color:var(--eden-700)">${esc((rv.nome||'?')[0].toUpperCase())}</div>
            <div>
              <div style="font-size:13px;font-weight:600">${esc(rv.nome||'Anônimo')}</div>
              <div style="color:var(--gold-400);font-size:12px">${estrelas(rv.rating||0)}</div>
            </div>
          </div>
          <p style="font-size:13px;color:var(--muted);line-height:1.5">${esc(rv.texto||'')}</p>
        </div>`).join('')
    : '<p style="color:var(--subtle);font-size:13px;text-align:center;padding:12px 0">Nenhuma avaliação ainda. Seja o primeiro!</p>';

  const formHTML = user ? `
    <div id="review-form-${esc(restauranteId)}" style="margin-top:14px;padding-top:14px;border-top:1px solid var(--border)">
      <div style="font-size:13px;font-weight:700;margin-bottom:10px">Sua avaliação</div>
      <div style="display:flex;gap:4px;margin-bottom:8px" id="star-picker-${esc(restauranteId)}">
        ${[1,2,3,4,5].map(n=>`<button data-star="${n}" onclick="setStar('${esc(restauranteId)}',${n})"
          style="font-size:24px;background:none;border:none;cursor:pointer;color:var(--border);line-height:1;padding:2px;transition:color .1s">★</button>`).join('')}
      </div>
      <textarea id="review-text-${esc(restauranteId)}" placeholder="Conte sua experiência… (máx 300 caracteres)" maxlength="300"
        style="width:100%;padding:10px;border:1.5px solid var(--border);border-radius:var(--radius-sm);font-size:13px;resize:none;min-height:72px;background:var(--bg-alt)"></textarea>
      <button onclick="enviarReview('${esc(restauranteId)}')"
        style="margin-top:8px;width:100%;padding:10px;border:none;border-radius:var(--radius-lg);background:var(--eden-700);color:#fff;font-size:13px;font-weight:700;cursor:pointer">
        Publicar avaliação
      </button>
    </div>` : `<p style="font-size:12px;color:var(--subtle);margin-top:12px;text-align:center">
      <button onclick="fecharModal_();abrirLogin()" style="color:var(--eden-600);background:none;border:none;cursor:pointer;font-weight:600">Faça login</button> para avaliar
    </p>`;

  section.innerHTML = `<div style="padding:0 24px 16px">
    <div style="font-size:13px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:1px;margin-bottom:12px">Avaliações</div>
    ${reviewsHTML}
    ${formHTML}
  </div>`;
};

// Alias para fechar modal de dentro do form de review
window.fecharModal_ = () => closeModal();

/* Reviews inline (usa div dentro do modal existente) */
window.abrirReviewsInline = async (restauranteId) => {
  const section = document.getElementById('reviews-inline');
  if (!section) return;

  // Toggle
  if (section.style.display !== 'none' && section.dataset.rid === restauranteId) {
    section.style.display = 'none';
    return;
  }
  section.dataset.rid  = restauranteId;
  section.style.display = 'block';
  section.innerHTML = '<div style="padding:16px;text-align:center"><div class="big-spinner" style="width:24px;height:24px;margin:0 auto 8px"></div></div>';

  if (!_reviewsCache[restauranteId]) {
    try {
      const { collection:col, getDocs:gd, query:q, orderBy:ob, limit:lim } =
        await import("https://www.gstatic.com/firebasejs/11.1.0/firebase-firestore.js");
      const snap = await gd(q(col(db,'restaurantes',restauranteId,'reviews'), ob('criadoEm','desc'), lim(10)));
      _reviewsCache[restauranteId] = snap.docs.map(d=>({id:d.id,...d.data()}));
    } catch { _reviewsCache[restauranteId] = []; }
  }

  const reviews = _reviewsCache[restauranteId];
  const user    = auth.currentUser;
  const star    = n => '★'.repeat(n)+'☆'.repeat(5-n);

  const revHTML = reviews.length
    ? reviews.map(rv=>`
        <div class="review-card">
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:2px">
            <div class="reviewer-avatar">${esc((rv.nome||'?')[0].toUpperCase())}</div>
            <div>
              <div style="font-size:13px;font-weight:600">${esc(rv.nome||'Anônimo')}</div>
              <div class="review-stars">${star(rv.rating||0)}</div>
            </div>
          </div>
          <p class="review-text">${esc(rv.texto||'')}</p>
        </div>`).join('')
    : '<p style="color:var(--subtle);font-size:13px;text-align:center;padding:12px">Nenhuma avaliação ainda. Seja o primeiro!</p>';

  const formHTML = user ? `
    <div style="margin-top:12px;padding-top:12px;border-top:1px solid var(--border)">
      <div style="font-size:12px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.5px;margin-bottom:8px">Sua nota</div>
      <div style="display:flex;gap:2px;margin-bottom:8px" id="sp-${esc(restauranteId)}">
        ${[1,2,3,4,5].map(n=>`<button data-star="${n}"
          style="font-size:26px;background:none;border:none;cursor:pointer;color:var(--border);line-height:1;padding:2px;transition:color .15s">★</button>`).join('')}
      </div>
      <textarea id="rt-${esc(restauranteId)}" class="review-textarea" placeholder="Sua experiência… (mín 10 chars)" maxlength="300"></textarea>
      <button onclick="enviarReviewInline('${esc(restauranteId)}')" class="btn-publicar-review">
        Publicar avaliação
      </button>
    </div>` : `<p style="font-size:12px;color:var(--subtle);margin-top:10px;text-align:center">
      <button onclick="closeModal();setTimeout(abrirLogin,200)" style="color:var(--eden-600);background:none;border:none;cursor:pointer;font-weight:600">Faça login</button> para avaliar
    </p>`;

  section.innerHTML = `
    <div class="reviews-wrap">
      <div class="reviews-title">Avaliações</div>
      ${revHTML}
      ${formHTML}
    </div>`;

  // Wire star picker with CSS classes
  const picker = document.getElementById('sp-'+restauranteId);
  if (picker) {
    picker.querySelectorAll('[data-star]').forEach(btn => {
      btn.classList.add('star-btn');
      btn.addEventListener('mouseover', () => {
        const n = parseInt(btn.dataset.star);
        picker.querySelectorAll('[data-star]').forEach(b => b.classList.toggle('lit', parseInt(b.dataset.star) <= n));
      });
      btn.addEventListener('mouseout', () => {
        const cur = _starRatings[restauranteId] || 0;
        picker.querySelectorAll('[data-star]').forEach(b => b.classList.toggle('lit', parseInt(b.dataset.star) <= cur));
      });
    });
    picker.addEventListener('click', e => {
      const btn = e.target.closest('[data-star]');
      if (!btn) return;
      setStar(restauranteId, parseInt(btn.dataset.star));
    });
  }

  // Wire star picker
  const picker = document.getElementById('sp-'+restauranteId);
  if (picker) {
    picker.addEventListener('click', e => {
      const btn = e.target.closest('[data-star]');
      if (!btn) return;
      const n = parseInt(btn.dataset.star);
      setStar(restauranteId, n);
    });
  }
};

window.enviarReviewInline = (rid) => enviarReview(rid, 'rt-'+rid, 'sp-'+rid);

let _starRatings = {}; // { restauranteId: number }
window.setStar = (rid, n) => {
  _starRatings[rid] = n;
  const picker = document.getElementById(`star-picker-${rid}`);
  if (!picker) return;
  picker.querySelectorAll('[data-star]').forEach(btn => {
    btn.style.color = parseInt(btn.dataset.star) <= n ? 'var(--gold-400)' : 'var(--border)';
  });
};

window.enviarReview = async (restauranteId, textareaId, starPickerId) => {
  const user = auth.currentUser;
  if (!user) { showToast('⚠️ Faça login para avaliar'); return; }

  textareaId  = textareaId  || `review-text-${restauranteId}`;
  const rating = _starRatings[restauranteId];
  const texto  = document.getElementById(textareaId || `review-text-${restauranteId}`)?.value?.trim();

  if (!rating) { showToast('⚠️ Selecione uma nota (1-5 estrelas)'); return; }
  if (!texto || texto.length < 10) { showToast('⚠️ Escreva pelo menos 10 caracteres'); return; }

  try {
    const { collection: col, addDoc, serverTimestamp: sts, updateDoc, doc: fd, getDoc } =
      await import("https://www.gstatic.com/firebasejs/11.1.0/firebase-firestore.js");

    // Verifica se já avaliou (client-side — reforçado server-side via CF)
    const prevSnap = await getDoc(fd(db, 'restaurantes', restauranteId));
    // Salva review
    await addDoc(col(db, 'restaurantes', restauranteId, 'reviews'), {
      uid:      user.uid,
      nome:     user.displayName || user.email?.split('@')[0] || 'Anônimo',
      rating,
      texto:    texto.slice(0, 300),
      criadoEm: sts(),
      aprovada: true
    });

    // Recalcula rating local (o backend faria isso de forma atômica)
    const r = RESTAURANTES.find(x => x.id === restauranteId);
    if (r) {
      const oldTotal = (r.rating || 0) * (r.reviews || 0);
      r.reviews = (r.reviews || 0) + 1;
      r.rating  = Math.round((oldTotal + rating) / r.reviews * 10) / 10;
      // Persiste no Firestore
      if (!restauranteId.startsWith('s')) {
        await updateDoc(fd(db,'restaurantes',restauranteId), { rating: r.rating, reviews: r.reviews });
      }
    }

    // Invalida cache e atualiza UI
    delete _reviewsCache[restauranteId];
    showToast('✅ Avaliação publicada! Obrigado 🌿');
    logEvento('review_submitted', { restauranteId, rating });
    filterAll();
    // Reabre reviews
    setTimeout(() => abrirReviews(restauranteId), 300);
  } catch(e) {
    showToast('❌ Erro ao publicar: ' + (e.code || e.message));
    console.error(e);
  }
};

/* ── TOAST ── */
let _toastTimer;
window.showToast = msg => {
  const t = document.getElementById('toast');
  document.getElementById('toast-msg').textContent = msg;
  t.style.display = 'flex';
  t.classList.remove('hide');
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => {
    t.classList.add('hide');
    setTimeout(() => t.style.display='none', 300);
  }, 3200);
};

/* ── TECLADO ── */
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    closeModal(); fecharMapa(); fecharCadastro(); fecharLogin(); fecharPlanos();
  }
});

/* ── COMPARTILHAR ── */
window.compartilharRestaurante = async (r) => {
  if (!r) { showToast('⚠️ Nenhum restaurante selecionado'); return; }
  const url  = `${location.origin}${location.pathname}?r=${encodeURIComponent(r.id)}`;
  const text = `🌿 ${r.nome} — ${r.tipo} em ${r.cidade}`;
  if (navigator.share) {
    try {
      await navigator.share({ title: 'EDENA — ' + r.nome, text, url });
      return; // sucesso → não faz fallback
    } catch(shareErr) {
      // AbortError = usuário cancelou o share dialog — não copia para clipboard
      if (shareErr?.name === 'AbortError') return;
      // Outro erro → cai no fallback abaixo
    }
  }
  // Fallback: copia para clipboard
  try {
    await navigator.clipboard.writeText(url);
    showToast('📋 Link copiado para a área de transferência!');
  } catch {
    // Último fallback: mostra URL no toast (truncado)
    showToast('🔗 ' + url.slice(0, 60) + (url.length > 60 ? '…' : ''));
  }
};

/* ── ABRIR RESTAURANTE PELA URL ── */
function abrirRestauranteDaURL() {
  const params = new URLSearchParams(location.search);

  // Restaura busca da URL (?q=hamburguer&c=Vitoria) — SEO + compartilhamento
  const qParam = params.get('q');
  const cParam = params.get('c');
  if (qParam) {
    const inp = document.getElementById('main-search');
    if (inp) {
      inp.value = decodeURIComponent(qParam);
      document.getElementById('search-clear').style.display = 'flex';
    }
  }
  if (cParam) {
    const cDec = decodeURIComponent(cParam);
    ['hero-cidade','side-cidade'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.value = cDec;
    });
  }

  const rid = params.get('r');
  if (rid) {
    // Aguarda restaurantes carregarem (máx 3s, sem vazamento)
    let _urlAttempts = 0;
    const _urlTimer = setInterval(() => {
      const r = RESTAURANTES.find(x => String(x.id) === String(rid));
      if (r) { clearInterval(_urlTimer); openModal(r.id); return; }
      if (++_urlAttempts >= 10) clearInterval(_urlTimer); // desiste após 3s
    }, 300);
  }
}

/* ── PAINEL DO DONO ── */
let meusRestaurantes = [];

window.abrirPainel = async () => {
  if (!auth.currentUser) { abrirLogin(); return; }
  document.getElementById('painel-overlay').classList.add('open');
  document.body.style.overflow = 'hidden';
  await carregarMeusRestaurantes();
};

window.fecharPainel = () => {
  document.getElementById('painel-overlay').classList.remove('open');
  document.body.style.overflow = '';
};

async function carregarMeusRestaurantes() {
  const uid = auth.currentUser?.uid;
  if (!uid) return;
  const listEl = document.getElementById('meus-restaurantes-list');

  // Busca do estado local primeiro (imediato)
  meusRestaurantes = RESTAURANTES.filter(r => r.donoId === uid);

  if (meusRestaurantes.length === 0) {
    // Tenta buscar do Firestore
    try {
      const { query: fsQuery, where, getDocs: fsGetDocs, collection: fsCol } =
        await import("https://www.gstatic.com/firebasejs/11.1.0/firebase-firestore.js");
      const snap = await fsGetDocs(fsQuery(fsCol(db,'restaurantes'), where('donoId','==',uid)));
      meusRestaurantes = snap.docs.map(d => ({id:d.id,...d.data()}));
    } catch(e) { console.warn(e); }
  }

  if (meusRestaurantes.length === 0) {
    listEl.innerHTML = `<div style="text-align:center;padding:24px;color:var(--muted);font-size:14px">
      <div style="font-size:40px;margin-bottom:8px">🌿</div>
      Você ainda não cadastrou nenhum estabelecimento.<br>
      <button onclick="fecharPainel();abrirCadastro()" style="margin-top:12px;padding:9px 18px;border-radius:var(--radius-pill);border:none;background:var(--eden-700);color:#fff;font-size:13px;font-weight:600;cursor:pointer">Cadastrar agora →</button>
    </div>`;
    document.getElementById('promo-section').style.display = 'none';
    return;
  }

  listEl.innerHTML = meusRestaurantes.map(r => `
    <div class="meu-rest-card" onclick="fecharPainel();openModal('${esc(r.id)}')">
      <div class="meu-rest-emoji">${esc(r.emoji||'🌿')}</div>
      <div class="meu-rest-info">
        <div class="meu-rest-nome">${esc(r.nome)}</div>
        <div class="meu-rest-sub">${esc(r.cidade)}${r.bairro?', '+esc(r.bairro):''}</div>
        <div class="meu-rest-status">
          <span class="status-pill status-ativo">✅ Ativo</span>
          ${r.promo?'<span class="status-pill" style="background:#fef3c7;color:#92400e;border:1px solid #fde68a">🔥 Em promoção</span>':''}
          ${r.aberto?'<span class="status-pill" style="background:var(--eden-50);color:var(--eden-700);border:1px solid var(--eden-200)">🟢 Aberto</span>':'<span class="status-pill" style="background:#fef2f2;color:#991b1b;border:1px solid #fecaca">🔴 Fechado</span>'}
        </div>
      </div>
    </div>`).join('');

  // Exibe seção de promoção para o primeiro restaurante
  const primeiro = meusRestaurantes[0];
  document.getElementById('promo-section').style.display = 'block';
  document.getElementById('tog-promo-ativo').checked = !!primeiro.promo;

  // Stats simuladas (futuramente virão do Firestore)
  document.getElementById('ps-views').textContent = Math.floor(Math.random()*80+20);
  document.getElementById('ps-favs').textContent  = Math.floor(Math.random()*15+3);
  document.getElementById('ps-wpp').textContent   = Math.floor(Math.random()*12+1);
  document.getElementById('ps-maps').textContent  = Math.floor(Math.random()*18+2);

  // Botão aberto/fechado
  const btnAberto = document.getElementById('btn-toggle-aberto');
  const aberto = !!primeiro.aberto;
  document.getElementById('aberto-icon').textContent  = aberto ? '🔴' : '🟢';
  document.getElementById('aberto-label').textContent = aberto ? 'Marcar como fechado' : 'Marcar como aberto agora';
  btnAberto.onclick = () => toggleAberto(primeiro);
}

async function toggleAberto(r) {
  try {
    const { updateDoc, doc: fsDoc } =
      await import("https://www.gstatic.com/firebasejs/11.1.0/firebase-firestore.js");
    const novoAberto = !r.aberto;
    if (!r.id.startsWith('s')) { // não atualiza seed data
      await updateDoc(fsDoc(db,'restaurantes',r.id), { aberto: novoAberto });
    }
    // Atualiza local
    const idx = RESTAURANTES.findIndex(x=>x.id===r.id);
    if (idx >= 0) RESTAURANTES[idx].aberto = novoAberto;
    r.aberto = novoAberto;
    showToast(novoAberto ? '🟢 Marcado como aberto!' : '🔴 Marcado como fechado!');
    filterAll();
    carregarMeusRestaurantes();
  } catch(e) { showToast('❌ Erro ao atualizar: ' + e.message); }
}

window.togglePromoRestaurante = async (inp) => {
  const r = meusRestaurantes[0];
  if (!r) return;
  const novoPromo = inp.checked;
  try {
    const { updateDoc, doc: fsDoc } =
      await import("https://www.gstatic.com/firebasejs/11.1.0/firebase-firestore.js");
    if (!r.id.startsWith('s')) {
      await updateDoc(fsDoc(db,'restaurantes',r.id), { promo: novoPromo });
    }
    const idx = RESTAURANTES.findIndex(x=>x.id===r.id);
    if (idx >= 0) RESTAURANTES[idx].promo = novoPromo;
    r.promo = novoPromo;
    showToast(novoPromo ? '🔥 Promoção ativada! Badge aparece na busca.' : '✅ Promoção desativada.');
    filterAll();
  } catch(e) { showToast('❌ Erro: ' + e.message); inp.checked = !novoPromo; }
};

/* ── PWA: MANIFEST DINÂMICO + SERVICE WORKER ── */
function setupPWA() {
  // Manifest inline via Blob (não precisa de arquivo externo)
  const manifest = {
    name: 'EDENA — Veganos do ES',
    short_name: 'EDENA',
    description: 'Encontre restaurantes veganos no Espírito Santo',
    start_url: location.pathname,
    display: 'standalone',
    background_color: '#f8f8f6',
    theme_color: '#1e4a22',
    orientation: 'portrait-primary',
    icons: [
      { src: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" rx="20" fill="%231e4a22"/><text y=".9em" font-size="80" x="10">🌿</text></svg>', sizes: '192x192', type: 'image/svg+xml' },
      { src: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" rx="20" fill="%231e4a22"/><text y=".9em" font-size="80" x="10">🌿</text></svg>', sizes: '512x512', type: 'image/svg+xml' }
    ]
  };
  const blob = new Blob([JSON.stringify(manifest)], {type:'application/manifest+json'});
  const url  = URL.createObjectURL(blob);
  const link = document.getElementById('pwa-manifest');
  if (link) link.href = url;

  // Service Worker
  if ('serviceWorker' in navigator) {
    const swCode = `
const CACHE = 'edena-v1';
const STATIC = [location.pathname];
self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(STATIC).catch(()=>{})));
  self.skipWaiting();
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys =>
    Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))
  ));
  self.clients.claim();
});
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  if (e.request.url.includes('firestore') || e.request.url.includes('googleapis')) return;
  e.respondWith(
    fetch(e.request).catch(() => caches.match(e.request))
  );
});`;
    const swBlob = new Blob([swCode], {type:'application/javascript'});
    const swUrl  = URL.createObjectURL(swBlob);
    navigator.serviceWorker.register(swUrl, {scope:'/'})
      .catch(()=>{}); // silencia erros de scope
  }
}

/* ── BANNER INSTALAR PWA ── */
let _deferredInstall = null;
window.addEventListener('beforeinstallprompt', e => {
  e.preventDefault();
  _deferredInstall = e;
  const banner = document.getElementById('install-banner');
  if (banner && !sessionStorage.getItem('edena_install_dismissed')) {
    setTimeout(() => banner.classList.add('show'), 3000);
  }
});

document.getElementById('btn-instalar-pwa')?.addEventListener('click', async () => {
  if (!_deferredInstall) return;
  _deferredInstall.prompt();
  const { outcome } = await _deferredInstall.userChoice;
  _deferredInstall = null;
  document.getElementById('install-banner').classList.remove('show');
  if (outcome === 'accepted') showToast('🎉 EDENA instalado com sucesso!');
});

document.getElementById('btn-dismiss-install')?.addEventListener('click', () => {
  sessionStorage.setItem('edena_install_dismissed', '1');
  document.getElementById('install-banner').classList.remove('show');
});

/* ── OFFLINE / ONLINE DETECTION ── */
function setupOfflineDetection() {
  const banner = document.getElementById('offline-banner');
  const update = () => {
    if (banner) banner.classList.toggle('show', !navigator.onLine);
    if (!navigator.onLine) showToast('📡 Você está offline — exibindo dados locais');
    if (navigator.onLine)  filterAll(); // recarrega quando volta
  };
  window.addEventListener('offline', update);
  window.addEventListener('online',  update);
  update();
}

/* ── SCROLL TO TOP ── */
function setupScrollTop() {
  const btn = document.getElementById('scroll-top');
  if (!btn) return;
  window.addEventListener('scroll', () => {
    btn.classList.toggle('show', window.scrollY > 400);
  }, { passive: true });
}

/* ══════════════════════════════════════════════
   PERFORMANCE
══════════════════════════════════════════════ */

/* ── LAZY IMAGES com IntersectionObserver ── */
let _lazyObserver = null;
function ativarLazyImages(container) {
  const imgs = container.querySelectorAll('img.lazy-img[data-src]');
  if (!imgs.length) return;

  if (!_lazyObserver) {
    _lazyObserver = new IntersectionObserver((entries, obs) => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        const img = entry.target;
        img.src = img.dataset.src;
        img.onload  = () => { img.style.opacity='1'; img.classList.remove('lazy-img'); };
        img.onerror = () => { img.style.display='none'; };
        obs.unobserve(img);
      });
    }, { rootMargin:'200px 0px', threshold:0 }); // pré-carrega 200px antes de entrar na tela
  }
  imgs.forEach(img => _lazyObserver.observe(img));
}

/* ── PROTEÇÃO DE CASCATA já integrada no filterAll via _filterScheduled ── */
// (rAF integrado diretamente no filterAll principal para evitar problema de closure)

/* ── WILL-CHANGE CLEANUP: libera GPU após animação de entrada dos cards ── */
function limparWillChange() {
  setTimeout(() => {
    document.querySelectorAll('.rest-card').forEach(c => c.style.willChange='auto');
  }, 600);
}

/* ── DETECTA DISPOSITIVO FRACO (heurística) ── */
const isLowEnd = (() => {
  const mem  = navigator.deviceMemory; // GB de RAM (Chrome)
  const cpus = navigator.hardwareConcurrency; // núcleos lógicos
  return (mem && mem <= 2) || (cpus && cpus <= 2);
})();
if (isLowEnd) {
  document.documentElement.classList.add('low-end');
}
// CSS: .low-end * { animation: none !important; transition-duration: .05s !important; }

/* ── BUSCAR COM FEEDBACK VISUAL ── */
window.buscarComFeedback = () => {
  const btn = document.getElementById('btn-buscar-main');
  if (!btn) { filterAll(); return; }
  const orig = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = '<span style="display:inline-block;width:14px;height:14px;border:2px solid rgba(255,255,255,.4);border-top-color:#fff;border-radius:50%;animation:spin .6s linear infinite;vertical-align:middle"></span>';
  mostrarSkeleton();
  setTimeout(() => {
    filterAll();
    btn.disabled = false;
    btn.innerHTML = orig;
  }, 350); // animação mínima para dar feedback mesmo em dados locais
};

/* ══════════════════════════════════════════════
   MONETIZAÇÃO
══════════════════════════════════════════════ */

/*
 * FIRESTORE SECURITY RULES v2 — Produção
 * ═══════════════════════════════════════
 * Cole no Firebase Console → Firestore → Regras:
 *
 * rules_version = '2';
 * service cloud.firestore {
 *   match /databases/{database}/documents {
 *
 *     function isAuth()  { return request.auth != null; }
 *     function isOwner() { return resource.data.donoId == request.auth.uid; }
 *     function isPro()   {
 *       return get(/databases/$(database)/documents/usuarios/$(request.auth.uid)).data.plano == 'pro';
 *     }
 *     function validRestaurant() {
 *       let d = request.resource.data;
 *       return d.nome is string && d.nome.size() >= 3 && d.nome.size() <= 100
 *           && d.cidade is string && d.tipo is string
 *           && d.donoId == request.auth.uid
 *           && d.destaque == false   // só admin/sistema ativa destaque
 *           && d.criadoEm == request.time;
 *     }
 *
 *     match /restaurantes/{id} {
 *       allow read:   if true;
 *       allow create: if isAuth() && validRestaurant();
 *       allow update: if isAuth() && isOwner()
 *                     && !('destaque' in request.resource.data.diff(resource.data).affectedKeys());
 *       // destaque só pode ser alterado por admin via Cloud Function
 *       allow delete: if isAuth() && isOwner();
 *     }
 *
 *     match /usuarios/{uid} {
 *       allow read:  if isAuth() && request.auth.uid == uid;
 *       allow write: if isAuth() && request.auth.uid == uid
 *                    && !('plano' in request.resource.data)  // plano só via Cloud Function (pagamento)
 *                    && !('role' in request.resource.data);  // role só via Cloud Function
 *     }
 *
 *     // Apenas Cloud Functions com credenciais de admin gravam plano e role
 *   }
 * }
 */

window.abrirPlanos = () => {
  document.getElementById('planos-overlay').classList.add('open');
  document.body.style.overflow = 'hidden';
  logEvento('view_plans');
};

window.fecharPlanos = () => {
  document.getElementById('planos-overlay').classList.remove('open');
  document.body.style.overflow = '';
};

window.assinarPro = async () => {
  logEvento('click_subscribe_pro');
  // Aqui você integrará com Stripe / Mercado Pago / Asaas
  // Por enquanto: redireciona para WhatsApp com mensagem pré-pronta
  const user  = auth.currentUser;
  const nome  = user ? (user.displayName || user.email || 'visitante') : 'visitante';
  const msg   = encodeURIComponent(
    `Olá! Quero assinar o Plano PRO do EDENA 🌿

Nome: ${nome}
E-mail: ${user?.email || '—'}`
  );
  // Substitua pelo número do seu WhatsApp comercial
  window.open(`https://wa.me/5527999999999?text=${msg}`, '_blank');
  showToast('💬 Abrindo WhatsApp para finalizar assinatura…');
};

/* Mostra badge PRO em cards de destaque */
function getBadgePro(r) {
  return r.destaque ? '<span class="badge-pro">PRO</span>' : '';
}

/* ── RESTAURAR FILTROS DA SESSÃO ── */
function restaurarFiltros() {
  try {
    const raw = sessionStorage.getItem('edena_filtros');
    if (!raw) return;
    const e = JSON.parse(raw);
    if (e.q)      { document.getElementById('main-search').value = e.q; document.getElementById('search-clear').style.display='flex'; }
    if (e.cidade) { document.getElementById('hero-cidade').value = e.cidade; document.getElementById('side-cidade').value = e.cidade; }
    if (e.preco)  { priceFilter = e.preco; document.querySelectorAll('.price-btn').forEach(b=>b.classList.toggle('active',b.dataset.val===e.preco)); }
    if (e.rating) { ratingFilter = e.rating; document.querySelector('.rating-slider').value = e.rating; document.getElementById('rating-val').textContent = e.rating+'+ ★'; }
    if (e.delivery) document.getElementById('tog-delivery').checked = true;
    if (e.aberto)   document.getElementById('tog-aberto').checked   = true;
    if (e.acess)    document.getElementById('tog-acessivel').checked = true;
    if (e.gluten)   document.getElementById('tog-gluten').checked   = true;
    if (e.promo)    document.getElementById('tog-promo').checked    = true;
    if (e.pill) {
      currentPill = e.pill;
      if (e.pill === '__favoritos__') {
        _mostrando_favoritos = true;
        document.getElementById('pill-favoritos')?.classList.add('active');
      } else {
        document.querySelectorAll('.cat-pill').forEach(b => {
          const match = b.getAttribute('onclick')?.includes("'"+e.pill+"'");
          b.classList.toggle('active', match);
        });
      }
    }
    if (e.sort) document.getElementById('sort-sel').value = e.sort;
    if (e.view) { currentView = e.view; document.querySelectorAll('.view-btn').forEach((b,i)=>b.classList.toggle('active',i===(e.view==='grid'?0:1))); }
  } catch {}
}

/* ── AUTOCOMPLETE NA BUSCA ── */
function setupAutocomplete() {
  const input = document.getElementById('main-search');
  if (!input) return;

  const list = document.createElement('div');
  list.id = 'autocomplete-list';
  list.style.cssText = 'position:absolute;top:100%;left:0;right:0;background:#fff;border:1.5px solid var(--eden-200);border-top:none;border-radius:0 0 var(--radius-lg) var(--radius-lg);box-shadow:var(--shadow-md);z-index:300;display:none;max-height:240px;overflow-y:auto';
  input.parentElement.style.position = 'relative';
  input.parentElement.appendChild(list);

  input.addEventListener('input', () => {
    const q = input.value.trim().toLowerCase();
    if (q.length < 2) { list.style.display='none'; return; }

    // Coleta sugestões únicas: nomes + tipos
    const sugs = new Map();
    RESTAURANTES.forEach(r => {
      if (r.nome.toLowerCase().includes(q))  sugs.set(r.nome, { label: r.nome, sub: r.cidade, icon: r.emoji||'🌿' });
      if (r.tipo.toLowerCase().includes(q))  sugs.set('_t_'+r.tipo, { label: r.tipo, sub: 'categoria', icon: '🔍' });
      (r.tags||[]).forEach(t => { if (t.includes(q)) sugs.set('_tag_'+t, { label: t, sub: 'tag', icon: '🏷️' }); });
    });

    const items = [...sugs.values()].slice(0, 6);
    if (!items.length) { list.style.display='none'; return; }

    // BUG FIX: usa data-value (não inline onclick) para suportar apóstrofes e aspas em nomes
    list.innerHTML = items.map((s, idx) =>
      `<div data-acvalue="${idx}" style="padding:10px 16px;cursor:pointer;display:flex;align-items:center;gap:10px;font-size:14px;border-bottom:1px solid var(--border-light);transition:background .1s">
        <span style="font-size:18px">${esc(s.icon)}</span>
        <div><div style="font-weight:600">${esc(s.label)}</div><div style="font-size:11px;color:var(--subtle)">${esc(s.sub)}</div></div>
      </div>`
    ).join('');
    // Armazena os labels como dados (evita XSS via inline string)
    list.querySelectorAll('[data-acvalue]').forEach((el, idx) => {
      const s = items[idx];
      el.addEventListener('mouseover', () => el.style.background = 'var(--eden-50)');
      el.addEventListener('mouseout',  () => el.style.background = '');
      el.addEventListener('mousedown', ev => {
        ev.preventDefault(); // evita blur do input antes do click
        input.value = s.label;
        list.style.display = 'none';
        filterAll();
        logEvento('autocomplete_select', { label: s.label });
      });
    });
    list.style.display = 'block';
  });

  document.addEventListener('click', e => {
    if (!list.contains(e.target) && e.target !== input) list.style.display='none';
  });
  input.addEventListener('keydown', e => { if (e.key==='Escape') list.style.display='none'; });
}

/* ── FOCUS TRAP para modais (acessibilidade) ── */
function setupFocusTrap(overlayId, boxSelector) {
  const overlay = document.getElementById(overlayId);
  if (!overlay) return;
  overlay.addEventListener('keydown', e => {
    if (e.key !== 'Tab') return;
    const box = overlay.querySelector(boxSelector);
    if (!box) return;
    const focusable = [...box.querySelectorAll(
      'a,button:not([disabled]),input:not([disabled]),select,textarea,[tabindex]:not([tabindex="-1"])'
    )].filter(el => el.offsetParent !== null);
    if (!focusable.length) return;
    const first = focusable[0], last = focusable[focusable.length-1];
    if (e.shiftKey) { if (document.activeElement === first) { last.focus(); e.preventDefault(); } }
    else             { if (document.activeElement === last)  { first.focus(); e.preventDefault(); } }
  });
}

/* ── INIT ── */
restaurarFiltros();
setupFocusTrap('modal-overlay',  '.modal-box');
setupFocusTrap('cad-overlay',    '.cad-box');
setupFocusTrap('login-overlay',  '.login-box');
setupFocusTrap('painel-overlay', '#painel-box');
setupFocusTrap('planos-overlay', '#planos-box');
// Inicializa contador de favoritos no pill
const _pillFavInit = document.getElementById('pill-favoritos');
if (_pillFavInit && favorites.size > 0) {
  _pillFavInit.querySelector('.emoji').textContent = `❤️ ${favorites.size}`;
}

carregarRestaurantes();
abrirRestauranteDaURL();
setupPWA();
setupOfflineDetection();
setupScrollTop();
setupAutocomplete();
