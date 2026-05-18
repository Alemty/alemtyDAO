
import { mountShell, mountCreds } from '../../shared/js/shell.js'
import { $ } from '../../shared/js/core.js'

mountShell()

// ---------- Copy pubkey ----------
$('#copyBtn')?.addEventListener('click', async () => {
  const el = $('#pubkey')
  const text = el?.dataset?.full || el?.textContent?.trim()
  if (!text) return
  try {
    await navigator.clipboard.writeText(text)
    const ok = $('#copyOk')
    if (ok) {
      ok.hidden = false
      ok.style.display = 'inline'
      setTimeout(() => {
        ok.hidden = true
        ok.style.display = 'none'
      }, 1100)
    }
  } catch {}
})

// ================================
// ✅ Credenciales Modal (ID)
// ================================
const credsBtn = $('#credsBtn')
const credsModal = document.getElementById('credsModal')
const credsBackdrop = document.getElementById('credsBackdrop')
const credsClose = document.getElementById('credsClose')

let credsLoaded = false

function openCreds () {
  if (!credsModal) return
  credsModal.classList.add('open')
  credsModal.setAttribute('aria-hidden', 'false')

  // ✅ monta carruseles 1 sola vez
  if (!credsLoaded) {
    // Montamos dentro del modal (scope = modal)
    mountCreds(credsModal)
    credsLoaded = true
  }
}

function closeCreds () {
  if (!credsModal) return
  credsModal.classList.remove('open')
  credsModal.setAttribute('aria-hidden', 'true')
}

credsBtn?.addEventListener('click', openCreds)
credsBackdrop?.addEventListener('click', closeCreds)
credsClose?.addEventListener('click', closeCreds)

document.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape') return
  if (credsModal?.classList.contains('open')) closeCreds()
})


// ---------- Social links ----------
const LINKS = [
  {platform:'Discord',desc:'Servidor oficial alemtyDAO',url:'https://discord.gg/72zNGfMp',icon:'assets/icons/discord.svg'},
  {platform:'GitHub',desc:'Repositorio del proyecto',url:'https://github.com/Alemty/alemtyDAO',icon:'assets/icons/github.svg'},
  {platform:'TikTok',desc:'Escuela de Conocimiento Oculto (T2)',url:'https://www.tiktok.com/@alemtyv',icon:'assets/icons/tiktok.svg'},
  {platform:'TikTok',desc:'Tecnologías del Futuro (IA, Web3, Metaverso)',url:'https://www.tiktok.com/@alemty.eth',icon:'assets/icons/tiktok.svg'},
  {platform:'YouTube',desc:'Escuela de Conocimiento Oculto',url:'https://www.youtube.com/@AlemtyV',icon:'assets/icons/youtube.svg'},
  {platform:'LinkedIn',desc:'Mi Carrera Profesional',url:'https://www.linkedin.com/in/alemty/',icon:'assets/icons/linkedin.svg'},
  {platform:'X',desc:'Mi Perfil en Twitter',url:'https://x.com/alemty_eth',icon:'assets/icons/x.svg'},
  {platform:'Instagram',desc:'Mi Perfil de Instagram',url:'https://www.instagram.com/alemty01/',icon:'assets/icons/instagram.svg'},
  {platform:'Facebook',desc:'Alejandro Gutierrez Zavala',url:'https://web.facebook.com/Alemty11/',icon:'assets/icons/facebook.svg'},
  {platform:'Telegram',desc:'Grupo alemtyv',url:'https://t.me/+A91KGSxgvr5hYThhotra',icon:'assets/icons/telegram.svg'},
  {platform:'OpenSea',desc:'Galería de NFTs',url:'https://opensea.io/es/0x6a202f991c4c1df079449be9847b1dac3f51854f',icon:'assets/icons/opensea.svg'},
  {platform:'Decentraland',desc:'Mi Avatar del Metaverso',url:'https://decentraland.org/profile/accounts/0x6a202f991c4c1df079449be9847b1dac3f51854f',icon:'assets/icons/decentraland.svg'}
]

const cards = document.getElementById('cards')
if (cards) {
  cards.classList.add('cards-grid')
  cards.innerHTML = LINKS.map(l => {
    const href = String(l.url || '#')
    const icon = String(l.icon || '')
    const platform = String(l.platform || '')
    const desc = String(l.desc || '')
    return `
      <a class="social-card" href="${href}" target="_blank" rel="noopener noreferrer" aria-label="${platform}">
        <span class="icon-pane">
          <img class="ico" src="/${icon.replace(/^\/+/, '')}" alt="" loading="lazy">
        </span>
        <span class="text-pane">
          <span class="platform">${platform}</span>
          <span class="desc">${desc}</span>
        </span>
      </a>
    `
  }).join('')
}

// ---------- Book frame engaged hover ----------
const bookFrame = document.querySelector('#pageIdentity .book-frame')
;['downloadBook','buyBtn'].forEach(id => {
  const btn = document.getElementById(id)
  if (!btn || !bookFrame) return
  btn.addEventListener('mouseenter', () => bookFrame.classList.add('engaged'))
  btn.addEventListener('mouseleave', () => bookFrame.classList.remove('engaged'))
  btn.addEventListener('focus', () => bookFrame.classList.add('engaged'))
  btn.addEventListener('blur', () => bookFrame.classList.remove('engaged'))
})
