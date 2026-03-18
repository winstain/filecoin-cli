# filecoin-cli

Agent-first CLI for Filecoin storage and IPFS with JSON-first output.

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
```

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
