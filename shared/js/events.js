// shared/js/events.js
export function emit(name, detail={}){
  window.dispatchEvent(new CustomEvent(name, { detail }));
}
export function on(name, handler){
  window.addEventListener(name, handler);
  return () => window.removeEventListener(name, handler);
}
