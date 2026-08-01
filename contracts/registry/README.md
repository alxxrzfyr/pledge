# Registry Contract

The Registry contract is the core of Pledge. It manages all project state, milestone progression, verifier voting, and cross-contract fund release. Every on-chain action taken by a funder, contractor, verifier, or citizen goes through this contract.

---

## Deployed Address (Stellar Testnet)

| | |
|---|---|
| **Contract ID** | `CCZES3TPZTDVUEX3BVZOL7MT2JDPNCVVK6TTG6N2NZQLBQQYEIJESRDQ` |
| **Explorer** | [View on Stellar Expert](https://stellar.expert/explorer/testnet/contract/CCZES3TPZTDVUEX3BVZOL7MT2JDPNCVVK6TTG6N2NZQLBQQYEIJESRDQ) |
| **Deploy Tx** | `f5c3d848610a07479bc59ba21583c48374221f303984a83d39586dd7aa8ccad4` |
| **Init Tx** | `99744ea2e097b59ca80994aa6e1a707868bad639659f3510302c789ead77b5e1` |

---

## Responsibilities

- Stores all project and milestone state on-chain
- Enforces role-based access control (funder, contractor, verifier)
- Accepts proof submissions from the registered contractor only
- Counts verifier votes and triggers fund release at 2-of-3 approvals
- Cross-invokes `Treasury.release()` when a milestone is verified
- Records public audit flags from any wallet

---

## Data Structures

### Project

| Field | Type | Description |
|---|---|---|
| `id` | `u32` | Auto-incrementing project identifier |
| `name` | `String` | Project title |
| `funder` | `Address` | Wallet that created and funded the project |
| `contractor` | `Address` | Wallet authorized to submit milestone proof |
| `verifiers` | `Vec<Address>` | Exactly 3 independent verifier wallets |
| `milestones` | `Vec<Milestone>` | Ordered list of milestone definitions |
| `status` | `ProjectStatus` | Current project status |
| `flag_count` | `u32` | Number of public audit flags raised |
| `token` | `Address` | Token contract used for escrow (native XLM) |

### Milestone

| Field | Type | Description |
|---|---|---|
| `id` | `u32` | Zero-indexed milestone position |
| `description` | `String` | Description of the construction phase |
| `amount` | `i128` | XLM amount released upon verification |
| `status` | `MilestoneStatus` | Current milestone status |
| `evidence_ipfs_cid` | `String` | IPFS content hash of submitted proof |
| `approvals` | `Vec<Address>` | Verifiers who voted Approve |
| `rejections` | `Vec<Address>` | Verifiers who voted Reject |

### ProjectStatus

| Value | Meaning |
|---|---|
| `Funded` | Project created, total budget locked in Treasury |
| `InProgress` | At least one milestone proof has been submitted |
| `Completed` | All milestones verified and funds fully released |
| `Flagged` | A verifier rejection or citizen flag has been recorded |

### MilestoneStatus

| Value | Meaning |
|---|---|
| `PendingSubmission` | Awaiting contractor proof upload |
| `PendingVerification` | Proof submitted, awaiting 2-of-3 verifier votes |
| `Verified` | 2-of-3 approvals reached, funds released |
| `Rejected` | 2-of-3 rejections recorded |

---

## Functions

### `init(treasury: Address)`

| | |
|---|---|
| **Access** | Deployer only. Panics if called more than once. |
| **Description** | Sets the Treasury contract address for cross-contract fund release. Must be called once immediately after deployment. |

### `create_project(funder, name, contractor, verifiers, milestone_descriptions, milestones_amounts, token)`

| | |
|---|---|
| **Access** | Any wallet. Requires funder authorization. |
| **Description** | Creates a new project and transfers the total milestone budget from the funder's wallet to the Treasury escrow atomically. Verifiers must be exactly 3 addresses. All milestone amounts must be positive. |

### `submit_proof(caller, project_id, milestone_id, evidence_ipfs_cid)`

| | |
|---|---|
| **Access** | Registered contractor only. |
| **Description** | Attaches an IPFS CID as evidence for a specific milestone. Changes milestone status from `PendingSubmission` to `PendingVerification`. Panics if called by any address other than the registered contractor, or if the CID is empty, or if the milestone is already verified. |

### `verify_milestone(caller, project_id, milestone_id, approve)`

| | |
|---|---|
| **Access** | Registered verifiers only. Each verifier may vote once. |
| **Description** | Casts an approve or reject vote on a pending milestone. On reaching 2 approve votes, sets milestone status to `Verified` and cross-invokes `Treasury.release()` to send funds to the contractor. On reaching 2 reject votes, sets milestone status to `Rejected` and project status to `Flagged`. |

### `flag_project(caller, project_id)`

| | |
|---|---|
| **Access** | Any wallet. Requires caller authorization. |
| **Description** | Increments the project's `flag_count` by 1 and sets project status to `Flagged` if not already `Completed`. Flags are permanent and publicly visible. |

### `get_project(project_id)`

| | |
|---|---|
| **Access** | Read-only. No authorization required. |
| **Description** | Returns the full `Project` struct including all milestone data, verifier addresses, and current status. |

### `get_project_count()`

| | |
|---|---|
| **Access** | Read-only. |
| **Description** | Returns the total number of projects created. Used by the frontend to paginate project loading. |

### `get_treasury()`

| | |
|---|---|
| **Access** | Read-only. |
| **Description** | Returns the configured Treasury contract address. |

---

## Storage

| Key | Type | Scope | Description |
|---|---|---|---|
| `Treasury` | `Address` | Instance | Treasury contract address set on init |
| `ProjectCount` | `u32` | Instance | Running total of created projects |
| `Project(id)` | `Project` | Persistent | Full project struct keyed by project ID |

---

## Tests

Two tests cover the full contract behavior. Run with:

```bash
cargo test -p registry
```

### `test_registry_full_workflow`

Covers the complete happy path end to end:

1. Mints 100,000 tokens to a funder account
2. Deploys and initializes both Registry and Treasury contracts
3. Creates a project with 2 milestones (40,000 + 60,000)
4. Verifies the full budget transferred to Treasury on creation
5. Submits proof for milestone 0 as the contractor
6. Verifier 1 approves (1 of 3, no release yet)
7. Verifier 2 approves (2 of 3, funds released automatically)
8. Asserts contractor balance is now 40,000 and Treasury holds 60,000
9. Citizen flags the project and asserts flag count increments

### `test_unauthorized_proof_submission`

Verifies access control. An attacker wallet that is not the registered contractor attempts to submit proof. The contract panics with `unauthorized contractor`.
