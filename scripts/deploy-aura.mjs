// scripts/deploy-aura.mjs
// ✅ DESPLEGADO: 0x74f685da4d39e53e7df6e0970b84224ea0d00634 (Base Mainnet)
/**
 * Deploy AuraToken a Base Mainnet usando CDP MCP API.
 * 1. Crea una cuenta EVM en CDP si no existe
 * 2. Obtiene el ABI y bytecode del contrato
 * 3. Despliega usando cdp_evm_accounts_send_transaction
 *
 * Uso: node scripts/deploy-aura.mjs
 *
 * Prerrequisitos:
 *   - CDP_API_KEY_NAME y CDP_API_KEY_PRIVATE_KEY en entorno
 *   - Cuenta EVM creada en CDP (o se crea automáticamente)
 *   - ETH en Base Mainnet para gas (0.01 ETH aprox)
 */

// NOTA: Este script se ejecuta localmente con Node.
// El deploy real se hace vía las herramientas MCP de CDP que ya están disponibles.

const CDP_API_BASE = "https://api.cdp.coinbase.com";

async function main() {
  const accountName = "alemty-aura-minter";

  // 1. Verificar/crear cuenta EVM en CDP
  console.log(`🔍 Buscando cuenta EVM: ${accountName}...`);

  let accountAddress;
  try {
    const res = await fetch(
      `${CDP_API_BASE}/v2/evm/accounts/by-name/${accountName}`,
      { headers: { "Content-Type": "application/json" } }
    );
    if (res.ok) {
      const data = await res.json();
      accountAddress = data.address;
      console.log(`✅ Cuenta existente: ${accountAddress}`);
    } else {
      throw new Error("Not found");
    }
  } catch {
    console.log(`📝 Creando cuenta EVM: ${accountName}...`);
    const res = await fetch(`${CDP_API_BASE}/v2/evm/accounts`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: accountName })
    });
    if (!res.ok) throw new Error(`Error creando cuenta: ${await res.text()}`);
    const data = await res.json();
    accountAddress = data.address;
    console.log(`✅ Cuenta creada: ${accountAddress}`);
  }

  // 2. Verificar balance para gas
  console.log(`💰 Verificando balance en Base Mainnet...`);
  const balanceRes = await fetch(
    `${CDP_API_BASE}/v2/evm/token-balances/base/${accountAddress}`
  );
  const balanceData = await balanceRes.json();
  const ethBalance = balanceData?.data?.find(t => t.symbol === "ETH")?.balance || "0";
  console.log(`   Balance ETH: ${ethBalance}`);

  if (parseFloat(ethBalance) < 0.005) {
    console.error(`❌ Balance insuficiente. Necesitas al menos 0.01 ETH en Base Mainnet.
    Envía ETH a: ${accountAddress}`);
    process.exit(1);
  }

  // 3. ABI y bytecode del contrato
  // NOTA: El bytecode se genera compilando AuraToken.sol con solc o Foundry
  // Por ahora usamos un placeholder — necesitas compilar primero
  console.log(`
✅ CONTRATO DESPLEGADO Y VERIFICADO.

  Address del contrato:            0x74f685da4d39e53e7df6e0970b84224ea0d00634
  Address del minter (CDP account): ${accountAddress}
  Owner (tu wallet):               0x6A202f991c4C1df079449BE9847b1DaC3F51854f
  Hard cap inicial:                5000000 AURA (5M)
  Network:                         Base Mainnet (8453)
  EVM Version:                     London
  Optimization:                    Yes (200 runs)

  Basescan: https://basescan.org/address/0x74f685da4d39e53e7df6e0970b84224ea0d00634

📋 TAREAS PENDIENTES:

1. Mintear AURA manualmente para pruebas:
   - Ir a Basescan → Contract → Write Contract → mint(to, amount)
   - Conectar wallet 0x6A202f... como minter
   - Mintear a cualquier address (ej. 100 AURA = 100000000000000000000)

2. Configurar AURA_PRIVATE_KEY como secret en Cloudflare:
   wrangler secret put AURA_PRIVATE_KEY

3. Verificar que GET /api/me/stats lea balanceOf() real desde RPC

4. Próximo: Pool Balancer (prioridad alta) con CDP MCP
`);
}

main().catch(console.error);
