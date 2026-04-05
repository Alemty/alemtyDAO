
import { mountShell } from '../../shared/js/shell.js'
import { $ } from '../../shared/js/core.js'

mountShell()

$('#copyBtn')?.addEventListener('click',async()=>{
const el=$('#pubkey')
const text=el?.textContent?.trim()
if(!text)return
try{
await navigator.clipboard.writeText(el.dataset.full||text)
const ok=$('#copyOk')
if(ok){ok.style.display='inline';setTimeout(()=>ok.style.display='none',1100)}
}catch{}
})



const LINKS=[
 {platform:'TikTok',desc:'Escuela de Conocimiento Oculto (T2)',url:'https://www.tiktok.com/@alemtyv',icon:'assets/icons/tiktok.svg'},
 {platform:'TikTok',desc:'Tecnologías del Futuro (IA, Web3, Metaverso)',url:'https://www.tiktok.com/@alemty.eth',icon:'assets/icons/tiktok.svg'},
 {platform:'YouTube',desc:'Escuela de Conocimiento Oculto',url:'https://www.youtube.com/@AlemtyV',icon:'assets/icons/youtube.svg'},
 {platform:'LinkedIn',desc:'Mi Carrera Profesional',url:'https://www.linkedin.com/in/alemty/',icon:'assets/icons/linkedin.svg'},
 {platform:'X',desc:'Mi Perfil en Twitter',url:'https://x.com/alemty_eth',icon:'assets/icons/x.svg'},
 {platform:'Instagram',desc:'Mi Perfil de Instagram',url:'https://www.instagram.com/alemty01/',icon:'assets/icons/instagram.svg'},
 {platform:'Facebook',desc:'Alejandro Gutierrez Zavala',url:'https://web.facebook.com/Alemty11/',icon:'assets/icons/facebook.svg'},
 {platform:'Telegram',desc:'Grupo alemtyv',url:'https://t.me/+A91KGSxgvr5hYThhotra',icon:'assets/icons/telegram.svg'},
 {platform:'OpenSea',desc:'Galería de NFTs',url:'https://opensea.io/es/0x6a202f991c4c1df079449be9847b1dac3f51854f',icon:'assets/icons/opensea.svg'},
 {platform:'Decentraland',desc:'Mi Avatar del Metaverso',url:'https://decentraland.org/profile/accounts/0x6a202f991c4c1df079449be9847b1dac3f51854f',icon:'assets/icons/decentraland.svg'},
 {platform:'GitHub',desc:'Repositorio del proyecto',url:'https://github.com/Alemty/alemty.eth-DAO',icon:'assets/icons/github.svg'},
 {platform:'Discord',desc:'Servidor oficial (SOON)',url:'https://discord.com',icon:'assets/icons/discord.svg'}
];




const cards=document.getElementById('cards');
if(cards){
  cards.innerHTML=LINKS.map(l=>`
    <a href="${l.url}" target="_blank" rel="noopener noreferrer" class="social-card">
      <div class="icon-pane" aria-hidden="true">
        <img class="ico" src="${l.icon}" alt="" loading="lazy">
      </div>
      <div class="text-pane">
        <div class="platform">${l.platform}</div>
        <div class="desc small muted">${l.desc}</div>
      </div>
    </a>
  `).join('');

}


const bookFrame=document.querySelector('#pageIdentity .book-frame');
['downloadBook','buyBtn'].forEach(id=>{
  const btn=document.getElementById(id);
  if(!btn||!bookFrame)return;
  btn.addEventListener('mouseenter',()=>bookFrame.classList.add('engaged'));
  btn.addEventListener('mouseleave',()=>bookFrame.classList.remove('engaged'));
  btn.addEventListener('focus',()=>bookFrame.classList.add('engaged'));
  btn.addEventListener('blur',()=>bookFrame.classList.remove('engaged'));
});

