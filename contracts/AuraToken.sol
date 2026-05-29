// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title AuraToken
 * @notice Utility token interno del ecosistema alemty.eth
 * @dev ERC20 completo. Implementa Tokenomics Rulebook §5.
 *      No listado externamente. Solo minteable por minter autorizado (backend Worker).
 *      Desplegado en Base Mainnet (Chain ID 8453).
 *
 * Reglas:
 *   §5.1 — Emisión por epoch (decay + piso): AuraPerEvent(e) = Aura₀ · m(N) · h(e)
 *   §5.2 — AuraSeed anti-sybil (+5 Aura one-time)
 *   §5.3 — Costos (gas social): post 3, point 1, topic 8, room 10, premium 5, boost 20
 *   §5.4 — Hard cap dinámico: Aura_max = 2 · ALEM_pool · Price(Aura/ALEM)
 *   §10  — Ledger auditable: mint|spend|transfer|swap_out|swap_in|burn
 */
contract AuraToken {
    // ========== ERRORS ==========
    error NotMinter();
    error NotOwner();
    error ZeroAddress();
    error MintPaused();
    error ExceedsHardCap();
    error AlreadySeeded();
    error InsufficientBalance();
    error InsufficientAllowance();

    // ========== EVENTS ==========
    event Mint(address indexed to, uint256 amount, uint256 epoch, uint256 totalAfter);
    event Spend(address indexed from, uint256 amount, string reason, uint256 burnAmount, uint256 treasuryAmount);
    event Burn(address indexed from, uint256 amount);
    event TransferEv(address indexed from, address indexed to, uint256 amount);
    event SwapOut(address indexed user, uint256 auraAmount, uint256 alemAmount);
    event SwapIn(address indexed user, uint256 alemAmount, uint256 auraAmount);
    event ApprovalEv(address indexed owner, address indexed spender, uint256 amount);
    event HardCapUpdated(uint256 newCap, uint256 alemlPool, uint256 price);
    event MinterUpdated(address indexed oldMinter, address indexed newMinter);
    event AuraSeed(address indexed user, uint256 amount);

    // ========== ERC20 STATE ==========
    string public constant name = "Aura";
    string public constant symbol = "AURA";
    uint8 public constant decimals = 18;

    mapping(address => uint256) private _balances;
    mapping(address => mapping(address => uint256)) private _allowances;
    uint256 private _totalSupply;

    // ========== ACCESS CONTROL ==========
    address public owner;
    address public minter;

    // ========== HARD CAP ==========
    uint256 public hardCap;

    // ========== EPOCH (Rulebook §5.1) ==========
    uint256 public constant EPOCH_DURATION = 1 weeks;
    uint256 public immutable genesisTimestamp;
    uint256 public constant AURA_0 = 1 ether; // 1 Aura en wei
    uint256 public constant ALPHA = 0.001 ether; // α para m(N)
    uint256 public constant HALF_LIFE_EPOCHS = 26;
    uint256 public constant H_MIN = 0.05 ether; // piso de decay

    mapping(uint256 => uint256) public epochEventCount;

    // ========== AURASEED (Rulebook §5.2) ==========
    mapping(address => bool) public hasSeeded;

    // ========== LEDGER (Rulebook §10) ==========
    enum EntryType { Mint, Spend, Transfer, SwapOut, SwapIn, Burn }
    struct LedgerEntry {
        EntryType entryType;
        address user;
        uint256 amount;
        uint256 timestamp;
    }
    LedgerEntry[] public ledger;
    mapping(address => uint256[]) private _userLedger;

    // ========== MINT PAUSE ==========
    bool public mintPaused;

    // ========== MODIFIERS ==========
    modifier onlyOwner() { if (msg.sender != owner) revert NotOwner(); _; }
    modifier onlyMinter() { if (msg.sender != minter) revert NotMinter(); _; }

    // ========== CONSTRUCTOR ==========
    constructor(address _minter, uint256 initialHardCap) {
        if (_minter == address(0)) revert ZeroAddress();
        owner = msg.sender;
        minter = _minter;
        hardCap = initialHardCap;
        genesisTimestamp = block.timestamp;
    }

    // ========== ERC20 VIEWS ==========

    function totalSupply() external view returns (uint256) { return _totalSupply; }

    function balanceOf(address account) external view returns (uint256) { return _balances[account]; }

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
        _balances[to] += amount;

        _pushLedger(EntryType.Transfer, to, amount);
        emit TransferEv(from, to, amount);
    }

    function _approve(address tokenOwner, address spender, uint256 amount) internal {
        if (tokenOwner == address(0) || spender == address(0)) revert ZeroAddress();
        _allowances[tokenOwner][spender] = amount;
        emit ApprovalEv(tokenOwner, spender, amount);
    }

    // ========== EPOCH MATH (Rulebook §5.1) ==========

    function currentEpoch() public view returns (uint256) {
        return (block.timestamp - genesisTimestamp) / EPOCH_DURATION;
    }

    /// @notice h(e) = max(H_MIN, 2^(-e/H)) en fixed-point
    function decayFactor(uint256 epoch) public pure returns (uint256) {
        if (epoch == 0) return 1 ether;
        uint256 divisor = 2 ** (epoch / HALF_LIFE_EPOCHS);
        if (divisor == 0) divisor = 1;
        uint256 result = (1 ether * 1 ether) / (divisor * 1 ether / 1 ether);
        uint256 remainder = epoch % HALF_LIFE_EPOCHS;
        if (remainder > 0 && divisor > 1) {
            uint256 prev = (1 ether * 1 ether) / ((divisor / 2) * 1 ether / 1 ether);
            uint256 next = result;
            result = prev - ((prev - next) * remainder / HALF_LIFE_EPOCHS);
        }
        return result >= H_MIN ? result : H_MIN;
    }

    /// @notice m(N) = 1/(1+α·ln(1+N))
    function multFactor(uint256 epoch) public view returns (uint256) {
        uint256 N = epochEventCount[epoch];
        if (N == 0) return 1 ether;
        // ln(1+N) aproximado para ~211 events por epoch
        uint256 lnVal = N <= 100 ? N : (N <= 500 ? 100 + ((N - 100) * 70) / 400 : 170 + ((N - 500) * 30) / 500);
        uint256 denominator = 1 ether + (ALPHA * lnVal) / 1e3;
        return (1 ether * 1 ether) / denominator;
    }

    /// @notice Aura por evento en el epoch actual
    function auraPerEvent() external view returns (uint256) {
        uint256 e = currentEpoch();
        return (AURA_0 * multFactor(e) / 1 ether) * decayFactor(e) / 1 ether;
    }

    function canMint(uint256 amount) public view returns (bool) {
        return _totalSupply + amount <= hardCap;
    }

    // ========== MINTER FUNCTIONS ==========

    /// @notice Mintea AURA por evento (like, point) — Rulebook §5.1
    function mint(address to, uint256 amount) external onlyMinter {
        if (mintPaused) revert MintPaused();
        if (!canMint(amount)) revert ExceedsHardCap();
        if (to == address(0)) revert ZeroAddress();

        epochEventCount[currentEpoch()]++;
        _totalSupply += amount;
        _balances[to] += amount;

        _pushLedger(EntryType.Mint, to, amount);
        emit Mint(to, amount, currentEpoch(), _totalSupply);
    }

    /// @notice Quema AURA (gas social) — Rulebook §5.3
    /// @param burnPct Porcentaje a quemar (50 = 50% burn, 50% treasury)
    function spend(address from, uint256 amount, string calldata reason, uint256 burnPct) external onlyMinter {
        if (_balances[from] < amount) revert InsufficientBalance();

        uint256 burnAmount = amount * burnPct / 100;
        uint256 treasuryAmount = amount - burnAmount;

        _balances[from] -= amount;
        _totalSupply -= burnAmount;

        _pushLedger(EntryType.Spend, from, amount);
        emit Spend(from, amount, reason, burnAmount, treasuryAmount);
    }

    /// @notice Burn directo
    function burn(address from, uint256 amount) external onlyMinter {
        if (_balances[from] < amount) revert InsufficientBalance();
        _balances[from] -= amount;
        _totalSupply -= amount;
        _pushLedger(EntryType.Burn, from, amount);
        emit Burn(from, amount);
    }

    /// @notice AuraSeed anti-sybil — +5 Aura one-time (§5.2)
    function seedAura(address user) external onlyMinter {
        if (hasSeeded[user]) revert AlreadySeeded();
        hasSeeded[user] = true;
        uint256 seedAmount = 5 ether;
        _balances[user] += seedAmount;
        _totalSupply += seedAmount;
        emit AuraSeed(user, seedAmount);
    }

    /// @notice Intercambio Aura → ALEM (llamado por el pool interno)
    function swapOut(address user, uint256 auraAmount, uint256 alemAmount) external onlyMinter {
        if (_balances[user] < auraAmount) revert InsufficientBalance();
        _balances[user] -= auraAmount;
        _totalSupply -= auraAmount;
        _pushLedger(EntryType.SwapOut, user, auraAmount);
        emit SwapOut(user, auraAmount, alemAmount);
    }

    /// @notice Intercambio ALEM → Aura (llamado por el pool interno)
    function swapIn(address user, uint256 alemAmount, uint256 auraAmount) external onlyMinter {
        if (!canMint(auraAmount)) revert ExceedsHardCap();
        _totalSupply += auraAmount;
        _balances[user] += auraAmount;
        _pushLedger(EntryType.SwapIn, user, auraAmount);
        emit SwapIn(user, alemAmount, auraAmount);
    }

    // ========== LEDGER ==========

    function _pushLedger(EntryType t, address user, uint256 amount) internal {
        ledger.push(LedgerEntry(t, user, amount, block.timestamp));
        _userLedger[user].push(ledger.length - 1);
    }

    function ledgerLength() external view returns (uint256) { return ledger.length; }

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

    /// @notice Actualiza hard cap dinámico — Rulebook §5.4
    function updateHardCap(uint256 alemlPool, uint256 price) external onlyOwner {
        hardCap = 2 * alemlPool * price;
        emit HardCapUpdated(hardCap, alemlPool, price);
    }

    function pauseMint(bool paused) external onlyOwner { mintPaused = paused; }

    function transferOwnership(address newOwner) external onlyOwner {
        if (newOwner == address(0)) revert ZeroAddress();
        owner = newOwner;
    }

    /// @notice Owner puede mintear también (emergency)
    function ownerMint(address to, uint256 amount) external onlyOwner {
        if (!canMint(amount)) revert ExceedsHardCap();
        _totalSupply += amount;
        _balances[to] += amount;
        _pushLedger(EntryType.Mint, to, amount);
        emit Mint(to, amount, currentEpoch(), _totalSupply);
    }
}
