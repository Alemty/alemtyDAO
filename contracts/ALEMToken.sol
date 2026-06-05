// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title ALEMToken
 * @notice Token de gobernanza del ecosistema alemty.eth
 * @dev ERC20 completo con locking, veSTAKE (anti-plutocracia), y emisión calificada.
 *      Implementa Tokenomics Rulebook §7 y §8.
 *      Supply máximo: 1,000,000,000 ALEM (1e9 * 1e18 = 1e27 wei).
 *      Sin ICO / preventa.
 *      Desplegado en Base Mainnet (Chain ID 8453).
 *
 * Reglas:
 *   §7   — ALEM: token de gobernanza
 *   §7.1 — Emisión solo por eventos calificados (post destacado, misiones, voto, liquidez, contribución)
 *   §7.2 — Cap por DID: 1-3 eventos/semana
 *   §7.3 — Emisión: ALEM_evento = base_rate · m(N) con clamp m_min=0.02, k=0.65
 *   §8   — veSTAKE (anti-plutocracia): veSTAKE = min(sqrt(ALEM_locked) · (days/30), 500,000)
 *   §9   — Quórums A/B/C/D (reference)
 *   §10  — Ledger auditable: mint|lock|unlock|transfer|burn
 */
contract ALEMToken {
    // ========== CONSTANTS ==========
    string  public constant name     = "ALEM";
    string  public constant symbol   = "ALEM";
    uint8   public constant decimals = 18;

    /// @notice Supply máximo: 1,000,000,000 ALEM
    uint256 public constant MAX_SUPPLY = 1_000_000_000 * 1e18;

    /// @notice Base rate para emisión de ALEM por evento calificado (§7.3)
    uint256 public constant BASE_RATE = 1 ether; // 1 ALEM en wei

    /// @notice k = 0.65 para m(N) = clamp(m_min, 1 - k + k/N, 1)
    uint256 public constant K = 65; // en centésimas (0.65 = 65/100)

    /// @notice m_min = 0.02
    uint256 public constant M_MIN = 2; // en centésimas (0.02 = 2/100)

    /// @notice Cap semanal de eventos calificados por DID (§7.2): 1-3
    uint256 public constant WEEKLY_EVENT_CAP = 3;

    /// @notice Duración de epoch semanal (para tracking de eventos)
    uint256 public constant EPOCH_DURATION = 1 weeks;

    // ========== ERRORS ==========
    error NotMinter();
    error NotOwner();
    error ZeroAddress();
    error MintPaused();
    error ExceedsMaxSupply();
    error InsufficientBalance();
    error InsufficientAllowance();
    error NoActiveLock();
    error LockStillActive();
    error LockExpired();
    error WeeklyEventCapExceeded();
    error AmountZero();

    // ========== EVENTS ==========
    event Mint(address indexed to, uint256 amount, uint256 epoch, string reason);
    event Burn(address indexed from, uint256 amount);
    event TransferEv(address indexed from, address indexed to, uint256 amount);
    event ApprovalEv(address indexed owner, address indexed spender, uint256 amount);
    event MinterUpdated(address indexed oldMinter, address indexed newMinter);
    event LockCreated(address indexed user, uint256 amount, uint256 lockUntil, uint256 veSTAKE);
    event LockExtended(address indexed user, uint256 newLockUntil, uint256 newVeSTAKE);
    event LockWithdrawn(address indexed user, uint256 amount, uint256 veSTAKE);
    event MinterPaused(bool paused);

    // ========== ERC20 STATE ==========
    mapping(address => uint256) private _balances;
    mapping(address => mapping(address => uint256)) private _allowances;
    uint256 private _totalSupply;

    // ========== ACCESS CONTROL ==========
    address public owner;
    address public minter;
    bool    public mintPaused;

    // ========== EPOCH TRACKING (§7.2) ==========
    uint256 public immutable genesisTimestamp;

    /// @notice Eventos calificados por DID en el epoch actual
    mapping(address => mapping(uint256 => uint256)) public userWeeklyEvents;

    // ========== LOCKING / veSTAKE (§8) ==========
    struct Lock {
        uint256 amount;     // ALEM locked
        uint256 lockUntil;  // timestamp del unlock
        uint256 veSTAKE;    // poder calculado al crear/extender
    }

    mapping(address => Lock) public locks;

    /// @notice veSTAKE máximo: 500,000
    uint256 public constant MAX_VESTAKE = 500_000 * 1e18; // 500,000 en wei (18 decimals)

    // ========== LEDGER (§10) ==========
    enum EntryType { Mint, Burn, Transfer, Lock, Unlock }
    struct LedgerEntry {
        EntryType entryType;
        address user;
        uint256 amount;
        uint256 timestamp;
    }
    LedgerEntry[] public ledger;
    mapping(address => uint256[]) private _userLedger;

    // ========== MODIFIERS ==========
    modifier onlyOwner()   { if (msg.sender != owner)   revert NotOwner();   _; }
    modifier onlyMinter()  { if (msg.sender != minter)  revert NotMinter();  _; }

    // ========== CONSTRUCTOR ==========
    constructor(address _minter) {
        if (_minter == address(0)) revert ZeroAddress();
        owner  = msg.sender;
        minter = _minter;
        genesisTimestamp = block.timestamp;
    }

    // ========== ERC20 VIEWS ==========

    function totalSupply() external view returns (uint256) {
        return _totalSupply;
    }

    function balanceOf(address account) external view returns (uint256) {
        return _balances[account];
    }

    function allowance(address tokenOwner, address spender) external view returns (uint256) {
        return _allowances[tokenOwner][spender];
    }

    // ========== ERC20 CORE ==========

    function transfer(address to, uint256 amount) external returns (bool) {
        _transfer(msg.sender, to, amount);
        return true;
    }

    function approve(address spender, uint256 amount) external returns (bool) {
        _approve(msg.sender, spender, amount);
        return true;
    }

    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
        uint256 currentAllowance = _allowances[from][msg.sender];
        if (currentAllowance < amount) revert InsufficientAllowance();
        _allowances[from][msg.sender] = currentAllowance - amount;
        _transfer(from, to, amount);
        return true;
    }

    function _transfer(address from, address to, uint256 amount) internal {
        if (from == address(0) || to == address(0)) revert ZeroAddress();
        if (_balances[from] < amount) revert InsufficientBalance();

        _balances[from] -= amount;
        _balances[to]   += amount;

        _pushLedger(EntryType.Transfer, to, amount);
        emit TransferEv(from, to, amount);
    }

    function _approve(address tokenOwner, address spender, uint256 amount) internal {
        if (tokenOwner == address(0) || spender == address(0)) revert ZeroAddress();
        _allowances[tokenOwner][spender] = amount;
        emit ApprovalEv(tokenOwner, spender, amount);
    }

    /// @notice Permite aumentar allowance (gas-efficient)
    function increaseAllowance(address spender, uint256 addedValue) external returns (bool) {
        uint256 newAllowance = _allowances[msg.sender][spender] + addedValue;
        _approve(msg.sender, spender, newAllowance);
        return true;
    }

    /// @notice Permite disminuir allowance (gas-efficient)
    function decreaseAllowance(address spender, uint256 subtractedValue) external returns (bool) {
        uint256 current = _allowances[msg.sender][spender];
        if (subtractedValue > current) revert InsufficientAllowance();
        _approve(msg.sender, spender, current - subtractedValue);
        return true;
    }

    // ========== EPOCH HELPERS ==========

    function currentEpoch() public view returns (uint256) {
        return (block.timestamp - genesisTimestamp) / EPOCH_DURATION;
    }

    function canUserMint(address user, uint256 amount) public view returns (bool) {
        if (mintPaused) return false;
        if (amount == 0) return false;
        if (_totalSupply + amount > MAX_SUPPLY) return false;
        uint256 epoch = currentEpoch();
        if (userWeeklyEvents[user][epoch] >= WEEKLY_EVENT_CAP) return false;
        return true;
    }

    /// @notice Calcula el multiplicador m(N) según §7.3
    /// @param N Eventos calificados en el epoch
    /// @return m(N) en centésimas (100 = 1.0, 2 = 0.02)
    function multFactor(uint256 N) public pure returns (uint256) {
        if (N == 0) return 100; // 100 = 1.0
        // m(N) = clamp(m_min, 1 - k + k/N, 1)
        // k = 0.65, m_min = 0.02
        // Trabajamos en centésimas: 1 = 100, k = 65, m_min = 2
        uint256 result = 100 - K + (K * 100) / (N * 100);
        if (result > 100) result = 100;
        if (result < M_MIN) result = M_MIN;
        return result;
    }

    /// @notice ALEM por evento calificado en el epoch actual (§7.3)
    function alemPerEvent() external view returns (uint256) {
        return _alembase();
    }

    function _alembase() internal view returns (uint256) {
        uint256 epoch = currentEpoch();
        uint256 N = userWeeklyEvents[address(0)]; // contador global de eventos
        return (BASE_RATE * multFactor(N)) / 100;
    }

    // ========== MINTER FUNCTIONS ==========

    /// @notice Mintea ALEM por evento calificado — §7.1
    /// @param to Beneficiario
    /// @param amount Cantidad en wei
    /// @param reason Razón del mint (on-chain)
    function mint(address to, uint256 amount, string calldata reason) external onlyMinter {
        if (mintPaused) revert MintPaused();
        if (amount == 0) revert AmountZero();
        if (to == address(0)) revert ZeroAddress();
        if (_totalSupply + amount > MAX_SUPPLY) revert ExceedsMaxSupply();

        uint256 epoch = currentEpoch();

        // §7.2: Cap de eventos por DID
        if (userWeeklyEvents[to][epoch] >= WEEKLY_EVENT_CAP) revert WeeklyEventCapExceeded();

        userWeeklyEvents[to][epoch]++;
        // Contador global (address(0) como acumulador)
        userWeeklyEvents[address(0)][epoch]++;

        _totalSupply += amount;
        _balances[to] += amount;

        _pushLedger(EntryType.Mint, to, amount);
        emit Mint(to, amount, epoch, reason);
    }

    /// @notice Quema ALEM (reducción de supply)
    function burn(address from, uint256 amount) external onlyMinter {
        if (_balances[from] < amount) revert InsufficientBalance();
        if (amount == 0) revert AmountZero();

        _balances[from] -= amount;
        _totalSupply     -= amount;

        _pushLedger(EntryType.Burn, from, amount);
        emit Burn(from, amount);
    }

    // ========== LOCKING / veSTAKE (§8) ==========

    /// @notice Calcula veSTAKE según §8:
    ///         veSTAKE = min(sqrt(ALEM_locked) · (days/30), 500,000)
    function calculateVeSTAKE(uint256 amount, uint256 durationDays) public pure returns (uint256) {
        // sqrt(amount) en fixed-point 1e9 (para mantener precisión)
        uint256 sqrtAmount = _sqrt(amount);
        // veSTAKE = sqrt(amount) * days / 30
        uint256 ve = (sqrtAmount * durationDays) / 30;
        // Cap en 500,000 ALEM (convertido a 18 decimals)
        if (ve > MAX_VESTAKE) ve = MAX_VESTAKE;
        return ve;
    }

    /// @notice Crea un lock de ALEM
    /// @param amount Cantidad de ALEM a lockear
    /// @param durationDays Duración del lock en días (mínimo 7, máximo 365)
    function createLock(uint256 amount, uint256 durationDays) external {
        if (amount == 0) revert AmountZero();
        if (durationDays < 7) revert AmountZero(); // mínimo 7 días
        if (durationDays > 365) revert AmountZero(); // máximo 1 año
        if (_balances[msg.sender] < amount) revert InsufficientBalance();
        if (locks[msg.sender].amount > 0) revert LockStillActive();

        uint256 lockUntil = block.timestamp + (durationDays * 1 days);
        uint256 ve = calculateVeSTAKE(amount, durationDays);

        // Transferir ALEM del usuario al contrato
        _balances[msg.sender] -= amount;
        _balances[address(this)] += amount;

        locks[msg.sender] = Lock({
            amount: amount,
            lockUntil: lockUntil,
            veSTAKE: ve
        });

        _pushLedger(EntryType.Lock, msg.sender, amount);
        emit LockCreated(msg.sender, amount, lockUntil, ve);
    }

    /// @notice Extiende un lock existente
    /// @param additionalDays Días adicionales (desde ahora)
    function extendLock(uint256 additionalDays) external {
        Lock storage userLock = locks[msg.sender];
        if (userLock.amount == 0) revert NoActiveLock();
        if (additionalDays < 7) revert AmountZero();
        if (additionalDays > 365) revert AmountZero();

        uint256 newLockUntil = block.timestamp + (additionalDays * 1 days);
        uint256 remaining = userLock.lockUntil > block.timestamp
            ? userLock.lockUntil - block.timestamp
            : 0;
        uint256 totalDays = (remaining + additionalDays * 1 days) / 1 days;
        uint256 newVe = calculateVeSTAKE(userLock.amount, totalDays);

        userLock.lockUntil = newLockUntil;
        userLock.veSTAKE = newVe;

        emit LockExtended(msg.sender, newLockUntil, newVe);
    }

    /// @notice Retira ALEM después de que expire el lock
    function withdrawLock() external {
        Lock storage userLock = locks[msg.sender];
        if (userLock.amount == 0) revert NoActiveLock();
        if (block.timestamp < userLock.lockUntil) revert LockStillActive();

        uint256 amount = userLock.amount;
        uint256 ve = userLock.veSTAKE;

        delete locks[msg.sender];

        // Devolver ALEM al usuario
        _balances[address(this)] -= amount;
        _balances[msg.sender] += amount;

        _pushLedger(EntryType.Unlock, msg.sender, amount);
        emit LockWithdrawn(msg.sender, amount, ve);
    }

    /// @notice Consulta el veSTAKE actual de un usuario (considerando decay lineal)
    function getVeSTAKE(address user) public view returns (uint256) {
        Lock storage userLock = locks[user];
        if (userLock.amount == 0) return 0;

        uint256 remaining = userLock.lockUntil > block.timestamp
            ? userLock.lockUntil - block.timestamp
            : 0;
        uint256 totalDuration = userLock.lockUntil - (userLock.lockUntil - remaining);

        return (userLock.veSTAKE * remaining) / totalDuration;
    }

    /// @notice Consulta el veSTAKE original (sin decay)
    function getOriginalVeSTAKE(address user) external view returns (uint256) {
        return locks[user].veSTAKE;
    }

    /// @notice Lock info completa
    function getLockInfo(address user) external view returns (Lock memory) {
        return locks[user];
    }

    // ========== LEDGER (§10) ==========

    function _pushLedger(EntryType t, address user, uint256 amount) internal {
        ledger.push(LedgerEntry(t, user, amount, block.timestamp));
        _userLedger[user].push(ledger.length - 1);
    }

    function ledgerLength() external view returns (uint256) {
        return ledger.length;
    }

    function getUserLedger(address user) external view returns (LedgerEntry[] memory) {
        uint256[] storage indices = _userLedger[user];
        LedgerEntry[] memory entries = new LedgerEntry[](indices.length);
        for (uint256 i = 0; i < indices.length; i++) {
            entries[i] = ledger[indices[i]];
        }
        return entries;
    }

    // ========== OWNER FUNCTIONS ==========

    function updateMinter(address newMinter) external onlyOwner {
        if (newMinter == address(0)) revert ZeroAddress();
        emit MinterUpdated(minter, newMinter);
        minter = newMinter;
    }

    function pauseMint(bool paused) external onlyOwner {
        mintPaused = paused;
        emit MinterPaused(paused);
    }

    /// @notice Owner puede mintear también (emergencia / setup inicial)
    function ownerMint(address to, uint256 amount, string calldata reason) external onlyOwner {
        if (amount == 0) revert AmountZero();
        if (to == address(0)) revert ZeroAddress();
        if (_totalSupply + amount > MAX_SUPPLY) revert ExceedsMaxSupply();

        _totalSupply += amount;
        _balances[to] += amount;

        _pushLedger(EntryType.Mint, to, amount);
        emit Mint(to, amount, currentEpoch(), reason);
    }

    function transferOwnership(address newOwner) external onlyOwner {
        if (newOwner == address(0)) revert ZeroAddress();
        owner = newOwner;
    }

    // ========== MATH HELPERS ==========

    /// @notice Raíz cuadrada en fixed-point (1e9 precision)
    function _sqrt(uint256 x) internal pure returns (uint256) {
        if (x == 0) return 0;
        // Escalar a 1e18 para precisión
        uint256 xx = x * 1e18;
        uint256 z = (xx + 1) / 2;
        uint256 y = xx;
        while (z < y) {
            y = z;
            z = (xx / z + z) / 2;
        }
        // Desescalar a 1e9
        return y / 1e9;
    }
}
