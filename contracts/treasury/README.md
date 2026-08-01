# Treasury Contract

The Treasury contract is the escrow vault for Pledge. It holds all project funds until milestones are verified and authorized for release. It accepts deposits from any token transfer but only permits withdrawals through the Registry contract.

---

## Deployed Address (Stellar Testnet)

| | |
|---|---|
| **Contract ID** | `CBTFXIKFJSAMNEKOLOMPFOHFUKG2NE3RYZTMRM63DAJB3TSFSN5U622H` |
| **Explorer** | [View on Stellar Expert](https://stellar.expert/explorer/testnet/contract/CBTFXIKFJSAMNEKOLOMPFOHFUKG2NE3RYZTMRM63DAJB3TSFSN5U622H) |
| **Deploy Tx** | `b9e37af8ad067d6042999c91ab928f9d12ab107021d38a073cdec753f31e723c` |
| **Init Tx** | `c1533d65b30f3f58faa566503b3c44e8fc48c72197455a6d62ea6fe0e0dfd387` |

---

## Responsibilities

- Holds escrowed XLM for all active projects
- Restricts fund release exclusively to the Registry contract
- Provides read access to its configured admin and token addresses

---

## Data Structures

### Storage Keys

| Key | Type | Scope | Description |
|---|---|---|---|
| `Admin` | `Address` | Instance | The authorized caller permitted to invoke `release`. Set to the Registry contract address on init. |
| `Token` | `Address` | Instance | The token contract address used for all transfers (native XLM). |

---

## Functions

### `init(admin: Address, token: Address)`

| | |
|---|---|
| **Access** | Deployer only. Panics if called more than once. |
| **Description** | Sets the admin address (the Registry contract) and the token contract address. Must be called once immediately after deployment, before any project is created. |

### `release(to: Address, amount: i128)`

| | |
|---|---|
| **Access** | Registry contract only. Requires admin authorization. |
| **Description** | Transfers the specified token amount from the Treasury contract's own balance to the given address. Called automatically by the Registry when a milestone reaches 2-of-3 verifier approvals. Any wallet other than the configured admin that attempts to call this function will be rejected. |

### `get_admin()`

| | |
|---|---|
| **Access** | Read-only. No authorization required. |
| **Description** | Returns the admin address. In a correctly initialized deployment this is always the Registry contract address. |

### `get_token()`

| | |
|---|---|
| **Access** | Read-only. No authorization required. |
| **Description** | Returns the token contract address configured on init. |

---

## Security Model

The Treasury has no knowledge of projects, milestones, or verifiers. It only knows one thing: which address is allowed to call `release`. That address is the Registry contract, set permanently on initialization.

This means:

- No individual person can withdraw funds directly, including the original deployer
- The only code path that triggers a release is the Registry's `verify_milestone` function, after 2-of-3 verifier approvals are confirmed on-chain
- Re-initializing the contract is blocked after the first call to `init`

---

## Tests

One test covers the full Treasury lifecycle. Run with:

```bash
cargo test -p treasury
```

### `test_treasury_init_and_release`

1. Deploys the Treasury contract
2. Calls `init` with an admin address and a token contract
3. Asserts `get_admin()` and `get_token()` return the correct values
4. Mints 1,000 tokens directly to the Treasury contract address
5. Calls `release` to send 500 tokens to a contractor address
6. Asserts Treasury balance is now 500 and contractor balance is 500
