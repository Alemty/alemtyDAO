
import { mountShell } from '/shared/js/shell.js';
mountShell();

function openModal(id){
  const m = document.getElementById(id);
  if(!m) return;
  m.classList.add('open');
  m.setAttribute('aria-hidden','false');
}

function closeModal(id){
  const m = document.getElementById(id);
  if(!m) return;
  m.classList.remove('open');
  m.setAttribute('aria-hidden','true');
}

const CONTENT = {
  aura: {
    title: 'AURA',
    body: `
      <p class="muted">
        Token interno de utilidad y señal social.
      </p>
      <ul class="small">
        <li>No transferible</li>
        <li>Se genera por participación y mérito</li>
        <li>Se consume dentro del ecosistema</li>
      </ul>
    `
  },
  alem: {
    title: 'ALEM',
    body: `
      <p class="muted">
        Token económico central del ecosistema alemty.
      </p>
      <ul class="small">
        <li>Transferible</li>
        <li>Usado en DEX, staking y coordinación</li>
        <li>El poder político se obtiene vía bloqueo (veALEM)</li>
      </ul>
    `
  },
  pools: {
    title: 'Pools',
    body: `
      <p class="muted">
        Conversión programática entre AURA y ALEM.
      </p>
      <p class="small">
        Opera por epochs y reglas controladas.
      </p>
    `
  },
  governance: {
    title: 'Gobernanza',
    body: `
      <p class="muted">
        Control colectivo de emisión y políticas económicas.
      </p>
      <ul class="small">
        <li>Ritmo de emisión</li>
        <li>Desbloqueos progresivos</li>
        <li>Gestión de tesorería</li>
      </ul>
    `
  },
  distribution: {
    title: 'Distribución y política de emisión',
    body: `
      <p class="muted">
        <strong>Supply máximo teórico:</strong> 1,000,000,000 ALEM.
      </p>
      <ul class="small">
        <li>No existe ICO ni preventa</li>
        <li>No hay emisión infinita</li>
        <li>La emisión es gradual, programática y condicionada</li>
        <li>Los desbloqueos son progresivos</li>
        <li>El ritmo puede ajustarse por gobernanza</li>
      </ul>
      <p class="small muted">
        La distribución establece límites máximos, no asignaciones inmediatas.
      </p>
    `
  }
};

document.addEventListener('click', (e)=>{
  const open = e.target.closest('[data-open]');
  if(open){
    const key = open.getAttribute('data-open');

    if(key === 'distribution'){
      document.getElementById('distributionModalTitle').textContent =
        CONTENT.distribution.title;
      document.getElementById('distributionModalBody').innerHTML =
        CONTENT.distribution.body;
      openModal('distributionModal');
      return;
    }

    const c = CONTENT[key];
    if(!c) return;

    document.getElementById('tokenModalTitle').textContent = c.title;
    document.getElementById('tokenModalBody').innerHTML = c.body;
    openModal('tokenModal');
  }

  const close = e.target.closest('[data-close]');
  if(close){
    closeModal(close.getAttribute('data-close'));
  }
});

document.addEventListener('keydown', e=>{
  if(e.key === 'Escape'){
    document.querySelectorAll('.modal.open').forEach(m=>closeModal(m.id));
  }
});

