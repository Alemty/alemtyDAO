// Aura/ALEM internal AMM — Pool interno con ratio 1:100
// 1 ALEM = 100 AURA
// Fórmula: swap_in (AURA→ALEM): output = input / 100
//          swap_out (ALEM→AURA): output = input * 100

const API_BASE = window.location.origin;

export async function initInternalAmm() {
  console.log("[DEX] Inicializando AMM interno Aura/ALEM (1:100)");

  const swapBtn = document.getElementById("btnSwap");
  const swapStatus = document.getElementById("swapStatus");
  const amountIn = document.getElementById("swapAmount");
  const outEl = document.getElementById("swapOut");
  const fromSel = document.getElementById("swapFrom");
  const toSel = document.getElementById("swapTo");
  const rateEl = document.getElementById("swapRate");

  if (!swapBtn) return;

  // Mostrar rate actual
  if (rateEl) {
    rateEl.textContent = "1 ALEM = 100 AURA • Fee: 0.2%";
  }

  // Actualizar quote en tiempo real
  const updateQuote = () => {
    const amt = Number(String(amountIn?.value || "0").replace(",", "."));
    if (!Number.isFinite(amt) || amt <= 0) {
      if (outEl) outEl.value = "—";
      return;
    }
    const fromVal = fromSel?.value || "AURA";
    const toVal = toSel?.value || "ALEM";

    if (fromVal === "AURA" && toVal === "ALEM") {
      const out = amt / 100;
      outEl.value = out.toFixed(8);
    } else if (fromVal === "ALEM" && toVal === "AURA") {
      const out = amt * 100;
      outEl.value = out.toFixed(8);
    }
  };

  amountIn?.addEventListener("input", updateQuote);
  fromSel?.addEventListener("change", () => {
    if (toSel) {
      toSel.value = fromSel.value === "AURA" ? "ALEM" : "AURA";
    }
    updateQuote();
  });

  // Swap button
  swapBtn.addEventListener("click", async () => {
    const amt = Number(String(amountIn?.value || "0").replace(",", ""));
    if (!Number.isFinite(amt) || amt <= 0) {
      if (swapStatus) swapStatus.textContent = "❌ Ingresa una cantidad válida";
      return;
    }

    const fromVal = fromSel?.value || "AURA";
    const kind = fromVal === "AURA" ? "swap_in" : "swap_out";
    const amountWei = BigInt(Math.floor(amt * (fromVal === "AURA" ? 1 : 1) * 1e18)).toString();

    if (swapStatus) swapStatus.textContent = "⏳ Preparando swap...";
    swapBtn.disabled = true;

    try {
      const res = await fetch(API_BASE + "/api/alem/swap", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": "Bearer " + (window.__JWT__ || "") },
        body: JSON.stringify({ kind, amountWei })
      });
      const data = await res.json();

      if (!data.ok) {
        if (swapStatus) swapStatus.textContent = "❌ " + (data.error || "Error");
        swapBtn.disabled = false;
        return;
      }

      // Mostrar resumen del swap
      const outputReadable = (Number(data.outputAmount) / 1e18).toFixed(6);
      if (swapStatus) {
        swapStatus.innerHTML = `
          ✅ Swap preparado: ${amt} ${fromVal} → ${outputReadable} ${data.to}<br>
          <small style="color:#999;">Rate: ${data.rate} AURA = 1 ALEM</small><br>
          <small style="color:#ffa500;">⚠️ Debes firmar la tx en MetaMask</small>
        `;
      }

      // Preparar y enviar tx a MetaMask
      if (window.ethereum) {
        try {
          const txParams = {
            from: data.fromAddress,
            to: kind === "swap_in" ? data.auraContract : data.alemContract,
            data: kind === "swap_in" ? data.auraCalldata : data.alemCalldata,
            value: "0x0"
          };

          const txHash = await window.ethereum.request({
            method: "eth_sendTransaction",
            params: [txParams]
          });

          if (swapStatus) swapStatus.innerHTML = `✅ Swap enviado! Tx: <a href="https://basescan.org/tx/${txHash}" target="_blank" rel="noopener">${txHash.slice(0,14)}... ↗</a>`;
        } catch (metaErr) {
          if (swapStatus) swapStatus.textContent = "❌ MetaMask: " + (metaErr.message || "Rechazado");
        }
      } else {
        if (swapStatus) swapStatus.innerHTML += '<br><small>Instala MetaMask para firmar la tx.</small>';
      }
    } catch (e) {
      if (swapStatus) swapStatus.textContent = "❌ Error: " + (e.message || "Desconocido");
    }

    swapBtn.disabled = false;
  });
}
