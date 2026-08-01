# Pledge Frontend: On-Chain Public Infrastructure Tracker

The frontend interface for **Pledge**, a decentralized public infrastructure fund tracker built on Stellar Soroban. It provides a web application for project funders, contractors, verifiers, and citizens.

---

## Technology Stack

- **Framework:** [Next.js 16](https://nextjs.org/) (App Router, React 19)
- **Language:** TypeScript
- **Styling:** [Tailwind CSS v4](https://tailwindcss.com/)
- **State Management:** [Zustand](https://github.com/pmndrs/zustand)
- **Data Fetching:** [@tanstack/react-query](https://tanstack.com/query)
- **Stellar & Soroban Integration:**
  - `@stellar/freighter-api` (Browser wallet connection and signing)
  - `@stellar/stellar-sdk` (Soroban transaction building, XDR parsing, RPC interaction)
- **Off-Chain Proof Hashing:** Native Web Crypto SHA-256 IPFS CIDs
- **Iconography:** `@phosphor-icons/react`

---

## Key Features & User Flows

1. **Public Dashboard (`/`):**
   - Displays all tracked infrastructure projects.
   - Filter projects by status (`Funded`, `InProgress`, `Completed`, `Flagged`).
   - High-level progress indicators showing total budget, milestone completion percentage, and active flags.

2. **Project Creation Wizard (`/create`):**
   - Allows public funders to create new infrastructure projects.
   - Set project title, description, total budget, contractor wallet address, and 3 verifier wallet addresses.
   - Define custom milestone breakdowns (descriptions and allocated XLM amounts).

3. **Project Detail & Evidence Portal (`/project/[id]`):**
   - **Milestone Timeline:** Interactive view of all project milestones, current status, and attached proof CIDs.
   - **Contractor Proof Submission:** Assigned contractors can upload photos or documents (pinned to IPFS) and submit the resulting CID to the smart contract.
   - **Verifier Multisig Portal:** Registered verifiers can review uploaded proof and cast an Approve or Reject vote. Reaching 2-of-3 approvals triggers fund release.
   - **Citizen Public Flagging:** Connected wallets can flag stalled or suspicious projects with a documented reason.

---

## Folder Structure

```
frontend/
├── app/
│   ├── api/
│   │   └── upload/
│   │       └── route.ts       # Server action for uploading proof documents to IPFS
│   ├── create/
│   │   └── page.tsx           # Project creation page
│   ├── project/
│   │   └── [id]/
│   │       └── page.tsx       # Project detail & milestone action page
│   ├── favicon.ico
│   ├── globals.css            # Tailwind CSS v4 styling rules
│   ├── layout.tsx             # Root layout with providers & navigation
│   └── page.tsx               # Public dashboard home page
├── components/
│   ├── Footer.tsx             # Global footer
│   ├── Navbar.tsx             # Header with Freighter wallet connection
│   ├── ProjectCard.tsx        # Dashboard project summary component
│   └── Providers.tsx          # React Query & wallet store providers
├── lib/
│   ├── soroban.ts             # Soroban RPC client & contract interaction helpers
│   ├── store.ts               # Zustand global wallet and UI state management
│   └── types.ts               # Shared TypeScript interface definitions
├── public/                    # Static image assets
├── next.config.ts             # Next.js configuration
├── package.json
└── tsconfig.json
```

---

## Environment Variables

Create a `.env.local` file in the `frontend` directory with the following variables:

```env
# Smart Contract Addresses (Deployed on Soroban Testnet)
NEXT_PUBLIC_REGISTRY_CONTRACT_ID=CCZES3TPZTDVUEX3BVZOL7MT2JDPNCVVK6TTG6N2NZQLBQQYEIJESRDQ
NEXT_PUBLIC_TREASURY_CONTRACT_ID=CBTFXIKFJSAMNEKOLOMPFOHFUKG2NE3RYZTMRM63DAJB3TSFSN5U622H

# Stellar / Soroban RPC Network Settings
NEXT_PUBLIC_SOROBAN_RPC_URL=https://soroban-testnet.stellar.org
NEXT_PUBLIC_NETWORK_PASSPHRASE=Test SDF Network ; September 2015
```

---

## Getting Started

### Prerequisites

- Node.js v22.0.0 or higher
- npm, pnpm, or yarn
- Freighter Wallet Chrome Extension (configured for Stellar Testnet)

### Installation

1. Install npm dependencies:
   ```bash
   npm install
   ```

2. Run the development server:
   ```bash
   npm run dev
   ```

3. Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## Scripts

- `npm run dev`: Starts Next.js development server with hot reloading.
- `npm run build`: Compiles optimized production build.
- `npm run start`: Starts production server.
- `npm run lint`: Runs ESLint check across all TypeScript components.

---

## Smart Contract Integration Notes

The frontend uses `@stellar/stellar-sdk` and `@stellar/freighter-api` to interact directly with the deployed Soroban contracts. State updates trigger Soroban transactions signed by the user's Freighter wallet:
- `create_project`: Funder signs transaction transferring funds to Treasury vault.
- `submit_proof`: Contractor signs transaction registering IPFS CID on-chain.
- `verify_milestone`: Verifier signs transaction casting 1-of-3 vote.
- `flag_project`: Citizen signs transaction registering public flag.
