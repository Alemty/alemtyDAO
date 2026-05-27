// shared/js/siwe.js
// Flujo SIWE: firmar con MetaMask, verificar contra backend, guardar JWT
import { getDid } from './wallet.js';
import { SIWE_API, verifyJWT } from './api.js';

export async function verifyAndRestoreSession() {
  const jwt = localStorage.getItem("alemty.jwt");
  const siweFlag = localStorage.getItem("alemty.siwe") === "ok";
  if (!jwt && !siweFlag) return; // nada que restaurar

  const addr = await verifyJWT();
  if (addr) {
    // JWT válido — restaurar flags si verifyJWT no lo hizo ya
    localStorage.setItem("alemty.siwe", "ok");
    if (!localStorage.getItem("alemty.did")) {
      localStorage.setItem("alemty.did", addr);
      localStorage.setItem("did", addr);
    }
    window.dispatchEvent(new CustomEvent("did:changed", { detail: { address: addr } }));
    window.dispatchEvent(new CustomEvent("siwe:changed", { detail: { ok: true } }));
  } else {
    // JWT inválido — verifyJWT ya limpió localStorage
    window.dispatchEvent(new CustomEvent("siwe:changed", { detail: { ok: false } }));
  }
}

export async function siweLogin() {
  console.log("🔐 SIWE: iniciando");

  const address = getDid();
  if (!address) {
    alert("Conecta tu wallet primero");
    return;
  }

  try {
    // 1) Nonce
    const nonceRes = await fetch(`${SIWE_API}/nonce`, { cache: "no-store" });
    if (!nonceRes.ok) {
      alert("❌ Error obteniendo nonce");
      return;
    }
    const nonceJson = await nonceRes.json().catch(() => ({}));
    const nonce = nonceJson?.nonce;
    if (!nonce) throw new Error("Nonce inválido");

    // 2) Mensaje SIWE
    const message = [
      `${location.hostname} wants you to sign in with your Ethereum account:`,
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

    // 3) Firma
    if (!window.ethereum?.request) {
      alert("❌ No se detectó MetaMask");
      return;
    }
    const signature = await window.ethereum.request({
      method: "personal_sign",
      params: [message, address]
    });

    // 4) Verify
    const verifyRes = await fetch(`${SIWE_API}/verify`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ message, signature })
    });

    if (!verifyRes.ok) {
      localStorage.removeItem("alemty.siwe");
      localStorage.removeItem("alemty.jwt");
      alert("❌ SIWE rechazado por backend");
      return;
    }

    const result = await verifyRes.json().catch(() => ({}));

    if (result?.ok === true) {
      localStorage.setItem("alemty.siwe", "ok");
      const verifiedAddr = (result.address || address || "").toLowerCase();
      if (verifiedAddr) {
        localStorage.setItem("alemty.did", verifiedAddr);
        localStorage.setItem("did", verifiedAddr);
      }

      const token = result.token || result.jwt || result.session || null;
      if (token) {
        localStorage.setItem("alemty.jwt", token);
      } else {
        localStorage.removeItem("alemty.jwt");
        console.warn("⚠️ SIWE ok pero sin token");
      }

      // Dispara eventos
      window.dispatchEvent(new CustomEvent("did:changed", { detail: { address: verifiedAddr } }));
      window.dispatchEvent(new CustomEvent("siwe:changed", { detail: { ok: true } }));

      alert("✅ SIWE verificado correctamente");
    } else {
      localStorage.removeItem("alemty.siwe");
      localStorage.removeItem("alemty.jwt");
      alert("❌ SIWE rechazado por backend");
    }
  } catch (err) {
    console.error("💥 SIWE ERROR:", err);
    alert("❌ Error durante SIWE");
    localStorage.removeItem("alemty.siwe");
    localStorage.removeItem("alemty.jwt");
  }
}

export function clearSiwe() {
  localStorage.removeItem("alemty.siwe");
  localStorage.removeItem("alemty.jwt");
  window.dispatchEvent(new CustomEvent("siwe:changed", { detail: { ok: false } }));
}
