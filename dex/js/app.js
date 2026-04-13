
import { mountShell } from '/shared/js/shell.js';
mountShell();

/* Modal helpers */
function openModal(){
  const m = document.getElementById('dexModal');
  m.classList.add('open');
  m.setAttribute('aria-hidden','false');
}
function closeModal(){
  const m = document.getElementById('dexModal');
  m.classList.remove('open');
  m.setAttribute('aria-hidden','true');
}

document.addEventListener('click', (e)=>{
  if(e.target.closest('[data-close]')) closeModal();
});

/* Contenido por tab */
const MODEL = {
  swap: {
    title: 'Swap',
    desc: 'Intercambia tokens. Ejemplo: AURA ↔ ALEM.',
    kpis: [
      { k: 'Ruta', v: 'AURA → ALEM' },
      { k: 'Estado', v: 'SOON' },
      { k: 'Slip', v: '—' }
    ],
    modal: `
      <div class="sheet-item">
        <div class="t">Swap</div>
        <div class="m">Intercambio simple. Aquí irá UI de swap real.</div>
      </div>
      <p class="small muted">Tip: este módulo se conectará al contrato del DEX en fase posterior.</p>
    `
  },

  pools: {
    title: 'Pools',
    desc: 'Lista de pools y estado de liquidez. (El bloque inferior se integra aquí).',
    kpis: [
      { k: 'Pools', v: '3' },
      { k: 'TVL', v: '—' },
      { k: 'Volumen', v: '—' }
    ],
    modal: `
      <div class="sheet-item">
        <div class="t">AURA / ALEM</div>
        <div class="m">Pool interno principal (conversión y salida).</div>
      </div>
      <div class="sheet-item">
        <div class="t">ALEM / USDC</div>
        <div class="m">Pool de salida a estable (SOON).</div>
      </div>
      <div class="sheet-item">
        <div class="t">AURA / ETH</div>
        <div class="m">Pool exploratorio (SOON).</div>
      </div>
      <p class="small muted">Aquí se integran los pools que antes estaban “abajo”.</p>
    `
  },

  liquidity: {
    title: 'Liquidity',
    desc: 'Provee liquidez y gana fees del volumen.',
    kpis: [
      { k: 'Posiciones', v: '—' },
      { k: 'APR', v: '—' },
      { k: 'Fees', v: '—' }
    ],
    modal: `
      <div class="sheet-item">
        <div class="t">Proveer Liquidez</div>
        <div class="m">Crear o administrar posiciones LP (SOON).</div>
      </div>
    `
  },

  stake: {
    title: 'Stake',
    desc: 'Bloquea tokens para incentivos y gobernanza (cuando aplique).',
    kpis: [
      { k: 'Staked', v: '—' },
      { k: 'Rewards', v: '—' },
      { k: 'Lock', v: '—' }
    ],
    modal: `
      <div class="sheet-item">
        <div class="t">Stake</div>
        <div class="m">Bloqueo y recompensas (SOON).</div>
      </div>
    `
  },

  bridge: {
    title: 'Bridge',
    desc: 'Mover activos entre redes (futuro).',
    kpis: [
      { k: 'Red', v: 'Base' },
      { k: 'Origen', v: '—' },
      { k: 'Destino', v: '—' }
    ],
    modal: `
      <div class="sheet-item">
        <div class="t">Bridge</div>
        <div class="m">Enlace entre redes (SOON).</div>
      </div>
    `
  },

  analytics: {
    title: 'Analytics',
    desc: 'Métricas del DEX: TVL, volumen, fees y salud.',
    kpis: [
      { k: 'TVL', v: '—' },
      { k: 'Volumen 24h', v: '—' },
      { k: 'Fees 24h', v: '—' }
    ],
    modal: `
      <div class="sheet-item">
        <div class="t">Analytics</div>
        <div class="m">Dashboard de métricas (SOON).</div>
      </div>
    `
  }
};

let activeTab = 'swap';

function setActiveTab(key){
  if(!MODEL[key]) return;
  activeTab = key;

  // UI tabs
  document.querySelectorAll('.dex-tab').forEach(b=>{
    const is = b.getAttribute('data-tab') === key;
    b.classList.toggle('active', is);
    b.setAttribute('aria-selected', is ? 'true' : 'false');
  });

  // Panel text
  document.getElementById('panelTitle').textContent = MODEL[key].title;
  document.getElementById('panelDesc').textContent  = MODEL[key].desc;

  // KPIs
  const wrap = document.getElementById('panelSummary');
  wrap.innerHTML = MODEL[key].kpis.map(x=>`
    <div class="dex-kpi">
      <div class="k">${x.k}</div>
      <div class="v">${x.v}</div>
    </div>
  `).join('');
}

function openActiveModal(){
  const m = MODEL[activeTab];
  document.getElementById('dexModalTitle').textContent = m.title;
  document.getElementById('dexModalBody').innerHTML = m.modal;
  openModal();
}

/* events */
document.querySelectorAll('.dex-tab').forEach(b=>{
  b.addEventListener('click', ()=> setActiveTab(b.getAttribute('data-tab')));
});

document.getElementById('openAction')?.addEventListener('click', openActiveModal);

/* init */
setActiveTab('swap');
