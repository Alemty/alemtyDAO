# CHANGELOG

## v0.7 — AURA On-Chain Integration (Estable)
- **Balance on-chain real en perfil**: AURA ahora muestra el balance real del contrato ERC-20 consultado via RPC con 3 fallbacks y caché en D1.
- **Parseo correcto de 18 decimales**: `BigInt(result) / 10n ** 16n / 100n` = división por 10^18.
- **Wallet distribuidora corregida**: agentAddr actualizado de hardcodeado legacy (0x0275...) a la wallet documentada (0x8ed91b...).
- **POST /api/aura/mint**: nuevo endpoint que prepara tx mint() desde wallet minter (0x6A202f...) hacia wallet distribuidora, para firmar con MetaMask.
- **GET /api/aura/distributor-balance**: endpoint público que consulta balance de AURA y ETH de la wallet distribuidora.
- **Nuevos Bindings MINTER_ADDRESS y DISTRIBUTOR_ADDRESS** en wrangler.toml y tipos.
- **Perfil clarificado**: token AURA ahora dice "AURA on-chain" con tooltip. DEX tab muestra flujo on-chain/off-chain.
- **AbortController manual**: reemplazado AbortSignal.timeout() (no soportado en Workers) por AbortController + setTimeout.
- **RPCs con 3 fallbacks**: primero AURA_RPC_URL configurado, luego 1rpc.io/base, luego base-rpc.publicnode.com. Timeout 5s cada uno.
- **Caché persistente en D1**: si RPC falla, usa último balance guardado en user_stats.aura_balance.
- **Seguridad**: .env, .env.* y .dev.vars añadidos a .gitignore.
- **Documentación**: RELEASE_v0.7.md con arquitectura completa, endpoints, flujo de reclamo y configuración.

## v0.6 — AURA Claim vía MetaMask + Tab DEX
- **POST /api/aura/claim**: endpoint que prepara tx `mint()` on-chain para firmar con MetaMask.
  - Valida hard cap on-chain (totalSupply vs hardCap via eth_call).
  - Obtiene nonce, estima gas, calcula gas price desde RPC Base.
  - Devuelve tx lista para `eth_sendTransaction` desde el frontend.
- **POST /api/aura/mint**: deprecated, redirige a /api/aura/claim.
- **Tab DEX en modal de perfil**: muestra rewards acumulados (AURA, $ALEM, bribes, fees LP).
- **Botón "Reclaim Rewards (todo)"**: prepara tx vía backend, cambia a Base Mainnet en MetaMask, firma y espera confirmación.
- Refactor de `aura` en `/api/me/stats`: ahora igual a `dharma` (generado off-chain). `auraBalance` y `auraReclamable` como campos separados.
- `AURA_PRIVATE_KEY` eliminada de wrangler.toml (el claim lo firma el usuario con MetaMask).

## v0.5 — AURA Token desplegado en Base Mainnet
- Contrato AuraToken.sol (ERC20, Tokenomics Rulebook §5) desplegado en Base Mainnet.
- **Address verificada:** `0x74f685da4d39e53e7df6e0970b84224ea0d00634`
- Verificación exitosa en Basescan (Solc 0.8.20, Eve Version London, Optimization Yes 200 runs).
- Fix de bytecode mismatch por PUSH0 (EVM version Osaka vs London).
- GET /api/me/stats añade balanceOf on-chain via eth_call RPC.
- POST /api/aura/mint con validación de hard cap on-chain.
- wrangler.toml actualizado: AURA_CONTRACT apunta a la address verificada.
- Agentes IA: 6 agentes con 4 stats + 3 contadores cada uno (Pool Balancer, DEFI Oracle, OVR Assistant, Governance Bot, Foro Admin, AutoBot).
- Modal SPA con colchón fijo de 110px para bottomnav + disclaimer.
- Métricas IA corregidas: "Total NFTs" (684) con desglose en subtitle.
- Contadores scoped a #pageIA en CSS.
- OVR expandido de 24 a 198 tierras.
- Todas las cards sin descripciones de tareas.
- Light theme replicado de DEFI con valores exactos.

## v0.4 — Backend integrado (SIWE + API + D1)
- SIWE Worker: nonce KV + verify + emisión JWT.
- API Worker: Hono + D1 con posts, comments, reactions, rankings, stats y perfil (`/api/me/stats`).
- Integración de tokenomics inicial (Dharma/Aura derivada de puntos recibidos) a través de `/api/me/stats`.

## v0.03 — Frontend modular (legacy)
- Shell compartido, navegación modular, publicación a IPFS.
