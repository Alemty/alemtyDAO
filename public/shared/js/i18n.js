// shared/js/i18n.js
// Sistema de internacionalización ES ↔ EN con persistencia y banderas

const LS_KEY = 'alemty.lang';
const FALLBACK = 'es';

// ===== DICCIONARIO =====
const DICT = {
  es: {
    // Shell / topbar / drawer
    'topbar.theme': 'Tema',
    'topbar.lang': 'Idioma',
    'topbar.profile': 'Perfil',
    'topbar.notifications': 'Notificaciones',
    'topbar.menu': 'Menú',

    'drawer.title': 'Menú',
    'drawer.close': 'Cerrar',
    'drawer.identity': 'Identidad DID',
    'drawer.status': 'Estado',
    'drawer.connected': 'Conectado',
    'drawer.disconnected': 'Desconectado',
    'drawer.didSiwe': 'DID – SIWE',
    'drawer.login': '🦊 Iniciar Sesión',
    'drawer.register': '🦊 Registrarse',
    'drawer.signSiwe': '✅ Firma SIWE',
    'drawer.logout': '⛔ Cerrar Sesión',
    'drawer.tutorial': 'Tutorial de registro en MetaMask',
    'drawer.services': 'Servicios',
    'drawer.servicesDesc': 'Consultora Web3 descentralizada — 6 agentes inteligentes al servicio del ecosistema.',
    'drawer.servicesViewAll': '📋 Ver todos los servicios',
    'drawer.about': 'Acerca de',
    'drawer.aboutDesc1': 'Proyecto Web3 experimental. La DAO no es entidad legal; los tokens no son valores ni equity. Participación bajo propio riesgo.',
    'drawer.aboutDesc2': 'Derechos de autor / IP: salvo acuerdo explícito por escrito, la propiedad intelectual del proyecto pertenece al fundador.',
    'drawer.aboutDocs': '📚 Documentación oficial',

    // Web3 disclaimer
    'disclaimer': '© alemty.eth · ENS · IPFS · Identidad Digital Descentralizada',

    // Services modal
    'services.title': 'Servicios de la DAO',
    'services.close': 'Cerrar',
    'services.header': 'Consultora Web3 descentralizada · alemty.eth · Productos y servicios del ecosistema',
    'services.catDigital': '📦 Renta y venta de activos digitales',
    'services.tierras': 'Tierras OVR',
    'services.tierrasSub': '· 198 parcelas en Polygon',
    'services.tierrasDesc': 'Renta o adquiere parcelas del metaverso Over the Reality. Las tierras incluyen escenas AR interactivas, coordenadas geográficas reales y posibilidad de activar quests para visitantes. Ideal para marcas, artistas y eventos. Stock: 198 tierras · 24 con escenas AR activas.',
    'services.nfts': 'NFTs coleccionables',
    'services.nftsSub': '· 684 assets en 146 colecciones',
    'services.nftsDesc': 'Portfolio diversificado de NFTs en Polygon: wearables de Decentraland (DCLMF, MVMF22, Pride), HAPE Apparel, AKCB, Another-1 x Templa, Rad TV, y más. Venta directa o trading entre colecciones del ecosistema.',
    'services.iaParcel': 'Asistentes IA en parcelas',
    'services.iaParcelSub': '· Agentes virtuales inmersivos',
    'services.iaParcelDesc': 'Despliegue de asistentes de inteligencia artificial dentro de las parcelas OVR y terrenos virtuales. Los agentes guían visitantes, responden preguntas sobre tokenomics, activan escenas AR y facilitan interacciones automatizadas. Compatible con Over the Reality y mundos abiertos.',
    'services.catAgents': '🤖 Agentes inteligentes del ecosistema',
    'services.forumAdmin': 'Foro Admin',
    'services.forumAdminSub': '· Moderador DAO',
    'services.forumAdminDesc': 'Gestiona el foro de gobernanza: aprueba propuestas, modera discusiones, ayuda a miembros.',
    'services.poolBalancer': 'Pool Balancer',
    'services.poolBalancerSub': '· Equilibrador DEX',
    'services.poolBalancerDesc': 'Pools AMM, rebalances ALEM/WETH, optimización contra impermanent loss.',
    'services.defiOracle': 'DEFI Oracle',
    'services.defiOracleSub': '· Charts y feeds en tiempo real',
    'services.defiOracleDesc': 'Gráficos de trading, feeds Chainlink, monitoreo de pools y cálculo de APY.',
    'services.govBot': 'Governance Bot',
    'services.govBotSub': '· veALEMTY y nobleza',
    'services.govBotDesc': 'Locks de veALEM, propuestas DAO, sistema de nobleza (Reyes/Príncipes/Duques).',
    'services.autoBot': 'AutoBot',
    'services.autoBotSub': '· CI/CD · Telegram · Discord',
    'services.autoBotDesc': 'Deploys IPFS vía Pinata, notificaciones a comunidad, builds en GitHub Actions.',
    'services.ovrAssistant': 'OVR Assistant',
    'services.ovrAssistantSub': '· AR y parcelas',
    'services.ovrAssistantDesc': '198 tierras OVR, escenas AR, quests y rutas inmersivas.',
    'services.admin': '🛡️ Panel de Administración — Control centralizado desde ia.alemty.eth. Reinicio de agentes, sincronización de pools, actualización de OVRlands, parada de emergencia (Constitución §Emergencias).',
    'services.portfolio': '📦 Portfolio: 198 tierras OVR · 684 NFTs en 146 colecciones · Tokens AURA/ALEM pendientes de minteo.',

    // Notifications
    'notif.title': 'Notificaciones',
    'notif.close': 'Cerrar',
    'notif.empty': 'No tienes notificaciones.',
    'notif.loading': 'Cargando…',

    // Profile modal
    'profile.title': 'Perfil',
    'profile.close': 'Cerrar',
    'profile.tab.rewards': 'Recompensas',
    'profile.tab.activity': 'Actividad',
    'profile.tab.dm': 'DM',
    'profile.rewards.total': 'Recompensas totales',
    'profile.rewards.aura': 'AURA en cadena',
    'profile.rewards.pending': 'Pendiente de minteo',
    'profile.rewards.claimed': 'Reclamado',
    'profile.rewards.reclaim': 'Reclamar AURA',
    'profile.rewards.reclaiming': 'Reclamando…',
    'profile.rewards.reclaimed': '¡AURA reclamada con éxito!',
    'profile.dm.placeholder': 'Selecciona una conversación',
    'profile.dm.new': 'Nueva conversación',
    'profile.dm.search': 'Buscar…',
    'profile.dm.send': 'Enviar',
    'profile.dm.cancel': 'Cancelar',
    'profile.dm.inputPlaceholder': 'Escribe un mensaje…',
    'profile.dm.start': 'Iniciar conversación',

    // Moderation
    'mod.title': 'Moderación',
    'mod.close': 'Cerrar',

    // ID page
    'id.kicker': 'Escuela de Ciencia · Filosofía · Gnosis · Web3.0',
    'id.heading': 'Consultora Web Espacial',
    'id.subtitle': 'DID – DAO – DEFI – DEX – IA – AR',
    'id.copy': 'Copiar',
    'id.copied': '¡Copiado!',
    'id.credentials': '🏅 Credenciales',
    'id.creds.title': 'Mis Credenciales',
    'id.creds.close': 'Cerrar',
    'id.book.badge': 'NUEVO · Libro',
    'id.book.title': 'La Simulación del Dragón',
    'id.book.desc': 'Descarga gratuita directa desde IPFS.',
    'id.book.note': 'Comprar será una forma opcional de apoyar el trabajo.',
    'id.book.download': 'Descargar PDF',
    'id.book.buy': 'Comprar',
    'id.book.buySub': 'Amazon',
    'id.follow': 'Sígueme',

    // DAO page
    'dao.title': 'ORGANIZACIÓN AUTÓNOMA DESCENTRALIZADA',
    'dao.subtitle': 'ORGANIZACIÓN AUTÓNOMA DESCENTRALIZADA',
    'dao.brand': 'dao.alemty.eth',
    'dao.proposals': 'Propuestas',
    'dao.proposal.new': 'Nueva propuesta',
    'dao.proposal.vote': 'Votar',
    'dao.proposal.closed': 'Cerrada',
    'dao.proposal.active': 'Activa',
    'dao.proposal.pending': 'Pendiente',
    'dao.forum': 'Foro descentralizado web3.0 · Inicia sesión SIWE con MetaMask para participar.',
    'dao.tab.relevant': 'Relevantes',
    'dao.tab.recent': 'Recientes',
    'dao.tab.week': 'Top Semana',
    'dao.tab.month': 'Top Mes',
    'dao.panel.relevantDesc': 'Últimos posts más relevantes',
    'dao.panel.recentDesc': 'Últimos posts del foro',
    'dao.panel.weekDesc': 'Los mejores posts de la semana',
    'dao.panel.monthDesc': 'Los mejores posts del mes',
    'dao.backrooms': 'Backrooms',
    'dao.topics': 'Temas',
    'dao.members': 'Miembros',
    'dao.treasury': 'Tesorería',
    'dao.governance': 'Gobernanza',
    // DAO modal & form texts
    'dao.editPost': 'Editar post',
    'dao.topic': 'Tema',
    'dao.topicHint': 'Puedes escribir un tema o dejar "Sin tema".',
    'dao.content': 'Contenido',
    'dao.save': 'Guardar',
    'dao.cancel': 'Cancelar',
    'dao.deletePost': 'Eliminar post',
    'dao.confirmation': 'Confirmación',
    'dao.deleteConfirmMsg': '¿Seguro que quieres eliminar este post? Esta acción no se puede deshacer.',
    'dao.yesDelete': 'Sí, eliminar',
    'dao.reportPost': 'Reportar post',
    'dao.reason': 'Motivo',
    'dao.reportPlaceholder': 'Describe el motivo del reporte…',
    'dao.reportHint': 'Evita datos personales. Sé breve y claro.',
    'dao.sendReport': 'Enviar reporte',
    'dao.validationRequired': 'Completa título (3+) y contenido (10+).',
    'dao.saving': 'Guardando…',
    'dao.saved': 'Guardado ✅',
    'dao.errorSaving': 'Error guardando.',
    'dao.deleting': 'Eliminando…',
    'dao.deleted': 'Eliminado ✅',
    'dao.errorDeleting': 'Error eliminando.',
    'dao.reportValidation': 'Escribe un motivo (mínimo 3 caracteres).',
    'dao.sending': 'Enviando…',
    'dao.reportSent': 'Reporte enviado ✅',
    'dao.errorReporting': 'Error enviando reporte.',
    'dao.noPosts': 'Sin posts',
    'dao.beFirst': 'Publica el primero.',
    'dao.noTopic': 'Sin tema',
    'dao.chooseTopic': 'Elegir tema',
    // DAO panel titles (used in JS PANEL_MODEL with t())
    'dao.panel.relevant': 'Relevantes',
    'dao.panel.recent': 'Recientes',
    'dao.panel.week': 'Top Semana',
    'dao.panel.month': 'Top Mes',

    // DEFI page
    'defi.title': 'TERMINAL DE TRADING',
    'defi.subtitle': 'FINANZAS DESCENTRALIZADAS',
    'defi.brand': 'defi.alemty.eth',
    'defi.chart': 'Gráfico',
    'defi.swap': 'Intercambiar',
    'defi.pool': 'Pool',
    'defi.open': 'Apertura',
    'defi.high': 'Máximo',
    'defi.low': 'Mínimo',
    'defi.close': 'Cierre',
    'defi.volatility': 'Volatilidad',
    'defi.volume': 'Volumen',
    'defi.quickSwap': '💰 Intercambio Rápido',
    'defi.from': 'De',
    'defi.to': 'A',
    'defi.flip': 'Invertir',
    'defi.executeSwap': '🚀 Ejecutar Swap',
    'defi.tradingControls': 'Controles de trading',
    'defi.advancedOrders': '🎯 Órdenes Avanzadas',
    'defi.price': 'Precio',
    'defi.sl': 'Stop Loss',
    'defi.tp': 'Take Profit',
    'defi.scheduleTrading': '⏰ Programar Trading',
    'defi.schedule': 'Programar',
    'defi.oracles': '🔮 Oráculos — Agentes',
    'defi.syncing': 'Sincronizando',
    'defi.proposals': '3 propuestas',
    'defi.oraclesFoot': 'En vivo cuando los agentes estén en Base Mainnet.',
    'defi.footer': 'defi.alemty.eth · ETH/USD via CoinGecko · No financiero / no equity ·',
    'defi.codeIsLaw': 'Código es ley.',
    'defi.balance': 'Balance',
    'defi.connect': 'Conectar wallet',

    // DEX page
    'dex.title': 'INTERCAMBIADOR DESCENTRALIZADO',
    'dex.subtitle': 'INTERCAMBIADOR DESCENTRALIZADO',
    'dex.brand': 'dex.alemty.eth',
    'dex.swap': 'Swap',
    'dex.swapDesc': 'Interno (Aura/ALEM) o Externo (ALEM/ETH en BASE).',
    'dex.swapMode': 'Modo Swap',
    'dex.internal': 'Interno',
    'dex.external': 'Externo',
    'dex.pool': 'Pool',
    'dex.liquidity': 'Liquidez',
    'dex.from': 'De',
    'dex.to': 'A',
    'dex.flip': 'Invertir',
    'dex.pools': 'Pools',
    'dex.poolsDesc': 'Administra liquidez, vota y soborna pools clave de la DAO.',
    'dex.searchPool': 'Buscar pool…',
    'dex.filterAll': 'Todos',
    'dex.filterInternal': 'Internos',
    'dex.filterExternal': 'Externos',
    'dex.poolSocial': 'AMM social (tokenomics)',
    'dex.poolExternal': 'Base (Ethereum L2)',
    'dex.liquidityBtn': '➕ Liquidez',
    'dex.voteBtn': '🗳️ Votar',
    'dex.bribeBtn': '💰 Sobornar',
    'dex.veStake': '🔒 Stake veALEM',
    'dex.veStakeDesc': 'Lockea ALEM para recibir veALEM. Mayor poder de voto y recompensas por lock más largo.',
    'dex.lockAmount': 'Cantidad a lockear',
    'dex.max': 'MAX',
    'dex.balancePrefix': 'Balance:',
    'dex.lockDuration': 'Duración del lock',
    'dex.lock6m': '6 meses',
    'dex.lock1y': '1 año',
    'dex.lock2y': '2 años',
    'dex.lock4y': '4 años',
    'dex.lockBtn': '🔒 Lockear ALEM',
    'dex.yourPosition': 'Tu posición',
    'dex.lockedAlems': 'ALEM lockeado',
    'dex.veObtained': 'veALEM obtenido',
    'dex.expiry': 'Vencimiento',
    'dex.estApr': 'APR estimado',
    'dex.votePower': 'Poder de voto',
    'dex.whatIsVe': '¿Qué es veALEM?',
    'dex.whatIsVeDesc': 'veALEM es ALEM lockeado que te da poder de gobernanza en la DAO. Mientras más largo el lock, más veALEM recibes. El veALEM decae con el tiempo si no se renueva. Sin lock mínimo, sin penalidad por retiro anticipado (el ALEM queda bloqueado hasta el fin del período).',
    'dex.nobility': '👑 Nobleza',
    'dex.nobilityDesc': 'Rangos políticos según veALEMTY activo. El poder se bloquea, el estatus se gana.',
    'dex.kings': 'Reyes',
    'dex.kingsSub': 'Top 3 veALEMTY',
    'dex.king': '👑 Rey',
    'dex.kingFoot': 'Dirección estratégica · Propuestas estructurales',
    'dex.princes': 'Príncipes',
    'dex.princesSub': 'Top 4–15 veALEMTY',
    'dex.prince': '🤴 Príncipe',
    'dex.princeFoot': 'Propuestas y voto',
    'dex.dukes': 'Duques',
    'dex.dukesSub': 'Top 16–50 veALEMTY',
    'dex.duke': '🏰 Duque',
    'dex.dukeFoot': 'Voto y deliberación',
    'dex.nobleFormula': '⚖️ Fórmula de Nobleza',
    'dex.nobleFormulaDesc': 'La nobleza se calcula exclusivamente sobre veALEMTY activo. No sobre ALEM líquido ni balance en cartera.',
    'dex.nobleFormulaRank': 'Rango = f(veALEMTY) según percentil global',
    'dex.nobleNfts': '🪪 NFTs de Nobleza',
    'dex.nobleNft1': '❌ No transferibles',
    'dex.nobleNft2': '🔨 Se mintean y queman automáticamente',
    'dex.nobleNft3': '🏛️ Representan cargo político, no propiedad',
    'dex.nobleNft4': '📉 Al perder veALEMTY suficiente, la nobleza se pierde',
    'dex.noblePerms': '📜 Permisos por Rango',
    'dex.permKings': 'Dirección estratégica, propuestas estructurales',
    'dex.permPrinces': 'Propuestas y voto',
    'dex.permDukes': 'Voto y deliberación',
    'dex.yourStatus': '🔍 Tu estatus',
    'dex.yourStatusDesc': 'Conecta tu wallet para ver tu rango de nobleza.',
    'dex.noNobility': '⚡ Fuera del Top 50 no hay nobleza',
    'dex.balance': 'Balance',
    'dex.connect': 'Conectar wallet',

    // IA page
    'ia.title': 'INTELIGENCIA ARTIFICIAL',
    'ia.subtitleDisc': 'Inteligencia Artificial Descentralizada',
    'ia.brand': 'ia.alemty.eth',
    'ia.subtitle': '🤖 Centro de Control — Agentes, Automatizaciones, Foro, DEX, DEFI',
    'ia.agentsTitle': '🤖 Agentes Inteligentes',
    'ia.activity': '📋 Actividad Reciente',
    'ia.realtime': 'Tiempo real',
    'ia.agents': 'Agentes',
    'ia.agents.active': 'activos',
    'ia.status.online': 'Online',
    'ia.status.busy': 'Ocupado',
    'ia.status.offline': 'Offline',
    'ia.actions.goto': 'Ir a',
    'ia.actions.restart': 'Reiniciar',
    'ia.actions.config': 'Configurar',
    'ia.metrics.active': 'Agentes Activos',
    'ia.metrics.ofTotal': 'de {0} totales',
    'ia.metrics.totalNfts': 'Total NFTs',
    'ia.metrics.collections': 'colecciones',
    'ia.metrics.lands': 'tierras',
    'ia.metrics.parcels': 'Parcelas OVR',
    'ia.metrics.arScenes': 'escenas AR activas',
    'ia.metrics.aura': 'AURA / ALEM',
    'ia.metrics.pending': 'Pendiente',
    'ia.metrics.mintPending': 'Minteo pendiente',
    'ia.admin.restricted': 'Panel de administración restringido. Conecta con 0x6a20…1854f e inicia sesión SIWE para acceder.',
    'ia.admin.panelTitle': 'Panel de Administración — Fundador',
    'ia.admin.verified': 'Verificado',
    'ia.admin.restartAll': 'Reiniciar todos los agentes',
    'ia.admin.syncPools': 'Sincronizar pools DEX',
    'ia.admin.syncOvr': 'Sincronizar {0} OVRlands',
    'ia.admin.emergencyStop': 'Parada de emergencia',
    'ia.admin.adminLabel': 'Admin',
    'ia.admin.activeLands': 'OVRlands activas',
    'ia.admin.arScenes': 'escenas AR',
    'ia.admin.collections': 'colecciones',
    'ia.admin.lands': 'tierras',
    'ia.admin.bricks': 'ladrillos',
    'ia.admin.pending': 'AURA/ALEM pendientes',
    'ia.toast.restarting': '🔄 Reiniciando agente',
    'ia.toast.logs': '📋 Abriendo logs de',
    'ia.toast.configuring': '⚙️ Abriendo configuración de',
    'ia.toast.on': 'en',
    'ia.toast.restartAll': '🔄 Reiniciando todos los agentes...',
    'ia.toast.syncPools': '🔄 Sincronizando pools DEX con Rulebook §6...',
    'ia.toast.syncOvr': '🌍 Sincronizando parcelas OVRlands con Over the Reality...',
    'ia.toast.emergencyStop': '🛑 ¡PARADA DE EMERGENCIA! (Constitución §Emergencias: fundador puede pausar)',
    'ia.toast.executing': 'ejecutando',
    'ia.console': 'Consola',
    'ia.chat': 'Chat',
    'ia.send': 'Enviar',
    'ia.input': 'Escribe un mensaje…',
    // IA time labels
    'ia.time.justNow': 'hace unos seg',
    'ia.time.10s': 'hace 10 seg',
    'ia.time.30s': 'hace 30 seg',
    'ia.time.1m': 'hace 1 min',
    'ia.time.2m': 'hace 2 min',
    // IA activity feed texts
    'ia.activity.newCid': 'nuevo CID',
    'ia.activity.parcelSynced': 'Parcela OVR sincronizada',
    'ia.activity.notificationsSent': 'notificaciones enviadas a comunidad',
    'ia.activity.arSceneReady': 'Escena AR preparada para OVRland',
    'ia.activity.veLocks': 'veALEMTY locks activos',
    'ia.activity.autoRebalance': 'Rebalance automático — ratio ALEM/WETH optimizado',
    // IA stat labels (from a.stats keys)
    'ia.stat.posts': 'Posts',
    'ia.stat.replies': 'Respuestas',
    'ia.stat.modActions': 'Acc. moderación',
    'ia.stat.membersHelped': 'Miembros ayudados',
    'ia.stat.rebalances': 'Rebalances',
    'ia.stat.tvlManaged': 'TVL gestionado',
    'ia.stat.trades': 'Trades',
    'ia.stat.impermanentLoss': 'Pérdida impermanente',
    'ia.stat.chartsUpdated': 'Charts actualizados',
    'ia.stat.poolsMonitored': 'Pools monitoreados',
    'ia.stat.yieldOps': 'Ops. yield',
    'ia.stat.apyAvg': 'APY promedio',
    'ia.stat.proposals': 'Propuestas',
    'ia.stat.votesCast': 'Votos emitidos',
    'ia.stat.executed': 'Ejecutadas',
    'ia.stat.participation': 'Participación',
    'ia.stat.commits': 'Commits',
    'ia.stat.deploys': 'Deploys',
    'ia.stat.telegramMsgs': 'Mensajes Telegram',
    'ia.stat.discordMsgs': 'Mensajes Discord',
    'ia.stat.parcelsManaged': 'Parcelas gestionadas',
    'ia.stat.arScenes': 'Escenas AR',
    'ia.stat.assets': 'Assets',
    'ia.stat.visitors': 'Visitantes',
    // IA counter labels (agent counter groups)
    'ia.counter.openProposals': 'Propuestas abiertas',
    'ia.counter.activeVotes': 'Votaciones activas',
    'ia.counter.helpedMembers': 'Miembros ayudados',
    'ia.counter.activePools': 'Pools activos',
    'ia.counter.totalRebalances': 'Rebalances totales',
    'ia.counter.tvlManaged': 'TVL gestionado',
    'ia.counter.chartsUpdated': 'Charts actualizados',
    'ia.counter.chainlinkFeeds': 'Feeds Chainlink',
    'ia.counter.avgApy': 'APY promedio',
    'ia.counter.protocolKing': 'Rey del protocolo',
    'ia.counter.activePrinces': 'Príncipes activos',
    'ia.counter.titularDukes': 'Duques titulares',
    'ia.counter.executedActions': 'Actions ejecutadas',
    'ia.counter.ipfsDeploys': 'Deploys IPFS',
    'ia.counter.activeChannels': 'Canales activos',
    'ia.counter.ovrLands': 'Tierras OVR',
    'ia.counter.totalNfts': 'NFTs totales',
    'ia.counter.collections': 'Colecciones',
    // IA activity log texts
    'ia.activity.log0': 'Deploy IPFS exitoso — CID actualizado via Pinata workflow',
    'ia.activity.log1': 'Parcelas OVR sincronizadas — 24 lands en 0x6a20…1854f',
    'ia.activity.log2': 'Aprobó propuesta #12 — Nuevo pool USDC/ETH (quórum 10% veALEM)',
    'ia.activity.log3': 'Rebalanceó pool ALEM/WETH — ratio 60/40 según rulebook §6',
    'ia.activity.log4': 'Telegram notification: deploy exitoso a main',
    'ia.activity.log5': 'Actualizó chart ETH/USDC — $3,284.50 (feed Chainlink Base)',
    'ia.activity.log6': 'Quest completada — 12 visitantes en parcela coordinada',
    'ia.activity.log7': 'Propuesta #14 — Nuevo treasury multisig (15 días votación)',
    'ia.activity.log8': 'Discord webhook: PR mergeado → notificación a #general',
    'ia.activity.log9': 'Moderó hilo — Spam eliminado (3 posts)',
    'ia.activity.log10': 'Swap ejecutado: 5,000 USDC → ALEM (slippage < 1%)',
    'ia.activity.log11': 'Pinata upload: public/ → IPFS (nuevo CID inmutable)',

    // AR page
    'ar.title': 'REALIDAD AUMENTADA',
    'ar.brand': 'ar.alemty.eth',
    'ar.desc': 'Módulo de Realidad Aumentada. Identidad, símbolos y capas espaciales.',
    'ar.spaces': 'Espacios',
    'ar.spacesDesc': 'Anclaje de identidades, símbolos y objetos AR en ubicaciones reales.',
    'ar.exploreSpaces': 'Explorar espacios',
    'ar.layers': 'Capas',
    'ar.layersDesc': 'Capas narrativas, rituales o informativas sobre el entorno.',
    'ar.exploreLayers': 'Explorar capas',
    'ar.statusTitle': 'Estado del módulo',
    'ar.statusDesc': 'El módulo AR se encuentra en fase conceptual. Integrará ENS, agentes IA y coordenadas espaciales.',
    'ar.footer': 'Módulo AR · alemty.eth',
    'ar.parcels': 'Parcelas',
    'ar.scenes': 'Escenas',
    'ar.quests': 'Misiones',
    'ar.explore': 'Explorar',

    // Common
    'common.loading': 'Cargando…',
    'common.error': 'Error',
    'common.save': 'Guardar',
    'common.cancel': 'Cancelar',
    'common.confirm': 'Confirmar',
    'common.close': 'Cerrar',
    'common.back': 'Volver',
    'common.more': 'Ver más',
    'common.retry': 'Reintentar',
    'common.noData': 'Sin datos',
  },

  en: {
    'topbar.theme': 'Theme',
    'topbar.lang': 'Language',
    'topbar.profile': 'Profile',
    'topbar.notifications': 'Notifications',
    'topbar.menu': 'Menu',

    'drawer.title': 'Menu',
    'drawer.close': 'Close',
    'drawer.identity': 'DID Identity',
    'drawer.status': 'Status',
    'drawer.connected': 'Connected',
    'drawer.disconnected': 'Disconnected',
    'drawer.didSiwe': 'DID – SIWE',
    'drawer.login': '🦊 Sign In',
    'drawer.register': '🦊 Register',
    'drawer.signSiwe': '✅ Sign SIWE',
    'drawer.logout': '⛔ Sign Out',
    'drawer.tutorial': 'MetaMask registration tutorial',
    'drawer.services': 'Services',
    'drawer.servicesDesc': 'Decentralized Web3 consultancy — 6 intelligent agents serving the ecosystem.',
    'drawer.servicesViewAll': '📋 View all services',
    'drawer.about': 'About',
    'drawer.aboutDesc1': 'Experimental Web3 project. The DAO is not a legal entity; tokens are not securities or equity. Participation at your own risk.',
    'drawer.aboutDesc2': 'Copyright / IP: unless otherwise agreed in writing, the intellectual property of the project belongs to the founder.',
    'drawer.aboutDocs': '📚 Official documentation',

    'disclaimer': '© alemty.eth · ENS · IPFS · Decentralized Digital Identity',

    'services.title': 'DAO Services',
    'services.close': 'Close',
    'services.header': 'Decentralized Web3 consultancy · alemty.eth · Ecosystem products & services',
    'services.catDigital': '📦 Digital asset rental & sales',
    'services.tierras': 'OVR Lands',
    'services.tierrasSub': '· 198 parcels on Polygon',
    'services.tierrasDesc': 'Rent or acquire Over the Reality metaverse parcels. Lands include interactive AR scenes, real geographic coordinates and the possibility to activate quests for visitors. Ideal for brands, artists and events. Stock: 198 lands · 24 with active AR scenes.',
    'services.nfts': 'Collectible NFTs',
    'services.nftsSub': '· 684 assets in 146 collections',
    'services.nftsDesc': 'Diversified NFT portfolio on Polygon: Decentraland wearables (DCLMF, MVMF22, Pride), HAPE Apparel, AKCB, Another-1 x Templa, Rad TV, and more. Direct sale or trading between ecosystem collections.',
    'services.iaParcel': 'AI Assistants on parcels',
    'services.iaParcelSub': '· Immersive virtual agents',
    'services.iaParcelDesc': 'Deploy artificial intelligence assistants inside OVR parcels and virtual lands. Agents guide visitors, answer tokenomics questions, activate AR scenes and facilitate automated interactions. Compatible with Over the Reality and open worlds.',
    'services.catAgents': '🤖 Ecosystem intelligent agents',
    'services.forumAdmin': 'Forum Admin',
    'services.forumAdminSub': '· DAO Moderator',
    'services.forumAdminDesc': 'Manages the governance forum: approves proposals, moderates discussions, helps members.',
    'services.poolBalancer': 'Pool Balancer',
    'services.poolBalancerSub': '· DEX Balancer',
    'services.poolBalancerDesc': 'AMM pools, ALEM/WETH rebalances, impermanent loss optimization.',
    'services.defiOracle': 'DEFI Oracle',
    'services.defiOracleSub': '· Real-time charts & feeds',
    'services.defiOracleDesc': 'Trading charts, Chainlink feeds, pool monitoring and APY calculation.',
    'services.govBot': 'Governance Bot',
    'services.govBotSub': '· veALEMTY & nobility',
    'services.govBotDesc': 'veALEM locks, DAO proposals, nobility system (Kings/Princes/Dukes).',
    'services.autoBot': 'AutoBot',
    'services.autoBotSub': '· CI/CD · Telegram · Discord',
    'services.autoBotDesc': 'IPFS deploys via Pinata, community notifications, GitHub Actions builds.',
    'services.ovrAssistant': 'OVR Assistant',
    'services.ovrAssistantSub': '· AR & parcels',
    'services.ovrAssistantDesc': '198 OVR lands, AR scenes, quests and immersive routes.',
    'services.admin': '🛡️ Admin Panel — Centralized control from ia.alemty.eth. Agent restart, pool sync, OVRlands update, emergency stop (Constitution §Emergencies).',
    'services.portfolio': '📦 Portfolio: 198 OVR lands · 684 NFTs in 146 collections · AURA/ALEM tokens pending mint.',

    'notif.title': 'Notifications',
    'notif.close': 'Close',
    'notif.empty': 'You have no notifications.',
    'notif.loading': 'Loading…',

    'profile.title': 'Profile',
    'profile.close': 'Close',
    'profile.tab.rewards': 'Rewards',
    'profile.tab.activity': 'Activity',
    'profile.tab.dm': 'DM',
    'profile.rewards.total': 'Total rewards',
    'profile.rewards.aura': 'On-chain AURA',
    'profile.rewards.pending': 'Pending mint',
    'profile.rewards.claimed': 'Claimed',
    'profile.rewards.reclaim': 'Reclaim AURA',
    'profile.rewards.reclaiming': 'Reclaiming…',
    'profile.rewards.reclaimed': 'AURA reclaimed successfully!',
    'profile.dm.placeholder': 'Select a conversation',
    'profile.dm.new': 'New conversation',
    'profile.dm.search': 'Search…',
    'profile.dm.send': 'Send',
    'profile.dm.cancel': 'Cancel',
    'profile.dm.inputPlaceholder': 'Type a message…',
    'profile.dm.start': 'Start conversation',

    'mod.title': 'Moderation',
    'mod.close': 'Close',

    'id.kicker': 'School of Science · Philosophy · Gnosis · Web3.0',
    'id.heading': 'Space Web Consultancy',
    'id.subtitle': 'DID – DAO – DEFI – DEX – IA – AR',
    'id.copy': 'Copy',
    'id.copied': 'Copied!',
    'id.credentials': '🏅 Credentials',
    'id.creds.title': 'My Credentials',
    'id.creds.close': 'Close',
    'id.book.badge': 'NEW · Book',
    'id.book.title': 'The Dragon Simulation',
    'id.book.desc': 'Free download directly from IPFS.',
    'id.book.note': 'Buying is an optional way to support the work.',
    'id.book.download': 'Download PDF',
    'id.book.buy': 'Buy',
    'id.book.buySub': 'Amazon',
    'id.follow': 'Follow me',

    'dao.title': 'DECENTRALIZED AUTONOMOUS ORGANIZATION',
    'dao.subtitle': 'DECENTRALIZED AUTONOMOUS ORGANIZATION',
    'dao.brand': 'dao.alemty.eth',
    'dao.proposals': 'Proposals',
    'dao.proposal.new': 'New proposal',
    'dao.proposal.vote': 'Vote',
    'dao.proposal.closed': 'Closed',
    'dao.proposal.active': 'Active',
    'dao.proposal.pending': 'Pending',
    'dao.forum': 'Decentralized web3.0 forum · Sign in with SIWE & MetaMask to participate.',
    'dao.tab.relevant': 'Relevant',
    'dao.tab.recent': 'Recent',
    'dao.tab.week': 'Top Week',
    'dao.tab.month': 'Top Month',
    'dao.panel.relevantDesc': 'Latest relevant posts',
    'dao.panel.recentDesc': 'Latest forum posts',
    'dao.panel.weekDesc': 'Best posts of the week',
    'dao.panel.monthDesc': 'Best posts of the month',
    'dao.backrooms': 'Backrooms',
    'dao.topics': 'Topics',
    'dao.members': 'Members',
    'dao.treasury': 'Treasury',
    'dao.governance': 'Governance',
    // DAO modal & form texts
    'dao.editPost': 'Edit post',
    'dao.topic': 'Topic',
    'dao.topicHint': 'You can write a topic or leave it as "No topic".',
    'dao.content': 'Content',
    'dao.save': 'Save',
    'dao.cancel': 'Cancel',
    'dao.deletePost': 'Delete post',
    'dao.confirmation': 'Confirmation',
    'dao.deleteConfirmMsg': 'Are you sure you want to delete this post? This action cannot be undone.',
    'dao.yesDelete': 'Yes, delete',
    'dao.reportPost': 'Report post',
    'dao.reason': 'Reason',
    'dao.reportPlaceholder': 'Describe the reason for the report…',
    'dao.reportHint': 'Avoid personal data. Be brief and clear.',
    'dao.sendReport': 'Send report',
    'dao.validationRequired': 'Complete title (3+) and content (10+).',
    'dao.saving': 'Saving…',
    'dao.saved': 'Saved ✅',
    'dao.errorSaving': 'Error saving.',
    'dao.deleting': 'Deleting…',
    'dao.deleted': 'Deleted ✅',
    'dao.errorDeleting': 'Error deleting.',
    'dao.reportValidation': 'Write a reason (minimum 3 characters).',
    'dao.sending': 'Sending…',
    'dao.reportSent': 'Report sent ✅',
    'dao.errorReporting': 'Error sending report.',
    'dao.noPosts': 'No posts',
    'dao.beFirst': 'Be the first to post.',
    'dao.noTopic': 'No topic',
    'dao.chooseTopic': 'Choose topic',
    // DAO panel titles (used in JS PANEL_MODEL with t())
    'dao.panel.relevant': 'Relevant',
    'dao.panel.recent': 'Recent',
    'dao.panel.week': 'Top Week',
    'dao.panel.month': 'Top Month',

    'defi.title': 'TRADING TERMINAL',
    'defi.subtitle': 'DECENTRALIZED FINANCE',
    'defi.brand': 'defi.alemty.eth',
    'defi.chart': 'Chart',
    'defi.swap': 'Swap',
    'defi.pool': 'Pool',
    'defi.open': 'Open',
    'defi.high': 'High',
    'defi.low': 'Low',
    'defi.close': 'Close',
    'defi.volatility': 'Volatility',
    'defi.volume': 'Volume',
    'defi.quickSwap': '💰 Quick Swap',
    'defi.from': 'From',
    'defi.to': 'To',
    'defi.flip': 'Invert',
    'defi.executeSwap': '🚀 Execute Swap',
    'defi.tradingControls': 'Trading controls',
    'defi.advancedOrders': '🎯 Advanced Orders',
    'defi.price': 'Price',
    'defi.sl': 'Stop Loss',
    'defi.tp': 'Take Profit',
    'defi.scheduleTrading': '⏰ Schedule Trading',
    'defi.schedule': 'Schedule',
    'defi.oracles': '🔮 Oracles — Agents',
    'defi.syncing': 'Syncing',
    'defi.proposals': '3 proposals',
    'defi.oraclesFoot': 'Live when agents are on Base Mainnet.',
    'defi.footer': 'defi.alemty.eth · ETH/USD via CoinGecko · Not financial / no equity ·',
    'defi.codeIsLaw': 'Code is law.',
    'defi.balance': 'Balance',
    'defi.connect': 'Connect wallet',

    'dex.title': 'DECENTRALIZED EXCHANGE',
    'dex.subtitle': 'DECENTRALIZED EXCHANGE',
    'dex.brand': 'dex.alemty.eth',
    'dex.swap': 'Swap',
    'dex.swapDesc': 'Internal (Aura/ALEM) or External (ALEM/ETH on BASE).',
    'dex.swapMode': 'Swap Mode',
    'dex.internal': 'Internal',
    'dex.external': 'External',
    'dex.pool': 'Pool',
    'dex.liquidity': 'Liquidity',
    'dex.from': 'From',
    'dex.to': 'To',
    'dex.flip': 'Invert',
    'dex.pools': 'Pools',
    'dex.poolsDesc': 'Manage liquidity, vote and bribe key DAO pools.',
    'dex.searchPool': 'Search pool…',
    'dex.filterAll': 'All',
    'dex.filterInternal': 'Internal',
    'dex.filterExternal': 'External',
    'dex.poolSocial': 'Social AMM (tokenomics)',
    'dex.poolExternal': 'Base (Ethereum L2)',
    'dex.liquidityBtn': '➕ Liquidity',
    'dex.voteBtn': '🗳️ Vote',
    'dex.bribeBtn': '💰 Bribe',
    'dex.veStake': '🔒 Stake veALEM',
    'dex.veStakeDesc': 'Lock ALEM to receive veALEM. Higher voting power and rewards for longer locks.',
    'dex.lockAmount': 'Amount to lock',
    'dex.max': 'MAX',
    'dex.balancePrefix': 'Balance:',
    'dex.lockDuration': 'Lock duration',
    'dex.lock6m': '6 months',
    'dex.lock1y': '1 year',
    'dex.lock2y': '2 years',
    'dex.lock4y': '4 years',
    'dex.lockBtn': '🔒 Lock ALEM',
    'dex.yourPosition': 'Your position',
    'dex.lockedAlems': 'ALEM locked',
    'dex.veObtained': 'veALEM obtained',
    'dex.expiry': 'Expiry',
    'dex.estApr': 'Estimated APR',
    'dex.votePower': 'Voting power',
    'dex.whatIsVe': 'What is veALEM?',
    'dex.whatIsVeDesc': 'veALEM is locked ALEM that gives you governance power in the DAO. The longer the lock, the more veALEM you receive. veALEM decays over time if not renewed. No minimum lock, no early withdrawal penalty (ALEM remains locked until the end of the period).',
    'dex.nobility': '👑 Nobility',
    'dex.nobilityDesc': 'Political ranks based on active veALEMTY. Power is locked, status is earned.',
    'dex.kings': 'Kings',
    'dex.kingsSub': 'Top 3 veALEMTY',
    'dex.king': '👑 King',
    'dex.kingFoot': 'Strategic direction · Structural proposals',
    'dex.princes': 'Princes',
    'dex.princesSub': 'Top 4–15 veALEMTY',
    'dex.prince': '🤴 Prince',
    'dex.princeFoot': 'Proposals and voting',
    'dex.dukes': 'Dukes',
    'dex.dukesSub': 'Top 16–50 veALEMTY',
    'dex.duke': '🏰 Duke',
    'dex.dukeFoot': 'Voting and deliberation',
    'dex.nobleFormula': '⚖️ Nobility Formula',
    'dex.nobleFormulaDesc': 'Nobility is calculated exclusively on active veALEMTY. Not on liquid ALEM or wallet balance.',
    'dex.nobleFormulaRank': 'Rank = f(veALEMTY) by global percentile',
    'dex.nobleNfts': '🪪 Nobility NFTs',
    'dex.nobleNft1': '❌ Non-transferable',
    'dex.nobleNft2': '🔨 Minted and burned automatically',
    'dex.nobleNft3': '🏛️ Represent political office, not ownership',
    'dex.nobleNft4': '📉 Losing enough veALEMTY means losing nobility',
    'dex.noblePerms': '📜 Permissions by Rank',
    'dex.permKings': 'Strategic direction, structural proposals',
    'dex.permPrinces': 'Proposals and voting',
    'dex.permDukes': 'Voting and deliberation',
    'dex.yourStatus': '🔍 Your Status',
    'dex.yourStatusDesc': 'Connect your wallet to see your nobility rank.',
    'dex.noNobility': '⚡ Outside Top 50, no nobility',
    'dex.balance': 'Balance',
    'dex.connect': 'Connect wallet',

    'ia.title': 'ARTIFICIAL INTELLIGENCE',
    'ia.subtitleDisc': 'Decentralized Artificial Intelligence',
    'ia.brand': 'ia.alemty.eth',
    'ia.subtitle': '🤖 Control Center — Agents, Automations, Forum, DEX, DEFI',
    'ia.agentsTitle': '🤖 Intelligent Agents',
    'ia.activity': '📋 Recent Activity',
    'ia.realtime': 'Real-time',
    'ia.agents': 'Agents',
    'ia.agents.active': 'active',
    'ia.status.online': 'Online',
    'ia.status.busy': 'Busy',
    'ia.status.offline': 'Offline',
    'ia.actions.goto': 'Go to',
    'ia.actions.restart': 'Restart',
    'ia.actions.config': 'Configure',
    'ia.metrics.active': 'Active Agents',
    'ia.metrics.ofTotal': 'of {0} total',
    'ia.metrics.totalNfts': 'Total NFTs',
    'ia.metrics.collections': 'collections',
    'ia.metrics.lands': 'lands',
    'ia.metrics.parcels': 'OVR Parcels',
    'ia.metrics.arScenes': 'active AR scenes',
    'ia.metrics.aura': 'AURA / ALEM',
    'ia.metrics.pending': 'Pending',
    'ia.metrics.mintPending': 'Mint pending',
    'ia.admin.restricted': 'Restricted admin panel. Connect with 0x6a20…1854f and sign in with SIWE to access.',
    'ia.admin.panelTitle': 'Admin Panel — Founder',
    'ia.admin.verified': 'Verified',
    'ia.admin.restartAll': 'Restart all agents',
    'ia.admin.syncPools': 'Sync DEX pools',
    'ia.admin.syncOvr': 'Sync {0} OVRlands',
    'ia.admin.emergencyStop': 'Emergency stop',
    'ia.admin.adminLabel': 'Admin',
    'ia.admin.activeLands': 'active OVRlands',
    'ia.admin.arScenes': 'AR scenes',
    'ia.admin.collections': 'collections',
    'ia.admin.lands': 'lands',
    'ia.admin.bricks': 'bricks',
    'ia.admin.pending': 'AURA/ALEM pending',
    'ia.toast.restarting': '🔄 Restarting agent',
    'ia.toast.logs': '📋 Opening logs for',
    'ia.toast.configuring': '⚙️ Opening configuration for',
    'ia.toast.on': 'on',
    'ia.toast.restartAll': '🔄 Restarting all agents...',
    'ia.toast.syncPools': '🔄 Syncing DEX pools with Rulebook §6...',
    'ia.toast.syncOvr': '🌍 Syncing OVRlands parcels with Over the Reality...',
    'ia.toast.emergencyStop': '🛑 EMERGENCY STOP! (Constitution §Emergencies: founder can pause)',
    'ia.toast.executing': 'executing',
    'ia.console': 'Console',
    'ia.chat': 'Chat',
    'ia.send': 'Send',
    'ia.input': 'Type a message…',
    // IA time labels
    'ia.time.justNow': 'just now',
    'ia.time.10s': '10s ago',
    'ia.time.30s': '30s ago',
    'ia.time.1m': '1 min ago',
    'ia.time.2m': '2 min ago',
    // IA activity feed texts
    'ia.activity.newCid': 'new CID',
    'ia.activity.parcelSynced': 'OVR parcel synced',
    'ia.activity.notificationsSent': 'notifications sent to community',
    'ia.activity.arSceneReady': 'AR scene ready for OVRland',
    'ia.activity.veLocks': 'Active veALEMTY locks',
    'ia.activity.autoRebalance': 'Auto-rebalance — ALEM/WETH ratio optimized',
    // IA stat labels (from a.stats keys)
    'ia.stat.posts': 'Posts',
    'ia.stat.replies': 'Replies',
    'ia.stat.modActions': 'Mod actions',
    'ia.stat.membersHelped': 'Members helped',
    'ia.stat.rebalances': 'Rebalances',
    'ia.stat.tvlManaged': 'TVL managed',
    'ia.stat.trades': 'Trades',
    'ia.stat.impermanentLoss': 'Impermanent loss',
    'ia.stat.chartsUpdated': 'Charts updated',
    'ia.stat.poolsMonitored': 'Pools monitored',
    'ia.stat.yieldOps': 'Yield ops',
    'ia.stat.apyAvg': 'Avg APY',
    'ia.stat.proposals': 'Proposals',
    'ia.stat.votesCast': 'Votes cast',
    'ia.stat.executed': 'Executed',
    'ia.stat.participation': 'Participation',
    'ia.stat.commits': 'Commits',
    'ia.stat.deploys': 'Deploys',
    'ia.stat.telegramMsgs': 'Telegram messages',
    'ia.stat.discordMsgs': 'Discord messages',
    'ia.stat.parcelsManaged': 'Parcels managed',
    'ia.stat.arScenes': 'AR scenes',
    'ia.stat.assets': 'Assets',
    'ia.stat.visitors': 'Visitors',
    // IA counter labels
    'ia.counter.openProposals': 'Open proposals',
    'ia.counter.activeVotes': 'Active votes',
    'ia.counter.helpedMembers': 'Members helped',
    'ia.counter.activePools': 'Active pools',
    'ia.counter.totalRebalances': 'Total rebalances',
    'ia.counter.tvlManaged': 'TVL managed',
    'ia.counter.chartsUpdated': 'Charts updated',
    'ia.counter.chainlinkFeeds': 'Chainlink feeds',
    'ia.counter.avgApy': 'Avg APY',
    'ia.counter.protocolKing': 'Protocol king',
    'ia.counter.activePrinces': 'Active princes',
    'ia.counter.titularDukes': 'Titular dukes',
    'ia.counter.executedActions': 'Executed actions',
    'ia.counter.ipfsDeploys': 'IPFS deploys',
    'ia.counter.activeChannels': 'Active channels',
    'ia.counter.ovrLands': 'OVR lands',
    'ia.counter.totalNfts': 'Total NFTs',
    'ia.counter.collections': 'Collections',
    // IA activity log texts
    'ia.activity.log0': 'Successful IPFS deploy — CID updated via Pinata workflow',
    'ia.activity.log1': 'OVR parcels synced — 24 lands at 0x6a20…1854f',
    'ia.activity.log2': 'Approved proposal #12 — New USDC/ETH pool (10% veALEM quorum)',
    'ia.activity.log3': 'Rebalanced ALEM/WETH pool — 60/40 ratio per rulebook §6',
    'ia.activity.log4': 'Telegram notification: successful deploy to main',
    'ia.activity.log5': 'Updated ETH/USDC chart — $3,284.50 (Chainlink Base feed)',
    'ia.activity.log6': 'Quest completed — 12 visitors at coordinated parcel',
    'ia.activity.log7': 'Proposal #14 — New multisig treasury (15-day voting)',
    'ia.activity.log8': 'Discord webhook: PR merged → notification to #general',
    'ia.activity.log9': 'Moderated thread — Spam removed (3 posts)',
    'ia.activity.log10': 'Swap executed: 5,000 USDC → ALEM (slippage < 1%)',
    'ia.activity.log11': 'Pinata upload: public/ → IPFS (new immutable CID)',

    'ar.title': 'AUGMENTED REALITY',
    'ar.brand': 'ar.alemty.eth',
    'ar.desc': 'Augmented Reality module. Identity, symbols and spatial layers.',
    'ar.spaces': 'Spaces',
    'ar.spacesDesc': 'Anchor identities, symbols and AR objects in real locations.',
    'ar.exploreSpaces': 'Explore spaces',
    'ar.layers': 'Layers',
    'ar.layersDesc': 'Narrative, ritual or informative layers over the environment.',
    'ar.exploreLayers': 'Explore layers',
    'ar.statusTitle': 'Module Status',
    'ar.statusDesc': 'The AR module is in conceptual phase. It will integrate ENS, AI agents and spatial coordinates.',
    'ar.footer': 'AR Module · alemty.eth',
    'ar.parcels': 'Parcels',
    'ar.scenes': 'Scenes',
    'ar.quests': 'Quests',
    'ar.explore': 'Explore',

    'common.loading': 'Loading…',
    'common.error': 'Error',
    'common.save': 'Save',
    'common.cancel': 'Cancel',
    'common.confirm': 'Confirm',
    'common.close': 'Close',
    'common.back': 'Back',
    'common.more': 'View more',
    'common.retry': 'Retry',
    'common.noData': 'No data',
  }
};

// ===== CURRENT LANG =====
let _current = null;

export function getLang() {
  if (!_current) {
    _current = localStorage.getItem(LS_KEY) || document.documentElement.lang || FALLBACK;
  }
  // Validate
  if (!DICT[_current]) _current = FALLBACK;
  return _current;
}

export function setLang(lang) {
  if (!DICT[lang]) return;
  _current = lang;
  localStorage.setItem(LS_KEY, lang);
  document.documentElement.lang = lang;
  document.title = getDocTitle(lang);
  emit('lang:changed', { lang });
  applyTranslations();
  updateLangBtnUI();
}

export function toggleLang() {
  const next = getLang() === 'es' ? 'en' : 'es';
  setLang(next);
  return next;
}

// ===== TRANSLATE =====
export function t(key, fallbackText) {
  const lang = getLang();
  return DICT[lang]?.[key] ?? fallbackText ?? key;
}

// ===== MASS TRANSLATE VIA data-i18n =====
export function applyTranslations(root = document) {
  // 1. Replace textContent for elements with data-i18n
  root.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    const text = t(key);
    if (text !== key) el.textContent = text;
  });

  // 2. Replace placeholder for elements with data-i18n-placeholder
  root.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
    const key = el.getAttribute('data-i18n-placeholder');
    el.placeholder = t(key);
  });

  // 3. Replace title for elements with data-i18n-title
  root.querySelectorAll('[data-i18n-title]').forEach(el => {
    const key = el.getAttribute('data-i18n-title');
    el.title = t(key);
  });

  // 4. Replace aria-label for elements with data-i18n-aria
  root.querySelectorAll('[data-i18n-aria]').forEach(el => {
    const key = el.getAttribute('data-i18n-aria');
    el.setAttribute('aria-label', t(key));
  });

  // 5. Replace value for input buttons
  root.querySelectorAll('[data-i18n-value]').forEach(el => {
    const key = el.getAttribute('data-i18n-value');
    el.value = t(key);
  });
}

// ===== DYNAMIC DOC TITLE =====
function getDocTitle(lang) {
  const path = location.pathname;
  if (path.startsWith('/dao/')) return t('dao.brand') || 'dao.alemty.eth';
  if (path.startsWith('/defi/')) return t('defi.brand') || 'defi.alemty.eth';
  if (path.startsWith('/dex/')) return t('dex.brand') || 'dex.alemty.eth';
  if (path.startsWith('/ia/')) return t('ia.brand') || 'ia.alemty.eth';
  if (path.startsWith('/ar/')) return t('ar.brand') || 'ar.alemty.eth';
  return 'alemty.eth';
}

// ===== FLAGS SVG (inline para evitar dependencia de emojis) =====
const FLAG_MX = `<svg viewBox="0 0 36 24" width="20" height="14" style="border-radius:2px;display:block;">
  <rect width="12" height="24" fill="#006847"/>
  <rect x="12" width="12" height="24" fill="#fff"/>
  <rect x="24" width="12" height="24" fill="#ce1126"/>
  <circle cx="18" cy="12" r="4" fill="#8b5e3c" opacity=".6"/>
</svg>`;

const FLAG_US = `<svg viewBox="0 0 36 24" width="20" height="14" style="border-radius:2px;display:block;">
  <rect width="36" height="24" fill="#fff"/>
  <rect width="36" height="1.85" fill="#b22234" y="0"/>
  <rect width="36" height="1.85" fill="#b22234" y="3.7"/>
  <rect width="36" height="1.85" fill="#b22234" y="7.4"/>
  <rect width="36" height="1.85" fill="#b22234" y="11.1"/>
  <rect width="36" height="1.85" fill="#b22234" y="14.8"/>
  <rect width="36" height="1.85" fill="#b22234" y="18.5"/>
  <rect width="14.4" height="12.95" fill="#3c3b6e" y="0"/>
  <circle cx="2.4" cy="2.16" r=".35" fill="#fff"/>
  <circle cx="4.8" cy="2.16" r=".35" fill="#fff"/>
  <circle cx="7.2" cy="2.16" r=".35" fill="#fff"/>
  <circle cx="9.6" cy="2.16" r=".35" fill="#fff"/>
  <circle cx="12" cy="2.16" r=".35" fill="#fff"/>
  <circle cx="3.6" cy="3.6" r=".35" fill="#fff"/>
  <circle cx="6" cy="3.6" r=".35" fill="#fff"/>
  <circle cx="8.4" cy="3.6" r=".35" fill="#fff"/>
  <circle cx="10.8" cy="3.6" r=".35" fill="#fff"/>
  <circle cx="13.2" cy="3.6" r=".35" fill="#fff"/>
  <circle cx="2.4" cy="5.04" r=".35" fill="#fff"/>
  <circle cx="4.8" cy="5.04" r=".35" fill="#fff"/>
  <circle cx="7.2" cy="5.04" r=".35" fill="#fff"/>
  <circle cx="9.6" cy="5.04" r=".35" fill="#fff"/>
  <circle cx="12" cy="5.04" r=".35" fill="#fff"/>
  <circle cx="3.6" cy="6.48" r=".35" fill="#fff"/>
  <circle cx="6" cy="6.48" r=".35" fill="#fff"/>
  <circle cx="8.4" cy="6.48" r=".35" fill="#fff"/>
  <circle cx="10.8" cy="6.48" r=".35" fill="#fff"/>
  <circle cx="13.2" cy="6.48" r=".35" fill="#fff"/>
  <circle cx="2.4" cy="7.92" r=".35" fill="#fff"/>
  <circle cx="4.8" cy="7.92" r=".35" fill="#fff"/>
  <circle cx="7.2" cy="7.92" r=".35" fill="#fff"/>
  <circle cx="9.6" cy="7.92" r=".35" fill="#fff"/>
  <circle cx="12" cy="7.92" r=".35" fill="#fff"/>
  <circle cx="3.6" cy="9.36" r=".35" fill="#fff"/>
  <circle cx="6" cy="9.36" r=".35" fill="#fff"/>
  <circle cx="8.4" cy="9.36" r=".35" fill="#fff"/>
  <circle cx="10.8" cy="9.36" r=".35" fill="#fff"/>
  <circle cx="13.2" cy="9.36" r=".35" fill="#fff"/>
  <circle cx="2.4" cy="10.8" r=".35" fill="#fff"/>
  <circle cx="4.8" cy="10.8" r=".35" fill="#fff"/>
  <circle cx="7.2" cy="10.8" r=".35" fill="#fff"/>
  <circle cx="9.6" cy="10.8" r=".35" fill="#fff"/>
  <circle cx="12" cy="10.8" r=".35" fill="#fff"/>
</svg>`;

// ===== SVG FLAG BUTTON =====
function flagSpan(lang) {
  const s = document.createElement('span');
  s.style.cssText = 'display:flex;align-items:center;justify-content:center;width:20px;height:14px;';
  s.innerHTML = lang === 'es' ? FLAG_MX : FLAG_US;
  return s;
}

export function buildLangBtn() {
  const btn = document.createElement('button');
  btn.className = 'icon-btn lang-btn';
  btn.id = 'langBtn';
  btn.type = 'button';
  btn.setAttribute('aria-label', t('topbar.lang'));
  btn.title = getLang() === 'es' ? 'English' : 'Español';
  btn.appendChild(flagSpan(getLang()));
  btn.addEventListener('click', () => {
    toggleLang();
  });
  return btn;
}

function updateLangBtnUI() {
  const btn = document.getElementById('langBtn');
  if (!btn) return;
  const isEs = getLang() === 'es';
  btn.innerHTML = '';
  btn.appendChild(flagSpan(getLang()));
  btn.title = isEs ? 'English' : 'Español';
  btn.setAttribute('aria-label', t('topbar.lang'));
}

// ===== LISTEN FOR DOM CHANGES FOR DYNAMIC CONTENT =====
const _observer = new MutationObserver(mutations => {
  for (const m of mutations) {
    for (const node of m.addedNodes) {
      if (node.nodeType === 1 && node.querySelectorAll) {
        if (node.querySelector('[data-i18n], [data-i18n-placeholder], [data-i18n-title]')) {
          applyTranslations(node);
        }
      }
    }
  }
});

export function initI18n() {
  // Restore lang from localStorage or use the html lang attr
  const saved = localStorage.getItem(LS_KEY);
  const htmlLang = document.documentElement.lang || FALLBACK;
  _current = saved || htmlLang;
  if (!DICT[_current]) _current = FALLBACK;

  // Apply to document
  document.documentElement.lang = _current;
  document.title = getDocTitle(_current);
  applyTranslations();

  // Start observer for dynamic content
  _observer.observe(document.body, { childList: true, subtree: true });
}

// Need to import emit for the event
import { emit } from './events.js';
