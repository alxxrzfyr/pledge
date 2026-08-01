#![cfg(test)]

use super::*;
use treasury::{TreasuryContract, TreasuryContractClient};
use soroban_sdk::{
    testutils::Address as _, token, Address, Env, String, Vec,
};

#[test]
fn test_registry_full_workflow() {
    let env = Env::default();
    env.mock_all_auths();

    // Accounts
    let funder = Address::generate(&env);
    let contractor = Address::generate(&env);
    let verifier1 = Address::generate(&env);
    let verifier2 = Address::generate(&env);
    let verifier3 = Address::generate(&env);
    let citizen = Address::generate(&env);

    // Setup Token
    let token_admin = Address::generate(&env);
    let token_contract = env.register_stellar_asset_contract_v2(token_admin.clone());
    let token_address = token_contract.address();
    let token_client = token::Client::new(&env, &token_address);
    let token_admin_client = token::StellarAssetClient::new(&env, &token_address);

    // Mint 100,000 to Funder
    token_admin_client.mint(&funder, &100_000);
    assert_eq!(token_client.balance(&funder), 100_000);

    // Setup Contracts
    let registry_id = env.register(RegistryContract, ());
    let registry_client = RegistryContractClient::new(&env, &registry_id);

    let treasury_id = env.register(TreasuryContract, ());
    let treasury_client = TreasuryContractClient::new(&env, &treasury_id);
    treasury_client.init(&registry_id, &token_address);

    registry_client.init(&treasury_id);

    // 1. Create Project
    let mut verifiers = Vec::new(&env);
    verifiers.push_back(verifier1.clone());
    verifiers.push_back(verifier2.clone());
    verifiers.push_back(verifier3.clone());

    let mut m_desc = Vec::new(&env);
    m_desc.push_back(String::from_str(&env, "Foundation excavation"));
    m_desc.push_back(String::from_str(&env, "Structural concrete poured"));

    let mut m_amounts = Vec::new(&env);
    m_amounts.push_back(40_000);
    m_amounts.push_back(60_000);

    let proj_id = registry_client.create_project(
        &funder,
        &String::from_str(&env, "Barangay Health Center"),
        &contractor,
        &verifiers,
        &m_desc,
        &m_amounts,
        &token_address,
    );

    assert_eq!(proj_id, 1);
    // Check Treasury token balance is now 100,000
    assert_eq!(token_client.balance(&treasury_id), 100_000);
    assert_eq!(token_client.balance(&funder), 0);

    let proj = registry_client.get_project(&proj_id);
    assert_eq!(proj.status, ProjectStatus::Funded);
    assert_eq!(proj.milestones.len(), 2);

    // 2. Submit Proof for Milestone 0
    let cid1 = String::from_str(&env, "QmTestProofHash1111111111111111111111111111111");
    registry_client.submit_proof(&contractor, &proj_id, &0, &cid1);

    let proj_after_sub = registry_client.get_project(&proj_id);
    assert_eq!(proj_after_sub.status, ProjectStatus::InProgress);
    assert_eq!(
        proj_after_sub.milestones.get(0).unwrap().status,
        MilestoneStatus::PendingVerification
    );

    // 3. Verifier 1 votes Approve (1/3 approvals)
    registry_client.verify_milestone(&verifier1, &proj_id, &0, &true);

    let proj_v1 = registry_client.get_project(&proj_id);
    assert_eq!(
        proj_v1.milestones.get(0).unwrap().status,
        MilestoneStatus::PendingVerification
    );
    assert_eq!(token_client.balance(&contractor), 0);

    // 4. Verifier 2 votes Approve (2/3 approvals -> Verified & Released)
    registry_client.verify_milestone(&verifier2, &proj_id, &0, &true);

    let proj_v2 = registry_client.get_project(&proj_id);
    assert_eq!(
        proj_v2.milestones.get(0).unwrap().status,
        MilestoneStatus::Verified
    );
    // Contractor balance should now be 40,000!
    assert_eq!(token_client.balance(&contractor), 40_000);
    assert_eq!(token_client.balance(&treasury_id), 60_000);

    // 5. Flag Project by Citizen
    registry_client.flag_project(&citizen, &proj_id);
    let proj_flagged = registry_client.get_project(&proj_id);
    assert_eq!(proj_flagged.flag_count, 1);
    assert_eq!(proj_flagged.status, ProjectStatus::Flagged);
}

#[test]
#[should_panic(expected = "unauthorized contractor")]
fn test_unauthorized_proof_submission() {
    let env = Env::default();
    env.mock_all_auths();

    let funder = Address::generate(&env);
    let contractor = Address::generate(&env);
    let attacker = Address::generate(&env);
    let verifier1 = Address::generate(&env);
    let verifier2 = Address::generate(&env);
    let verifier3 = Address::generate(&env);

    let token_admin = Address::generate(&env);
    let token_contract = env.register_stellar_asset_contract_v2(token_admin.clone());
    let token_address = token_contract.address();
    let token_admin_client = token::StellarAssetClient::new(&env, &token_address);
    token_admin_client.mint(&funder, &100_000);

    let registry_id = env.register(RegistryContract, ());
    let registry_client = RegistryContractClient::new(&env, &registry_id);

    let treasury_id = env.register(TreasuryContract, ());
    let treasury_client = TreasuryContractClient::new(&env, &treasury_id);
    treasury_client.init(&registry_id, &token_address);
    registry_client.init(&treasury_id);

    let mut verifiers = Vec::new(&env);
    verifiers.push_back(verifier1);
    verifiers.push_back(verifier2);
    verifiers.push_back(verifier3);

    let mut m_desc = Vec::new(&env);
    m_desc.push_back(String::from_str(&env, "Phase 1"));
    let mut m_amounts = Vec::new(&env);
    m_amounts.push_back(100_000);

    let proj_id = registry_client.create_project(
        &funder,
        &String::from_str(&env, "Road Paving"),
        &contractor,
        &verifiers,
        &m_desc,
        &m_amounts,
        &token_address,
    );

    // Attacker tries to submit proof
    let cid = String::from_str(&env, "QmFakeProof");
    registry_client.submit_proof(&attacker, &proj_id, &0, &cid);
}
