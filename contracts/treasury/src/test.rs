#![cfg(test)]

use super::*;
use soroban_sdk::{testutils::Address as _, token, Address, Env};

#[test]
fn test_treasury_init_and_release() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let token_admin = Address::generate(&env);
    let contractor = Address::generate(&env);

    let token_contract = env.register_stellar_asset_contract_v2(token_admin.clone());
    let token_address = token_contract.address();
    let token_client = token::Client::new(&env, &token_address);
    let token_admin_client = token::StellarAssetClient::new(&env, &token_address);

    let treasury_id = env.register(TreasuryContract, ());
    let treasury_client = TreasuryContractClient::new(&env, &treasury_id);

    treasury_client.init(&admin, &token_address);

    assert_eq!(treasury_client.get_admin(), admin);
    assert_eq!(treasury_client.get_token(), token_address);

    // Mint tokens to Treasury
    token_admin_client.mint(&treasury_id, &1000);
    assert_eq!(token_client.balance(&treasury_id), 1000);

    // Admin releases 500 to contractor
    treasury_client.release(&contractor, &500);

    assert_eq!(token_client.balance(&treasury_id), 500);
    assert_eq!(token_client.balance(&contractor), 500);
}
