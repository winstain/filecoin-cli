# filecoin-cli

Agent-first CLI for Filecoin storage, IPFS, and unsigned transaction building with JSON-first output.

## Install

```bash
npm install -g filecoin-cli
```

## Usage

```bash
filecoin --help
filecoin chain head
filecoin balance <address>
filecoin miner info <minerId>
filecoin actor state <actorId>
filecoin ipfs cid <input>
filecoin address validate <address>
filecoin transfer --from f1... --to f1... --value 1000000000000000000
filecoin message build --from f1... --to f01234 --value 0 --method 2 --params <base64>
filecoin store --from f1... --to f01234 --method 2 --params <base64> --cid bafy...
filecoin retrieve --cid bafy...
```

## Transaction building

`filecoin transfer` and `filecoin message build` output a stable JSON envelope for MoonPay handoff:

```json
{
  "chain": "filecoin",
  "network": "mainnet",
  "kind": "filecoin_unsigned_message",
  "message": {
    "Version": 0,
    "To": "f01234",
    "From": "f1sender...",
    "Nonce": 12,
    "Value": "1000000000000000000",
    "GasLimit": 101325,
    "GasFeeCap": "100",
    "GasPremium": "3",
    "Method": 0,
    "Params": ""
  },
  "moonpay": {
    "chain": "filecoin",
    "payloadType": "filecoin_unsigned_message",
    "transaction": { "...": "same as message" },
    "signer": "moonpay-cli@>=1.12.1"
  }
}
```

Notes:
- `transfer` is just a method `0` message with empty params.
- `store` is the higher-level storage-oriented entrypoint built on top of the same unsigned message machinery; it adds storage intent/context (`--cid`, `--provider`) while still returning a signer-friendly payload.
- `retrieve` is the higher-level content retrieval entrypoint; it wraps the current IPFS/Filecoin read path and can either resolve metadata or fetch content.
- If nonce/gas fields are omitted, the CLI fetches/estimates them from the configured Filecoin RPC.
- `message build` remains the bare-metal escape hatch for actor calls: you provide `--method` and base64 `--params` exactly as Filecoin expects.

## Development

```bash
npm ci
npm run build
npm test
```

## MCP server

```bash
filecoin mcp
```

Starts the MCP server over stdio for agent/tool integrations.
