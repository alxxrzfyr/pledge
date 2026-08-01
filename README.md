# Pledge: Public Infrastructure Fund Tracker

> **Tagline:** Pledge for every project: every fund tracked, every milestone verified.

Pledge is a public, on-chain infrastructure fund tracker built on **Stellar (Soroban smart contracts)**. Public infrastructure projects are traditionally funded in tranches tied to construction milestones. Without transparent public verification, funds remain vulnerable to misuse, delays, or incomplete work. Pledge locks project funds in an escrow vault contract and releases them to contractors only upon independent 2-of-3 multisig verification of physical evidence pinned to IPFS.

---

## Key Features

- **Escrow Vault Security:** Total project budgets are locked in a dedicated Treasury contract upon creation, preventing unauthorized fund withdrawal.
- **Multisig Verification:** Releases funds only after 2 out of 3 registered independent verifiers approve the submitted milestone proof.
- **Immutable Evidence:** Off-chain evidence (photographs, engineering reports, certificates) is uploaded to IPFS. Only the cryptographic hash (CID) is stored on-chain.
- **Public Audit & Flagging:** Citizens and watchdogs can inspect project progress, audit release history, and flag suspicious or stalled projects directly on-chain.
- **Event-Driven Architecture:** On-chain contract events (`created`, `proof_sub`, `verified`, `released`, `flagged`) provide real-time status updates to the user interface.

---

## Architecture

```
                                  +-----------------------+
                                  |    Citizen Public     |
                                  |    (View & Report)    |
                                  +-----------+-----------+
                                              |
+-------------------+             +-----------v-----------+             +-------------------+
|  Public Funder    |             |  Next.js 16 Frontend  |             |  Contractor       |
| (Create Project)  +------------->  (Freighter Wallet)   <-------------+  (Submit Proof)   |
+-------------------+             +-----------+-----------+             +-------------------+
                                              |
                                  +-----------v-----------+
                                  |   Verifier Auditor    |
                                  |   (2-of-3 Multisig)   |
                                  +-----------+-----------+
                                              |
                 +----------------------------+----------------------------+
                 |                                                         |
                 v                                                         v
   +---------------------------+                             +---------------------------+
   |   Registry Contract       |  --- (cross-contract) --->  |    Treasury Contract      |
   | (Project Status & Votes)  |                             |   (Escrowed XLM Vault)    |
   +---------------------------+                             +---------------------------+
```

### System Data Flow

1. **Project Creation:** The Funder initializes a project in the Registry contract, specifying milestone budgets, contractor address, and 3 verifier addresses. The budget is transferred to the Treasury contract escrow vault.
2. **Proof Submission:** The assigned Contractor uploads evidence (photos/documents) to IPFS via Pinata and submits the IPFS CID to the Registry contract for a specific milestone.
3. **Verification:** Registered verifiers review the evidence and cast an approve or reject vote.
4. **Fund Release:** Upon receiving 2-of-3 approval votes, the Registry contract executes a cross-contract invocation to `Treasury.release()`, transferring milestone funds to the contractor.
5. **Public Flagging:** Any citizen wallet can flag a project for public audit visibility if work appears stalled or fraudulent.

---

## Repository Structure

```
weee/
├── .github/
│   └── workflows/
│       └── ci.yml             # GitHub Actions CI matrix (contract tests + frontend build)
├── contracts/
│   ├── registry/              # Soroban Registry contract (milestone state machine & voting)
│   │   ├── src/
│   │   │   ├── lib.rs         # Registry logic & cross-contract invocation
│   │   │   └── test.rs        # Contract workflow & authorization tests
│   │   └── Cargo.toml
│   └── treasury/              # Soroban Treasury contract (escrow vault)
│       ├── src/
│       │   ├── lib.rs         # Treasury storage & release control
│       │   └── test.rs        # Initialization & release tests
│       └── Cargo.toml
├── frontend/                  # Next.js 16 App Router dApp interface
│   ├── app/                   # App Router pages (Dashboard, Create, Detail)
│   ├── components/            # UI components (ProjectCard, Navbar, Footer)
│   ├── lib/                   # Soroban RPC client, Zustand store, TypeScript types
│   ├── public/                # Static assets
│   ├── package.json
│   └── README.md              # Dedicated frontend documentation
├── scripts/
│   └── deploy.sh              # Soroban contract build and deployment script
└── Cargo.toml                 # Workspace configuration
```

---

## Smart Contracts (Soroban)

The smart contract suite is written in Rust using `soroban-sdk` v22.0.0.

### 1. Registry Contract (`contracts/registry`)
- **`create_project(e: Env, id: u64, name: String, funder: Address, contractor: Address, verifiers: Vec<Address>, milestones: Vec<MilestoneInput>)`**: Initializes project state and registers 3 verifier wallets.
- **`submit_proof(e: Env, project_id: u64, milestone_index: u32, evidence_ipfs_cid: String)`**: Restricted to the assigned contractor; attaches proof of work to a milestone.
- **`verify_milestone(e: Env, project_id: u64, milestone_index: u32, verifier: Address, approve: bool)`**: Restricts voting to registered verifiers. Reaching 2-of-3 approvals triggers cross-contract release.
- **`flag_project(e: Env, project_id: u64, reporter: Address, reason: String)`**: Public function allowing any wallet to register an audit flag.

### 2. Treasury Contract (`contracts/treasury`)
- **`initialize(e: Env, admin: Address, token: Address)`**: Configures vault administrator and token asset address.
- **`release(e: Env, to: Address, amount: i128)`**: Releases funds from escrow. Restricted strictly to authorized invokers (Registry contract).

---

## Getting Started

### Prerequisites

- **Rust & Cargo:** v1.80+ with target `wasm32-unknown-unknown` installed (`rustup target add wasm32-unknown-unknown`)
- **Node.js:** v22+ and `npm`
- **Stellar CLI / Soroban CLI:** Required for smart contract deployment to Testnet
- **Freighter Wallet:** Web extension for browser-based Stellar transactions

---

## Testing & Build Instructions

### 1. Smart Contract Unit Tests

Run the full Rust workspace test suite covering atomic escrow funding, access control, and 2-of-3 verification logic:

```bash
cargo test --workspace
```

Example test output:
```text
running 2 tests
test test::test_registry_full_workflow ... ok
test test::test_unauthorized_proof_submission - should panic ... ok

running 1 test
test test::test_treasury_init_and_release ... ok

test result: ok. 3 passed; 0 failed
```

### 2. Compile WebAssembly (WASM) Contracts

Compile the Soroban smart contracts into optimized WebAssembly binaries:

```bash
cargo build --target wasm32-unknown-unknown --release
```

Compiled `.wasm` binaries will be output to `target/wasm32-unknown-unknown/release/`.

### 3. Deploy Smart Contracts (Testnet)

To deploy to the Stellar Soroban Testnet using the deployment helper script:

```bash
bash scripts/deploy.sh
```

This script builds the contracts, deploys Treasury and Registry, and generates `frontend/.env.local` with the contract IDs.

---

## Frontend Setup & Execution

1. Navigate to the frontend directory:
   ```bash
   cd frontend
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Configure environment variables in `frontend/.env.local`:
   ```env
   NEXT_PUBLIC_REGISTRY_CONTRACT_ID=C...
   NEXT_PUBLIC_TREASURY_CONTRACT_ID=C...
   NEXT_PUBLIC_SOROBAN_RPC_URL=https://soroban-testnet.stellar.org
   NEXT_PUBLIC_NETWORK_PASSPHRASE=Test SDF Network ; September 2015
   PINATA_JWT=your_pinata_jwt_here
   ```

4. Launch the local development server:
   ```bash
   npm run dev
   ```

5. Access the application at [http://localhost:3000](http://localhost:3000).

---

## Continuous Integration (CI/CD)

Automated testing and build checks are configured in `.github/workflows/ci.yml`:
- **Contract Job:** Installs Rust, compiles WASM target, and runs `cargo test --workspace`.
- **Frontend Job:** Sets up Node.js 22, installs npm packages, runs ESLint (`npm run lint`), and builds production artifacts (`npm run build`).

---

## Documentation Links

- [Frontend Documentation (frontend/README.md)](frontend/README.md)
