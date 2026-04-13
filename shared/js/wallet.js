// shared/js/wallet.js
import { hasEthereum, requestAccounts, shortAddr } from './core.js';
import { emit } from './events.js';

const KEY = 'did.address';

export function getDid(){
  return localStorage.getItem(KEY);
}

export function isConnected(){
  return !!getDid();
}

export function clearDid(){
  localStorage.removeItem(KEY);
  emit('did:changed', { address: null });
}

export async function connectDid(){
  if(!hasEthereum()) throw new Error('MetaMask not found');
  const addr = await requestAccounts();
  if(addr){
    localStorage.setItem(KEY, addr);
    emit('did:changed', { address: addr });
  }
  return addr;
}

export function bindEthereumAccountsChanged(){
  if(!hasEthereum()) return;
  window.ethereum.on?.('accountsChanged', (acc) => {
    const addr = acc?.[0] || null;
    if(!addr){
      clearDid();
      return;
    }
    localStorage.setItem(KEY, addr);
    emit('did:changed', { address: addr });
  });
}

export function formatDidStatus(){
  const addr = getDid();
  return addr ? `Conectado: ${shortAddr(addr)}` : 'No conectado';
}
