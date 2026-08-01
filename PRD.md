# Product Requirements Document: Pledge

**Tagline:** Pledge for every project: every fund tracked, every milestone verified.

**Category:** Advanced Smart Contracts + Production-Ready dApps
**Chain:** Stellar (Soroban smart contracts)
**Status:** Approved v1.0
**Author:** Pledge Core Team
**Last updated:** 2026-08-01

---

## 1. Problem Statement

Government infrastructure projects are funded in tranches tied to construction milestones, but there is no public, verifiable way to confirm that a milestone was actually completed before the next tranche is released. This creates space for "ghost projects": infrastructure that is fully funded on paper but partially built, poorly built, or never built at all. Citizens have no direct way to check whether a project near them is progressing, stalled, or fraudulent, and whistleblowing currently depends on investigative journalism or leaked documents rather than open, real-time data.

## 2. Goal

Build a public, on-chain infrastructure fund tracker where every fund released to a contractor is tied to a verified, evidence-backed milestone, and where any citizen can view project status and report suspicious activity in real time.

## 3. Objectives

- Make fund release for a milestone impossible without independent verification
- Make every fund release publicly auditable, with no way to alter or delete history
- Give ordinary citizens, not just auditors, a way to see and flag suspicious projects
- Demonstrate a genuinely production-shaped Soroban dApp: multiple contracts, real tests, CI/CD, and a usable frontend, not a single-function demo

## 4. Target Users

| User | Role | Primary need |
|---|---|---|
| Funder / Public Body | Creates and funds projects | Disburse funds only against verified progress |
| Contractor | Executes the project | Submit evidence of work, get paid promptly once verified |
| Verifier (engineer, local official, citizen watchdog rep) | Confirms milestone completion | Review evidence, approve or reject with accountability |
| Citizen | General public | View project status near them, report stalled or suspicious projects |

## 5. Scope

### In scope (MVP)
- Project creation and budget escrow
- Milestone-based proof submission (`evidence_ipfs_cid`)
- Multisig verification of milestones (2-of-3 votes)
- Automatic fund release on verified approval
- Public flagging of any project by any wallet
- Public dashboard: list, filter, and detail view of all tracked projects
- Real-time status updates via on-chain event streaming

### Out of scope (future roadmap)
- Automated image/satellite verification (oracle-based proof)
- Integration with actual government procurement systems
- Identity verification / KYC for funder and contractor accounts
- Mobile native app (web-only, mobile responsive, for MVP)
- Multi-language support beyond English/Filipino labels

## 6. Requirements Mapping

This section maps the program's advanced-level requirements directly to how Pledge satisfies each one.

| Program requirement | How Pledge satisfies it |
|---|---|
| Advanced smart contract development | Two-contract system (Registry + Treasury) with milestone state machine (`ProjectStatus`, `MilestoneStatus`), multisig verification logic, and role-based access control |
| Inter-contract communication | Registry contract calls Treasury contract's `release()` function on verified approval; Treasury contract cannot be called directly by end users |
| Event streaming & real-time updates | Contract emits `created`, `proof_sub`, `verified`, `released`, and `flagged` events; frontend subscribes instead of polling |
| CI/CD pipeline setup | GitHub Actions runs Soroban contract tests and frontend build/lint on every push, deploys frontend to Vercel on merge to main |
| Smart contract deployment workflow | Documented deployment script for Soroban testnet, with contract address and deployment transaction hash recorded in README |
| Mobile responsive frontend development | Dashboard, project detail, and submission forms built mobile-first with Tailwind, tested at 375px and 768px breakpoints |
| Error handling & loading states | All contract calls show loading state, handle rejected transactions, wallet-not-connected state, and network errors gracefully |
| Writing tests for contracts and frontend | Rust unit tests for contract functions (create, submit, verify, release, flag); frontend component tests for core flows |
| Production-ready architecture practices | Separation of concerns between contracts, environment-based config, input validation, and access control on all state-changing functions |
| Documentation & demo presentation | Full README with architecture diagram, setup instructions, and a 1 to 2 minute demo video walking through one full project lifecycle |

## 7. User Stories

- As a **funder**, I want to create a project with defined milestones and lock the full budget in escrow, so that funds cannot be spent outside the agreed plan.
- As a **contractor**, I want to submit evidence of a completed milestone via IPFS CID (`evidence_ipfs_cid`), so that I can be paid promptly without manual paperwork delays.
- As a **verifier**, I want to review submitted evidence and vote to approve or reject it, so that funds only release for genuinely completed work.
- As a **citizen**, I want to view any tracked project's status and history near me, so that I can see whether public funds are being used properly.
- As a **citizen**, I want to flag a project that looks stalled or suspicious, so that it gets public visibility even outside the formal verification process.

## 8. System Architecture

### 8.1 Smart contracts (Soroban)

**Registry contract**
- Stores project metadata: id, name, funder address, contractor address, milestone list, status (`ProjectStatus`)
- Stores milestone data: description, amount, status (`MilestoneStatus`), `evidence_ipfs_cid`, verifier approval and rejection vectors
- Enforces access control: only funder can create, only assigned contractor can submit evidence, only registered verifiers can vote
- Calls Treasury contract to release funds once a milestone reaches 2-of-3 verifier approval

**Treasury contract**
- Holds escrowed funds per project
- Exposes `release(to, amount)`, callable only by the Registry contract
- Tracks token address and admin governance

### 8.2 Verification model

Each project has three assigned verifiers (e.g., an independent engineer, a local representative, and an auditor). A milestone requires 2-of-3 approval to release funds. Evidence is uploaded off-chain (photo or document) to IPFS, and only the resulting content identifier (`evidence_ipfs_cid`) is stored on-chain, so evidence cannot be altered after submission.

### 8.3 Frontend

- Public dashboard: map or list view of all projects, filterable by status (funded, in progress, completed, flagged)
- Project detail page: budget breakdown, milestone timeline, proof evidence, full on-chain release history
- Contractor view: milestone proof submission form
- Verifier view: approve/reject with wallet signature
- Flag button: open to any connected wallet, no special role required

### 8.4 Data flow

1. Funder creates project and deposits budget -> Registry stores metadata, Treasury holds funds
2. Contractor submits evidence for a milestone -> milestone status changes to `PendingVerification`, project status updates to `InProgress`, event emitted
3. Verifiers vote -> once 2-of-3 approve, milestone status changes to `Verified` and Registry calls Treasury's `release()`
4. Funds move to contractor's wallet -> event emitted, dashboard updates in real time
5. If rejected by 2-of-3 verifiers, milestone flips to `Rejected`, project status flips to `Flagged`

## 9. Deployment & Hosting

### 9.1 Split responsibility

Vercel hosts the frontend only. Smart contracts deploy separately to the Stellar network (Soroban testnet for this stage) via the Soroban CLI.

### 9.2 Environment configuration

- `NEXT_PUBLIC_REGISTRY_CONTRACT_ID` - deployed Registry contract address
- `NEXT_PUBLIC_TREASURY_CONTRACT_ID` - deployed Treasury contract address
- `NEXT_PUBLIC_SOROBAN_RPC_URL` - testnet RPC endpoint
- `NEXT_PUBLIC_NETWORK_PASSPHRASE` - Stellar testnet passphrase
- `IPFS_API_KEY` - provider key for proof upload, kept server-side only

## 10. Non-Functional Requirements

- **Transparency:** All project and milestone data must be publicly readable without requiring a login
- **Immutability:** Once a milestone is verified and funds released, that record cannot be edited or deleted
- **Performance:** Dashboard should load and reflect on-chain state within a few seconds of a transaction confirming
- **Accessibility:** Frontend usable on a basic smartphone browser, since many citizens will access it on mobile data
- **Security:** All state-changing contract functions must enforce role checks; no function should allow an arbitrary wallet to move funds or alter verified records

## 11. Milestones / Build Plan

| Phase | Deliverable |
|---|---|
| 1 | Registry and Treasury contracts, core functions, unit tests |
| 2 | Deploy to Soroban testnet, record contract address and deployment transaction hash |
| 3 | Frontend: wallet connect, project creation, milestone submission |
| 4 | Frontend: verifier approval flow, event-driven dashboard updates |
| 5 | Public flagging feature, mobile responsive pass, error/loading states |
| 6 | Vercel deployment: environment variables set, GitHub integration connected |
| 7 | CI/CD pipeline (GitHub Actions), README documentation, demo video |
