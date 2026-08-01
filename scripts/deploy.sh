#!/usr/bin/env bash
set -e

echo "=== Building Soroban Contracts ==="
cargo build --target wasm32-unknown-unknown --release

RPC_URL=${NEXT_PUBLIC_SOROBAN_RPC_URL:-"https://soroban-testnet.stellar.org"}
NETWORK_PASSPHRASE=${NEXT_PUBLIC_NETWORK_PASSPHRASE:-"Test SDF Network ; September 2015"}

echo "=== Deployment Helper Script ==="
echo "Target Network RPC: $RPC_URL"
echo "Target Network Passphrase: $NETWORK_PASSPHRASE"

# Check if soroban CLI is installed
if command -v soroban &> /dev/null; then
    echo "Deploying Treasury contract..."
    TREASURY_ID=$(soroban contract deploy \
        --wasm target/wasm32-unknown-unknown/release/treasury.wasm \
        --source S... \
        --rpc-url "$RPC_URL" \
        --network-passphrase "$NETWORK_PASSPHRASE")

    echo "Treasury Deployed: $TREASURY_ID"

    echo "Deploying Registry contract..."
    REGISTRY_ID=$(soroban contract deploy \
        --wasm target/wasm32-unknown-unknown/release/registry.wasm \
        --source S... \
        --rpc-url "$RPC_URL" \
        --network-passphrase "$NETWORK_PASSPHRASE")

    echo "Registry Deployed: $REGISTRY_ID"

    echo "NEXT_PUBLIC_TREASURY_CONTRACT_ID=$TREASURY_ID" > frontend/.env.local
    echo "NEXT_PUBLIC_REGISTRY_CONTRACT_ID=$REGISTRY_ID" >> frontend/.env.local
    echo "NEXT_PUBLIC_SOROBAN_RPC_URL=$RPC_URL" >> frontend/.env.local
    echo "NEXT_PUBLIC_NETWORK_PASSPHRASE=$NETWORK_PASSPHRASE" >> frontend/.env.local
else
    echo "Soroban CLI not found. WASM binaries built successfully at target/wasm32-unknown-unknown/release/"
fi
