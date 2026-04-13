
import{loadTheme,toggleTheme,shortAddr}from"./core.js";
import{connectDid,clearDid,getDid,bindEthereumAccountsChanged,formatDidStatus}from"./wallet.js";


const ROUTES = [
  { key:"id",    label:"ID",    ico:"🪪", href:"/" },
  { key:"dao",   label:"DAO",   ico:"🏛️", href:"/dao/" },
  { key:"token", label:"Token", ico:"🪙", href:"/token/" },
  { key:"dex",   label:"DEX",   ico:"🔁", href:"#" },
  { key:"ia",    label:"IA",    ico:"🤖", href:"#" },
  { key:"ar",    label:"AR",    ico:"🕶️", href:"#" }
];



function currentFolder(){
  const p = location.pathname.split("/").filter(Boolean);
  return p[0] || "id";
}


function el(t,a={},h=""){
  const n=document.createElement(t);
  for(const[k,v] of Object.entries(a)) k==="class"?n.className=v:n.setAttribute(k,v);
  if(h) n.innerHTML=h;
  return n;
}

function esc(s){
  return String(s??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[m]));
}

function openModal(id){
  const m=document.getElementById(id);
  if(m){m.classList.add("open");m.setAttribute("aria-hidden","false");}
}
function closeModal(id){
  const m=document.getElementById(id);
  if(m){m.classList.remove("open");m.setAttribute("aria-hidden","true");}
}

async function fetchFirstJson(urls){
  for(const u of urls){
    try{
      const r=await fetch(u,{cache:"no-store"});
      if(!r.ok) continue;
      return await r.json();
    }catch{}
  }
  return null;
}

function pauseOnHold(row){
  if(!row) return;
  const pause=()=>row.classList.add("is-paused");
  const play =()=>row.classList.remove("is-paused");
  row.addEventListener("mouseenter",pause);
  row.addEventListener("mouseleave",play);
  row.addEventListener("pointerdown",pause);
  row.addEventListener("pointerup",play);
  row.addEventListener("pointercancel",play);
  row.addEventListener("touchstart",pause,{passive:true});
  row.addEventListener("touchend",play,{passive:true});
}


/* normaliza paths legacy a /assets/... */
function normAssetPath(path,defaultDir="/assets/data/"){
  const s=String(path||"").trim();
  if(!s) return "";
  if(/^https?:\/\//i.test(s)) return s;                 // url absoluta
  if(s.startsWith("/assets/")) return s;                // correcto
  if(s.startsWith("assets/")) return "/"+s;             // assets/.. -> /assets/..
  if(s.startsWith("../assets/")) return s.replace("../","/"); // ../assets -> /assets
  if(s.startsWith("./assets/")) return s.replace("./","/");   // ./assets -> /assets
  if(s.startsWith("../alemty.eth/assets/")) return s.replace("../alemty.eth",""); // legacy -> /assets/...
  // si solo viene el filename, lo asumimos en /assets/data/
  if(!s.includes("/")) return defaultDir+s;
  return s;
}


async function loadCreds(drawer){
  const poapEl=drawer.querySelector("#poapStrip");
  const tabsEl=drawer.querySelector("#certTabs");
  const stripEl=drawer.querySelector("#certStrip");
  const detailEl=drawer.querySelector("#certDetail");
  if(!poapEl||!tabsEl||!stripEl||!detailEl) return;

  // ✅ Shuffle local (solo se usa dentro de loadCreds)
  function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = crypto.getRandomValues(new Uint32Array(1))[0] % (i + 1);
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }
  /* ✅ assets ahora vive en raíz */
  const poapUrls=[
    "/assets/poap/poaps.v3.json",
    "assets/poap/poaps.v3.json"
  ];
  const certUrls=[
    "/assets/data/certifications.json",
    "assets/data/certifications.json"
  ];

/* POAPS */

const poaps=await fetchFirstJson(poapUrls);
  if(poaps && Array.isArray(poaps) && poaps.length){
    
const base = poaps.map(p => {
  const title = esc(p.title ?? "POAP");
  const href = (p.hasUrl && p.url) ? p.url : "#";
  const dis  = href === "#" ? ` aria-disabled="true" tabindex="-1"` : "";
  const img  = esc(p.img ?? "");
  return `<a class="poap" href="${esc(href)}" target="_blank" rel="noopener noreferrer"${dis}>
            <img src="${img}" alt="${title}" loading="lazy">
            <span class="label">${title}</span>
          </a>`;
});

// ✅ aquí la aleatoriedad
const baseShuffled = shuffle(base);

// ✅ luego repites para el carrusel infinito
const filled = repeatToMin(baseShuffled, Math.max(12, baseShuffled.length * 3)).join("");
poapEl.innerHTML=`<div class="poap-row" id="poapRow"><div class="poap-marquee"><div class="poap-track">${filled}</div><div class="poap-track" aria-hidden="true">${filled}</div></div></div>`;
    const poapRow=poapEl.querySelector("#poapRow");
    if(poapRow){poapRow.style.setProperty("--poap-duration","36s");pauseOnHold(poapRow);}
  }else{
    poapEl.innerHTML=`<div class="small muted">POAPs no disponibles.</div>`;
  }




/* CERTIFICACIONES */
  const certs=await fetchFirstJson(certUrls);
  if(!certs || !Array.isArray(certs) || !certs.length){
    tabsEl.innerHTML="";
    stripEl.innerHTML=`<div class="small muted">Certificaciones no disponibles.</div>`;
    detailEl.innerHTML=`<div class="t">Sin datos</div><div class="m small muted">No se pudieron cargar certificaciones.</div>`;
    return;
  }

  const groups={};
  for(const c of certs){
    const cat=c.category||"Otros";
    (groups[cat]=groups[cat]||[]).push(c);
  }

  const preferred=["IA","TI","Cloud","Web 3.0","Design","Marketing","Games","Jobs","Education","Otros"];
  let cats=Object.keys(groups).sort((a,b)=>{
    const ia=preferred.indexOf(a),ib=preferred.indexOf(b);
    if(ia!==-1||ib!==-1) return (ia===-1?999:ia)-(ib===-1?999:ib);
    return a.localeCompare(b,"es");
  });



// solo con badgeImg válido (normalizado)
  const readyByCat={};
  for(const cat of cats){
    readyByCat[cat]=groups[cat]
      .slice()
      .sort((x,y)=>(y.score||0)-(x.score||0))
      .map(x=>({...x,_badge:normAssetPath(x.badgeImg)}))
      .filter(x=>typeof x._badge==="string" && x._badge.trim().length>0);
  }

  cats=cats.filter(cat=>readyByCat[cat].length>0);
  if(!cats.length){
    tabsEl.innerHTML="";
    stripEl.innerHTML=`<div class="small muted">Aún no hay medallas con imagen.</div>`;
    detailEl.innerHTML=`<div class="t">Acreditaciones</div><div class="m small muted">Sube PNGs y agrega badgeImg en el JSON.</div>`;
    return;
  }

 tabsEl.innerHTML=cats.map((cat,i)=>
    `<button class="cert-tab ${i===0?"active":""}" type="button" data-cat="${esc(cat)}">${esc(cat)} <span class="n">${readyByCat[cat].length}</span></button>`
  ).join("");


// Render por categoría (solo ready)


stripEl.innerHTML=cats.map((cat,i)=>{
    const ready=readyByCat[cat];
    const base=ready.map((c,realIdx)=>{
      const title=esc(c.title||"Acreditación");
      const href=c.url||"#";
      const dis=href==="#"?` aria-disabled="true" tabindex="-1"`:"";
      const img=`<img src="${esc(c._badge)}" alt="${title}" loading="lazy">`;
      return {html:`<a class="cert-badge" href="${esc(href)}" target="_blank" rel="noopener noreferrer"${dis} data-cat="${esc(cat)}" data-idx="${realIdx}">${img}<span class="label">${title}</span></a>`};
    });


  
 const REPEAT=4, MIN_ITEMS=12;
    let expanded=[];
    if(base.length){
      while(expanded.length<Math.max(MIN_ITEMS,base.length*REPEAT)) expanded=expanded.concat(base);
      expanded=expanded.slice(0,Math.max(MIN_ITEMS,base.length*REPEAT));
    }
    const tiles=expanded.map(x=>x.html).join("");
    return `<div class="cert-row ${i===0?"active":""}" data-cat="${esc(cat)}"><div class="cert-marquee"><div class="cert-track">${tiles}</div><div class="cert-track" aria-hidden="true">${tiles}</div></div></div>`;
  }).join("");



// Velocidad + pausa por fila

 stripEl.querySelectorAll(".cert-row").forEach(row=>{
    row.style.setProperty("--cert-duration","40s");
    pauseOnHold(row);
  });

stripEl.querySelectorAll(".cert-badge img").forEach(img=>{
    img.addEventListener("error",()=>{
      const a=img.closest(".cert-badge");
      if(a) a.remove();
    },{once:true});
  });

  detailEl.innerHTML=`<div class="t">${esc(cats[0])}</div><div class="m small muted">Selecciona una medalla para ver detalles.</div>`;

  tabsEl.querySelectorAll(".cert-tab").forEach(btn=>{
    btn.addEventListener("click",()=>{
      tabsEl.querySelectorAll(".cert-tab").forEach(x=>x.classList.remove("active"));
      btn.classList.add("active");
      const cat=btn.getAttribute("data-cat");
      stripEl.querySelectorAll(".cert-row").forEach(r=>r.classList.toggle("active",r.getAttribute("data-cat")===cat));
      detailEl.innerHTML=`<div class="t">${esc(cat)}</div><div class="m small muted">Selecciona una medalla para ver detalles.</div>`;
    });
  });

  stripEl.querySelectorAll(".cert-badge").forEach(a=>{
    a.addEventListener("click",(e)=>{
      e.preventDefault();
      const cat=a.getAttribute("data-cat");
      const idx=Number(a.getAttribute("data-idx")||"0");
      const c=(readyByCat[cat]||[])[idx];
      if(!c) return;
      const title=esc(c.title||"Acreditación");
      const issuer=esc(c.issuer||"");
      const year=c.year?` · ${esc(c.year)}`:"";
      const category=esc(c.category||cat||"Otros");
      const url=c.url||"#";
      detailEl.innerHTML=`<div class="t">${title}</div><div class="m small muted">${issuer}${year} · ${category}</div><div class="actions"><a class="cert-cta" href="${esc(url)}" target="_blank" rel="noopener noreferrer">Ver certificado</a></div>`;
    });
  });


function repeatToMin(arr,min){
  const a=Array.isArray(arr)?arr.slice():[];
  if(a.length===0)return [];
  while(a.length<min)a.push(...a);
  return a.slice(0,min);
}

// Si alguna imagen falla, quita ese badge del carrusel (evita basura visual)
stripEl.querySelectorAll(".cert-badge img").forEach(img=>{
  img.addEventListener("error",()=>{
    const a=img.closest(".cert-badge");
    if(a) a.remove();
  },{once:true});
});

detailEl.innerHTML=`<div class="t">${esc(cats[0]||"Acreditaciones")}</div><div class="m small muted">Selecciona una medalla para ver detalles.</div>`;

// Tabs: mostrar solo la fila activa
tabsEl.querySelectorAll(".cert-tab").forEach(btn=>{
  btn.addEventListener("click",()=>{
    tabsEl.querySelectorAll(".cert-tab").forEach(x=>x.classList.remove("active"));
    btn.classList.add("active");
    const cat=btn.getAttribute("data-cat");
    stripEl.querySelectorAll(".cert-row").forEach(r=>r.classList.toggle("active",r.getAttribute("data-cat")===cat));
    detailEl.innerHTML=`<div class="t">${esc(cat)}</div><div class="m small muted">Selecciona una medalla para ver detalles.</div>`;
  });
});

// Click: usa el MISMO readyByCat (idx ya coincide)
stripEl.querySelectorAll(".cert-badge").forEach(a=>{
  a.addEventListener("click",(e)=>{
    e.preventDefault();
    const cat=a.getAttribute("data-cat");
    const idx=Number(a.getAttribute("data-idx")||"0");
    const ready=readyByCat[cat]||[];
    const c=ready[idx];
    if(!c) return;

    const title=esc(c.title||"Acreditación");
    const issuer=esc(c.issuer||"");
    const year=c.year?` · ${esc(c.year)}`:"";
    const category=esc(c.category||cat||"Otros");
    const url=c.url||"#";

    detailEl.innerHTML=`<div class="t">${title}</div><div class="m small muted">${issuer}${year} · ${category}</div><div class="actions"><a class="cert-cta" href="${esc(url)}" target="_blank" rel="noopener noreferrer">Ver certificado</a></div>`;
  });
});
}

export function mountShell(){
const appState = {
  did: null,
  siwe: false,
  balances: {}
};
window.__alemtyShellMounted=true;
loadTheme();
requestAnimationFrame(()=>document.documentElement.classList.add("theme-ready"));
bindEthereumAccountsChanged();

const hostKey=currentFolder();
const topbar=document.getElementById("topbar");
const navbar=document.getElementById("navbar");
if(!topbar||!navbar)return;

topbar.classList.add("topbar");
navbar.classList.add("navbar");

const topInner=el("div",{class:"topbar-inner"});
const brand=el("a",{class:"brand-link",href: "/","aria-label":"Ir a ID"},`<span class="brand">alemty<span class="dot">.</span><span class="eth">eth</span></span>`);
const icons=el("div",{class:"iconbar"});
const themeBtn=el("button",{class:"icon-btn",id:"themeBtn",type:"button","aria-label":"Tema"},"🌘");
const profileBtn=el("button",{class:"icon-btn",id:"profileBtn",type:"button","aria-label":"Perfil"},"🧙🏻");
const menuBtn=el("button",{class:"icon-btn",id:"menuBtn",type:"button","aria-label":"Menú"},"☰");
icons.append(themeBtn,profileBtn,menuBtn);
topInner.append(brand,icons);
topbar.innerHTML="";
topbar.append(topInner);
navbar.innerHTML="";

const bottomNav=el("nav",{class:"bottom-nav",id:"bottomNav"});
const bottomInner=el("div",{class:"bottom-nav-inner"});
ROUTES.forEach(r=>{
const a=el("a",{class:"bottom-btn",href:r.href,"data-key":r.key,"aria-label":r.key},`<span class="ico">${r.ico}</span><span class="lbl">${r.label}</span>`);
if(r.key===hostKey)a.classList.add("active");
bottomInner.appendChild(a);
});
bottomNav.appendChild(bottomInner);
document.getElementById("bottomNav")?.remove();
document.body.appendChild(bottomNav);

const drawerBackdrop=el("div",{class:"drawer-backdrop",id:"drawerBackdrop"});
const drawer=el("aside",{class:"drawer",id:"drawer","aria-hidden":"true"});


drawer.innerHTML = `
  <div class="drawer-head">
    <strong class="code">Menú</strong>
    <button class="icon-btn" id="drawerClose" type="button" aria-label="Cerrar">✕</button>
  </div>

  <div class="drawer-body">

    <!-- =========================
         IDENTIDAD (DID / SIWE)
         ========================= -->
    <div class="acc open" data-acc="did">
      <button class="acc-h" type="button" data-open="did" aria-expanded="true">
        <span>Identidad (DID)</span>
        <span class="chev">▾</span>
      </button>

      <div class="acc-p" id="accDid">
        <div class="did-box">

          <div class="did-row">
            <span class="k">Estado</span>
            <span class="v code" id="didStatus">${esc(formatDidStatus())}</span>
          </div>

          <div class="did-row">
            <span class="k">DID</span>
            <span class="v code" id="didAddress">—</span>
          </div>

          <div class="did-row">
            <span class="k">SIWE</span>
            <!-- ⛔ NO tocar este texto desde HTML -->
            <!-- ✅ Se actualiza dinámicamente vía JS + localStorage -->
            <span class="v code" id="siweStatus">DID ⚠️</span>
          </div>

        </div>

        <div class="did-actions">
          <button class="drawer-link" id="connectBtn" type="button">🦊 Conectar MetaMask</button>
          <button class="drawer-link" id="disconnectBtn" type="button">⛔ Desconectar</button>
          

          <!-- Dispara el flujo SIWE -->
          <button class="drawer-link" id="siweBtn" type="button">✅ Verificar SIWE</button>
        </div>

        <div class="small muted" style="margin-top:10px;">
          MetaMask valida conexión. SIWE valida identidad (firma + verificación).
        </div>
      </div>
    </div>

    <!-- =========================
         CREDENCIALES
         ========================= -->
    <div class="acc" data-acc="cred">
      <button class="acc-h" type="button" data-open="cred" aria-expanded="false">
        <span>Credenciales</span>
        <span class="chev">▾</span>
      </button>

      <div class="acc-p" id="accCred">

        <div class="poap-head">
          <strong>POAPs</strong>
          <span class="small muted">Carrusel</span>
        </div>
        <div class="poap-strip" id="poapStrip"></div>

        <div class="cred-head" style="margin-top:14px;">
          <strong>Acreditaciones</strong>
          <span class="small muted">Por categoría</span>
        </div>

        <div class="cert-tabs" id="certTabs"></div>
        <div class="cert-strip" id="certStrip"></div>

        <div class="cert-detail" id="certDetail">
          <div class="t">Selecciona una acreditación</div>
          <div class="m small muted">
            Al pulsar una medalla verás el detalle aquí.
          </div>
        </div>

      </div>
    </div>

  </div>
`;


document.body.append(drawerBackdrop, drawer);

drawer.querySelector("#siweBtn")?.addEventListener("click", async () => {
  console.log("🔐 SIWE: click");

  try {
    const address = getDid();
    console.log("👛 DID:", address);

    if (!address) {
      alert("Conecta tu wallet primero");
      return;
    }

    const API = "https://alemtydao-siwe.alejandrogtzz93.workers.dev";

    // 1) Nonce
    console.log("➡️ solicitando nonce");
    const nonceRes = await fetch(`${API}/nonce`, { cache: "no-store" });
    if (!nonceRes.ok) {
      const t = await nonceRes.text().catch(() => "");
      console.error("❌ nonceRes not ok:", nonceRes.status, t);
      alert("❌ Error obteniendo nonce");
      return;
    }

    const nonceJson = await nonceRes.json().catch(() => ({}));
    console.log("✅ nonce:", nonceJson);

    const nonce = nonceJson?.nonce;
    if (!nonce) throw new Error("Nonce inválido");

    // 2) Mensaje SIWE
    const message = [
      "alemty.eth wants you to sign in with your Ethereum account:",
      address,
      "",
      "Sign in with Ethereum to AlemtyDAO.",
      "",
      `URI: ${location.origin}`,
      "Version: 1",
      "Chain ID: 8453",
      `Nonce: ${nonce}`,
      `Issued At: ${new Date().toISOString()}`
    ].join("\n");

    console.log("📝 SIWE message:\n", message);

    // 3) Firma
    if (!window.ethereum?.request) {
      alert("❌ No se detectó proveedor Ethereum (MetaMask)");
      return;
    }

    console.log("✍️ solicitando firma");
    const signature = await window.ethereum.request({
      method: "personal_sign",
      params: [message, address]
    });
    console.log("✅ firma:", signature);

    // 4) Verify
    console.log("➡️ verificando en backend");
    const verifyRes = await fetch(`${API}/verify`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ message, signature })
    });

    if (!verifyRes.ok) {
      const t = await verifyRes.text().catch(() => "");
      console.error("❌ verifyRes not ok:", verifyRes.status, t);
      alert("❌ SIWE rechazado por backend (HTTP error)");
      // Limpieza defensiva
      localStorage.removeItem("alemty.siwe");
      localStorage.removeItem("alemty.jwt");
      return;
    }

    const result = await verifyRes.json().catch(() => ({}));
    console.log("✅ verify result:", result);

    if (result?.ok === true) {
      // ✅ Marca SIWE ok
      localStorage.setItem("alemty.siwe", "ok");

      // ✅ Guarda DID/address
      const verifiedAddr = (result.address || address || "").toLowerCase();
      if (verifiedAddr) {
        localStorage.setItem("alemty.did", verifiedAddr);
        localStorage.setItem("did", verifiedAddr); // compat legacy
      }

      // ✅ Guarda JWT (ESTO ES LO QUE TE FALTABA)
      // Backend ideal: { ok:true, address:"0x...", token:"..." }
      const token = result.token || result.jwt || result.session || null;

      if (token) {
        localStorage.setItem("alemty.jwt", token);
        console.log("✅ JWT guardado en localStorage: alemty.jwt");
      } else {
        // Si el backend no lo manda, no habrá /api/me/stats
        localStorage.removeItem("alemty.jwt");
        console.warn("⚠️ SIWE ok pero NO vino token. Revisa que /verify devuelva { token }.");
      }

      // ✅ Refresca UI del drawer
      if (typeof updateSiweStatus === "function") updateSiweStatus();
      if (typeof syncDid === "function") syncDid();

      alert("✅ SIWE verificado correctamente");
    } else {
      alert("❌ SIWE rechazado por backend");
      // Limpieza defensiva
      localStorage.removeItem("alemty.siwe");
      localStorage.removeItem("alemty.jwt");
    }
  } catch (err) {
    console.error("💥 SIWE ERROR:", err);
    alert("❌ Error durante SIWE (ver consola)");
    // Limpieza defensiva
    localStorage.removeItem("alemty.siwe");
    localStorage.removeItem("alemty.jwt");
  }
});




// 🔌 Botón: Desconectar wallet
drawer.querySelector("#disconnectBtn")?.addEventListener("click", () => {
  // 1. Desconecta la wallet (DID)
  clearDid();

  // 2. Borra estado SIWE
  localStorage.removeItem("alemty.siwe");

  // 3. Actualiza UI
  updateSiweStatus();
  syncDid();
});



document.getElementById("drawerBackdrop")?.remove();
document.getElementById("drawer")?.remove();
document.body.append(drawerBackdrop,drawer);

const openDrawer=()=>{drawer.classList.add("open");drawer.setAttribute("aria-hidden","false");drawerBackdrop.classList.add("show");};
const closeDrawer=()=>{drawer.classList.remove("open");drawer.setAttribute("aria-hidden","true");drawerBackdrop.classList.remove("show");};

function openAcc(which){
drawer.querySelectorAll(".acc").forEach(s=>{
const id=s.getAttribute("data-acc");
const open=id===which;
s.classList.toggle("open",open);
const h=s.querySelector(".acc-h");
h&&h.setAttribute("aria-expanded",open?"true":"false");
});
}
drawer.querySelectorAll(".acc-h").forEach(btn=>btn.addEventListener("click",()=>openAcc(btn.getAttribute("data-open"))));

themeBtn.addEventListener("click",toggleTheme);
menuBtn.addEventListener("click",()=>drawer.classList.contains("open")?closeDrawer():openDrawer());
drawer.querySelector("#drawerClose")?.addEventListener("click",closeDrawer);
drawerBackdrop.addEventListener("click",closeDrawer);
document.addEventListener("keydown",e=>{if(e.key!=="Escape")return;drawer.classList.contains("open")&&closeDrawer();const pm=document.getElementById("profileModal");pm&&pm.classList.contains("open")&&closeModal("profileModal");});

const didStatus=drawer.querySelector("#didStatus");
const didAddress=drawer.querySelector("#didAddress");


// Helper: resume direcciones Ethereum / DID
function shortHex(addr, start = 6, end = 4){
  if(!addr || typeof addr !== 'string') return '—';
  if(addr.length <= start + end) return addr;
  return `${addr.slice(0, start)}…${addr.slice(-end)}`;
}

// Sync del estado DID en el drawer
function syncDid(){
  const a = getDid();

  // Estado (arriba)
  didStatus.textContent = a
    ? `Conectado: ${shortHex(a)}`
    : 'No conectado';

  // DID (fila dedicada)
  if(a){
    didAddress.textContent = shortHex(a);
    didAddress.title = a; // tooltip con la address completa
  } else {
    didAddress.textContent = '—';
    didAddress.removeAttribute('title');
  }

  // El estado SIWE (DID ⚠️ / SIWE ✅) lo maneja esta función
  // (si ya la pegaste como te indiqué antes)
  if (typeof updateSiweStatus === 'function') {
    updateSiweStatus();
  }
}


function updateSiweStatus() {
  const el = document.getElementById("siweStatus");
  if (!el) return;

  const siweOk = localStorage.getItem("alemty.siwe") === "ok";
  const did = localStorage.getItem("alemty.did") || localStorage.getItem("did");

  el.textContent = (siweOk && did) ? "SIWE ✅" : "DID ⚠️";
}



drawer.querySelector("#connectBtn")?.addEventListener("click",async()=>{try{await connectDid();}catch{}syncDid();});
drawer.querySelector("#disconnectBtn")?.addEventListener("click",()=>{clearDid();syncDid();});
window.addEventListener("did:changed",syncDid);
syncDid();




loadCreds(drawer);





/* =========================================================
   Perfil modal (ESTADO + ACTIVIDAD + barras + slots items)
========================================================= */

const profileModal = el("div", { class: "modal", id: "profileModal", "aria-hidden": "true" });

profileModal.innerHTML = `
  <div class="modal-backdrop" id="profileBackdrop"></div>
  <div class="modal-card profile-card">
    <div class="modal-headbar">
      <strong>Perfil</strong>
      <button class="icon-btn" id="profileClose" type="button" aria-label="Cerrar">✕</button>
    </div>

    <div class="profile-grid">
      <aside class="profile-left">
        <div class="profile-avatar empty" id="pfAvatarBox">
          <img id="pfAvatar" alt="Avatar"/>
        </div>

        <!-- Nivel SOLO arriba -->
        <div class="profile-level">
          <div class="lvl" id="pfLevel">Nivel —</div>
          <div class="rank" id="pfTitle">—</div>
        </div>

        <div class="profile-addr" id="pfAddr">—</div>

        <!-- Slots = items equipados (NO Aura aquí) -->
        <div class="profile-slots">
          <div class="slot" id="slotNivelBox">
            <div class="slot-k">Item (Nivel)</div>
            <div class="slot-v" id="slotNivel">—</div>
          </div>
          <div class="slot">
            <div class="slot-k">Rol</div>
            <div class="slot-v" id="slotRol">—</div>
          </div>
          <div class="slot">
            <div class="slot-k">veNFT</div>
            <div class="slot-v" id="slotVeNFT">—</div>
          </div>
          <div class="slot">
            <div class="slot-k">Assets</div>
            <div class="slot-v" id="slotAssets">—</div>
          </div>
          <div class="slot">
            <div class="slot-k">Agent</div>
            <div class="slot-v" id="slotAgent">—</div>
          </div>
          <div class="slot">
            <div class="slot-k">Lands</div>
            <div class="slot-v" id="slotLands">—</div>
          </div>
        </div>
      </aside>

      <section class="profile-right">
        <div class="profile-tabs" id="pfTabs">
          <button class="tab-btn active" data-tab="estado">ESTADO</button>
          <button class="tab-btn" data-tab="actividad">User</button>
          <button class="tab-btn" data-tab="dm">DM</button>
          <button class="tab-btn" data-tab="dex">DEX</button>
          <button class="tab-btn" data-tab="tienda">🛒</button>
        </div>

        <div class="profile-fixed">
          <div class="barbox">
            <div class="bar-top">
              <strong>Dharma</strong>
              <span class="small muted" id="pfXpText">0</span>
            </div>
            <div class="bar-track">
              <div class="bar-fill dharma" id="pfXpBar" style="width:0%"></div>
            </div>
          </div>

          <div class="barbox">
            <div class="bar-top">
              <strong>Karma</strong>
              <span class="small muted" id="pfKarmaText">0</span>
            </div>
            <div class="bar-track">
              <div class="bar-fill karma" id="pfKarmaBar" style="width:0%"></div>
            </div>
          </div>

          <!-- Wallet interna (tokens por color) -->
          <div class="pf-balances" id="pfBalances">
            <div class="token token-dharma">
              <span class="ico">🟢</span><span class="lbl">Dharma</span><span class="val" id="pfDharma">—</span>
            </div>
            <div class="token token-aura">
              <span class="ico">🔵</span><span class="lbl">Aura</span><span class="val" id="pfAura">—</span>
            </div>
            <div class="token token-karma" id="pfKarmaToken">
              <span class="ico">🔴</span><span class="lbl">Karma</span><span class="val" id="pfKarmaVal">—</span>
            </div>
            <div class="token token-alem">
              <span class="ico">🟡</span><span class="lbl">$ALEM</span><span class="val" id="pfAlem">—</span>
            </div>
            <div class="token token-vealem">
              <span class="ico">🟠</span><span class="lbl">veALEM</span><span class="val" id="pfVeAlem">—</span>
            </div>
            <div class="small muted hint vealem"></div>
          </div>
        </div>

        <div class="profile-content" id="pfContent"></div>
      </section>
    </div>
  </div>
`;

document.getElementById("profileModal")?.remove();
document.body.appendChild(profileModal);

/* =========================
   Cache + utilidades
========================= */

let __ME_STATS__ = null;

// Niveles por Dharma (editable). Dharma define nivel y no baja. [1](https://onedrive.live.com?cid=8C61CF68A019DADE&id=8C61CF68A019DADE!se04a61d341c348b1a2c3f47cc82f4913)[2](https://onedrive.live.com?cid=8C61CF68A019DADE&id=8C61CF68A019DADE!s7661d7b6025c4ae48cf1527b37a4260c)
const LEVELS = [
  { name: "Novato", need: 0 },
  { name: "Iniciado", need: 10 },
  { name: "Plata", need: 25 },
  { name: "Oro", need: 50 },
  { name: "Diamante", need: 100 },
  { name: "Avanzado", need: 200 },
  { name: "Refinado", need: 400 },
  { name: "Unico", need: 800 },
  { name: "Élite", need: 1600 },
  { name: "Superior", need: 3200 },
  { name: "Amasterdamo", need: 6400 },
];

function getLevelByDharma(d) {
  let current = LEVELS[0];
  let next = LEVELS[1] || LEVELS[0];
  for (let i = 0; i < LEVELS.length; i++) {
    if (d >= LEVELS[i].need) {
      current = LEVELS[i];
      next = LEVELS[i + 1] || LEVELS[i];
    } else break;
  }
  return { current, next };
}

function fmtInt(n) {
  const x = Number(n || 0);
  return Number.isFinite(x) ? String(x) : "0";
}

function nowMs() { return Date.now(); }

function getSessionStartMs(addr) {
  if (!addr) return 0;
  const key = `alemty.session.startedAt.${addr.toLowerCase()}`;
  const raw = localStorage.getItem(key);
  const n = Number(raw || 0);
  if (Number.isFinite(n) && n > 0) return n;
  const t = nowMs();
  localStorage.setItem(key, String(t));
  return t;
}

function formatDuration(ms) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${sec}s`;
  return `${sec}s`;
}


// Slots items: por ahora se leen de localStorage (equipamiento)
// Puedes setearlos desde tu UI futura o “drops”.
function getEquipped(addr, slot) {
  if (!addr) return "—";
  const key = `alemty.equip.${addr.toLowerCase()}.${slot}`;
  return localStorage.getItem(key) || "—";
}

// Ejemplo: NFT “más alto” (si lo quieres guardar con esta key)
function getHighestNft(addr) {
  if (!addr) return "—";
  const key = `alemty.nft.highest.${addr.toLowerCase()}`;
  return localStorage.getItem(key) || "—";
}

/**
 * ✅ API base:
 * - En DEV (LiveServer 127.0.0.1:5500): pega al Worker API en PROD
 * - En PROD (mismo origin): usa rutas relativas
 */
const API_BASE =
  location.hostname === "127.0.0.1" || location.hostname === "localhost"
    ? "https://alemtydao.alejandrogtzz93.workers.dev"
    : "";

/**
 * ✅ Fetch de métricas personales
 * Requiere JWT guardado en localStorage("alemty.jwt")
 */
async function fetchMeStats() {
  const token = localStorage.getItem("alemty.jwt") || "";
  if (!token) return null;

  try {
    const r = await fetch(`${API_BASE}/api/me/stats`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });

    // Si no hay CORS o hay error, evita romper el render
    if (!r.ok) {
      console.warn("fetchMeStats not ok:", r.status);
      return null;
    }

    // Evita crash si el backend responde texto en vez de JSON
    const ct = r.headers.get("content-type") || "";
    if (!ct.includes("application/json")) {
      console.warn("fetchMeStats non-json response:", ct);
      return null;
    }

    return await r.json();
  } catch (err) {
    console.error("fetchMeStats error:", err);
    return null;
  }
}


/* =========================
   Renders: ESTADO / ACTIVIDAD
========================= */

function renderEstadoTab() {
  const c = profileModal.querySelector("#pfContent");
  if (!c) return;

  const addr = getDid();
  const s = __ME_STATS__;

  if (!addr) {
    c.innerHTML = `
      <div class="pf-box">
        <div class="h2">Estado</div>
        <p class="muted">Panel MMORPG. Conecta tu wallet desde ☰ para ver tu progreso.</p>
      </div>
    `;
    return;
  }

  const startedAt = getSessionStartMs(addr);
  const connectedFor = formatDuration(nowMs() - startedAt);

  if (!s) {
    c.innerHTML = `
      <div class="pf-box">
        <div class="h2">Estado</div>
        <p class="muted">Panel MMORPG. Conectaremos tokenomics.js después.</p>
        <div class="post-tags" style="margin-top:10px">
          <span class="pill">⏱️ Conectado: <span class="count">${connectedFor}</span></span>
          <span class="pill">🧙‍♂️ DID: <span class="count">${shortAddr(addr)}</span></span>
        </div>
        <p class="small muted" style="margin-top:10px">Tip: si no hay sesión/JWT, /api/me/stats no puede cargar.</p>
      </div>
    `;
    return;
  }

  // Tokenomics: 1 point recibido = 1 Dharma; Aura 1:1 con Dharma [1](https://onedrive.live.com?cid=8C61CF68A019DADE&id=8C61CF68A019DADE!se04a61d341c348b1a2c3f47cc82f4913)[2](https://onedrive.live.com?cid=8C61CF68A019DADE&id=8C61CF68A019DADE!s7661d7b6025c4ae48cf1527b37a4260c)
  const pointsReceived = s?.received?.pointsReceived ?? 0;
  const likesReceived = s?.received?.likesReceived ?? 0;
  const commentsReceived = s?.received?.commentsReceived ?? 0;

  const dharma = s?.tokenomics?.dharma ?? 0;
  const aura = s?.tokenomics?.aura ?? 0;

  c.innerHTML = `
    <div class="pf-box">
      <div class="h2">Estado</div>
      <p class="muted">Panel MMORPG. Conectaremos tokenomics.js después.</p>

      <div class="post-tags" style="margin-top:10px">
        <span class="pill">⏱️ Conectado: <span class="count">${connectedFor}</span></span>
        <span class="pill">🧙‍♂️ DID: <span class="count">${shortAddr(addr)}</span></span>
      </div>

      <div class="post-tags" style="margin-top:10px">
        <span class="pill points">⭐ Points recibidos: <span class="count">${fmtInt(pointsReceived)}</span></span>
        <span class="pill like">♥️ Likes recibidos: <span class="count">${fmtInt(likesReceived)}</span></span>
        <span class="pill comment">💬 Comentarios recibidos: <span class="count">${fmtInt(commentsReceived)}</span></span>
      </div>

      <div class="post-tags" style="margin-top:10px">
        <span class="pill">🟢 Dharma: <span class="count">${fmtInt(dharma)}</span></span>
        <span class="pill">🔵 Aura (wallet interna): <span class="count">${fmtInt(aura)}</span></span>
      </div>

      <p class="small muted" style="margin-top:10px">
        Aura se podrá swapear a futuro por ALEM de gobernanza para stakear.
      </p>
    </div>
  `;
}

function renderActividadTab() {
  const c = profileModal.querySelector("#pfContent");
  if (!c) return;

  const addr = getDid();
  const s = __ME_STATS__;

  if (!addr) {
    c.innerHTML = `
      <div class="pf-box">
        <div class="h2">Actividad</div>
        <p class="muted">Conecta tu wallet para ver tu última actividad.</p>
      </div>
    `;
    return;
  }

  if (!s) {
    c.innerHTML = `
      <div class="pf-box">
        <div class="h2">Actividad</div>
        <p class="muted">SOON</p>
        <p class="small muted">Aquí irá: último post, último comentario, últimas reacciones, etc.</p>
      </div>
    `;
    return;
  }

  const posts = s?.activity?.posts ?? 0;
  const comments = s?.activity?.comments ?? 0;
  const likesGiven = s?.given?.likesGiven ?? 0;
  const pointsGiven = s?.given?.pointsGiven ?? 0;

  // Si luego extiendes /api/me/stats con lastPost/lastComment, aquí lo pintas.
  const lastPost = s?.last?.post || null;
  const lastComment = s?.last?.comment || null;

  c.innerHTML = `
    <div class="pf-box">
      <div class="h2">Actividad</div>
      <p class="muted">Resumen tipo foro: lo último que hiciste y tu ritmo.</p>

      <div class="post-tags" style="margin-top:10px">
        <span class="pill">🧵 Posts: <span class="count">${fmtInt(posts)}</span></span>
        <span class="pill">✍️ Comentarios: <span class="count">${fmtInt(comments)}</span></span>
        <span class="pill like">♥️ Likes dados: <span class="count">${fmtInt(likesGiven)}</span></span>
        <span class="pill points">⭐ Points dados: <span class="count">${fmtInt(pointsGiven)}</span></span>
      </div>

      <div style="margin-top:12px">
        <div class="h2">Último post</div>
        <div class="small muted">${lastPost ? `${lastPost.created_at}` : "SOON"}</div>
        <div style="margin-top:6px">${lastPost ? lastPost.title : "Aquí irá tu último post (título + link)."}</div>
      </div>

      <div style="margin-top:12px">
        <div class="h2">Último comentario</div>
        <div class="small muted">${lastComment ? `${lastComment.created_at}` : "SOON"}</div>
        <div style="margin-top:6px">${lastComment ? lastComment.body : "Aquí irá tu último comentario (snippet + link)."}</div>
      </div>
    </div>
  `;
}

function renderTab(tab) {
  if (tab === "estado") return renderEstadoTab();
  if (tab === "actividad") return renderActividadTab();

  const c = profileModal.querySelector("#pfContent");
  if (!c) return;

  if (tab === "dm") {
    c.innerHTML = `<div class="pf-box"><div class="h2">DM</div><p class="muted">SOON</p></div>`;
  } else if (tab === "dex") {
    c.innerHTML = `
      <div class="pf-box">
        <div class="h2">DEX</div>
        <div class="dex-grid">
          <button class="tab-btn" disabled>Swap</button>
          <button class="tab-btn" disabled>LP Pools</button>
          <button class="tab-btn" disabled>Staking</button>
          <button class="tab-btn" disabled>Vote</button>
          <button class="tab-btn" disabled>Reclaim Rewards</button>
          <button class="tab-btn" disabled>Reclaim Bribes</button>
        </div>
      </div>
    `;
  } else if (tab === "tienda") {
    c.innerHTML = `<div class="pf-box"><div class="h2">Tienda</div><p class="muted">SOON</p></div>`;
  }
}

/* =========================
   Sync principal (async)
========================= */

async function syncProfile() {
  const addr = getDid();

  const addrEl = profileModal.querySelector("#pfAddr");
  const lvlEl = profileModal.querySelector("#pfLevel");
  const titleEl = profileModal.querySelector("#pfTitle");
  const avatarBox = profileModal.querySelector("#pfAvatarBox");
  const avatarImg = profileModal.querySelector("#pfAvatar");

  addrEl.textContent = addr ? `${shortAddr(addr)} · alemty.eth` : "Conecta tu wallet (☰)";

  // Avatar NFT (si existe)
  const url = addr ? (localStorage.getItem(`level.nft.avatar.${addr.toLowerCase()}`) || "") : "";
  if (!url.trim()) {
    avatarBox.classList.add("empty");
    avatarImg.removeAttribute("src");
  } else {
    avatarBox.classList.remove("empty");
    avatarImg.src = url;
    avatarImg.onerror = () => {
      avatarBox.classList.add("empty");
      avatarImg.removeAttribute("src");
    };
  }

  // Stats reales (si hay sesión)
  __ME_STATS__ = addr ? await fetchMeStats() : null;

  // Dharma/Aura: derivado de points recibidos en backend [1](https://onedrive.live.com?cid=8C61CF68A019DADE&id=8C61CF68A019DADE!se04a61d341c348b1a2c3f47cc82f4913)[2](https://onedrive.live.com?cid=8C61CF68A019DADE&id=8C61CF68A019DADE!s7661d7b6025c4ae48cf1527b37a4260c)
  const dharma = __ME_STATS__?.tokenomics?.dharma ?? 0;
  const aura = __ME_STATS__?.tokenomics?.aura ?? 0;
  const pointsReceived = __ME_STATS__?.received?.pointsReceived ?? 0;

  // Karma placeholder (cuando lo implementes, lo usas para bloquear Dharma) [3](https://onedrive.live.com?cid=8C61CF68A019DADE&id=8C61CF68A019DADE!s8c541048b999400e8049b03d5d584285)
  const karmaValue = 0;

  // Nivel por Dharma (piso de rango) [1](https://onedrive.live.com?cid=8C61CF68A019DADE&id=8C61CF68A019DADE!se04a61d341c348b1a2c3f47cc82f4913)[2](https://onedrive.live.com?cid=8C61CF68A019DADE&id=8C61CF68A019DADE!s7661d7b6025c4ae48cf1527b37a4260c)
  const { current, next } = getLevelByDharma(dharma);
  lvlEl.textContent = addr ? `${current.name} (${dharma} Dharma)` : "Nivel —";
  titleEl.textContent = addr ? current.name : "—";

  // progreso barra Dharma
  const progressDen = Math.max(1, next.need - current.need);
  const progressNum = Math.min(progressDen, Math.max(0, dharma - current.need));
  const pct = next.need === current.need ? 100 : Math.round((progressNum / progressDen) * 100);

  profileModal.querySelector("#pfXpText").textContent = addr
    ? `${fmtInt(dharma)} Dharma · +${fmtInt(pointsReceived)} points recibidos`
    : "0";

  profileModal.querySelector("#pfXpBar").style.width = addr ? `${pct}%` : "0%";

  profileModal.querySelector("#pfKarmaText").textContent = String(karmaValue);
  profileModal.querySelector("#pfKarmaBar").style.width = karmaValue > 0 ? "30%" : "0%";

  // Wallet interna (tokens)
  profileModal.querySelector("#pfDharma").textContent = addr ? String(dharma) : "—";
  profileModal.querySelector("#pfAura").textContent = addr ? String(aura) : "—";
  profileModal.querySelector("#pfAlem").textContent = addr ? "0" : "—";
  profileModal.querySelector("#pfVeAlem").textContent = addr ? "0" : "—";

  const karmaValEl = profileModal.querySelector("#pfKarmaVal");
  const karmaToken = profileModal.querySelector("#pfKarmaToken");
  if (!addr) {
    karmaValEl.textContent = "—";
    karmaToken.classList.remove("negative");
  } else {
    karmaValEl.textContent = String(karmaValue);
    karmaToken.classList.toggle("negative", karmaValue < 0);
  }

  // Slots items (NO Aura aquí)
  // Puedes guardar equipamiento en localStorage:
  // localStorage.setItem(`alemty.equip.${addr}.assets`, "NFT X (Legendary)");
  const highest = getHighestNft(addr);
  profileModal.querySelector("#slotNivel").textContent = highest !== "—" ? highest : "—";
  profileModal.querySelector("#slotRol").textContent = getEquipped(addr, "role");
  profileModal.querySelector("#slotVeNFT").textContent = getEquipped(addr, "venft");
  profileModal.querySelector("#slotAssets").textContent = getEquipped(addr, "assets");
  profileModal.querySelector("#slotAgent").textContent = getEquipped(addr, "agent");
  profileModal.querySelector("#slotLands").textContent = getEquipped(addr, "lands");

  // Render tab activo
  const activeBtn = profileModal.querySelector("#pfTabs .tab-btn.active");
  const activeTab = activeBtn?.getAttribute("data-tab") || "estado";
  renderTab(activeTab);
}

/* =========================
   Listeners del modal
========================= */

profileModal.querySelector("#profileClose")?.addEventListener("click", () => closeModal("profileModal"));
profileModal.querySelector("#profileBackdrop")?.addEventListener("click", () => closeModal("profileModal"));

profileModal.querySelectorAll("#pfTabs .tab-btn").forEach((b) =>
  b.addEventListener("click", async () => {
    profileModal.querySelectorAll("#pfTabs .tab-btn").forEach((x) => x.classList.remove("active"));
    b.classList.add("active");
    await syncProfile();
  })
);

// Al abrir el perfil, refresca antes de mostrar
profileBtn.addEventListener("click", async () => {
  await syncProfile();
  openModal("profileModal");
});

window.addEventListener("did:changed", async () => {
  await syncProfile();
});

// Primer render
syncProfile();




function renderTab(t){
  const c=profileModal.querySelector("#pfContent");
  if(!c)return;
  if(t==="perfil")c.innerHTML=`<div class="pf-box"><div class="h2">Estado</div><p class="muted">Panel MMORPG. Conectaremos tokenomics.js después.</p></div>`;
  else if(t==="actividad")c.innerHTML=`<div class="pf-box"><div class="h2">Actividad</div><p class="muted">SOON</p></div>`;
  else if(t==="dm")c.innerHTML=`<div class="pf-box"><div class="h2">DM</div><p class="muted">SOON</p></div>`;
  else if(t==="dex")c.innerHTML=`<div class="pf-box"><div class="h2">DEX</div><div class="dex-grid"><button class="tab-btn" disabled>Swap</button><button class="tab-btn" disabled>LP Pools</button><button class="tab-btn" disabled>Staking</button><button class="tab-btn" disabled>Vote</button><button class="tab-btn" disabled>Reclaim Rewards</button><button class="tab-btn" disabled>Reclaim Bribes</button></div></div>`;
  else if(t==="tienda")c.innerHTML=`<div class="pf-box"><div class="h2">Tienda</div><p class="muted">SOON</p></div>`;
}

profileBtn.addEventListener("click",()=>{syncProfile();renderTab("perfil");openModal("profileModal");});
profileModal.querySelector("#profileClose")?.addEventListener("click",()=>closeModal("profileModal"));
profileModal.querySelector("#profileBackdrop")?.addEventListener("click",()=>closeModal("profileModal"));
profileModal.querySelectorAll("#pfTabs .tab-btn").forEach(b=>b.addEventListener("click",()=>{profileModal.querySelectorAll("#pfTabs .tab-btn").forEach(x=>x.classList.remove("active"));b.classList.add("active");renderTab(b.getAttribute("data-tab"));}));
window.addEventListener("did:changed",syncProfile);
syncProfile();

}

