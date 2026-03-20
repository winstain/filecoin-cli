import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { FilecoinClient } from './api/client';
import { getRpcUrl, getIpfsGateway } from './config/store';
import { formatFil, formatBytes } from './utils/format';

const pkg = require('../package.json');

function getClient(): FilecoinClient {
  return new FilecoinClient(getRpcUrl(), getIpfsGateway());
}

export async function startMcpServer() {
  const server = new McpServer({ name: 'filecoin-cli', version: pkg.version });

  server.tool('filecoin_chain', 'Get Filecoin chain head info', {}, async () => {
    const client = getClient();
    const [head, networkVersion, networkName, baseFee] = await Promise.all([
      client.getChainHead(), client.getNetworkVersion(), client.getNetworkName(), client.getBaseFee(),
    ]);
    return { content: [{ type: 'text' as const, text: JSON.stringify({ network: networkName, networkVersion, height: head.height, baseFee }, null, 2) }] };
  });

  server.tool('filecoin_balance', 'Get FIL balance for an address', { address: z.string().describe('Filecoin address') }, async ({ address }) => {
    const client = getClient();
    const balance = await client.getBalance(address);
    return { content: [{ type: 'text' as const, text: JSON.stringify({ address, balance: formatFil(balance), balanceAttoFil: balance }, null, 2) }] };
  });

  server.tool('filecoin_miner', 'Get storage provider (miner) info', { address: z.string().describe('Miner address') }, async ({ address }) => {
    const client = getClient();
    const [info, power] = await Promise.all([client.getMinerInfo(address), client.getMinerPower(address)]);
    return { content: [{ type: 'text' as const, text: JSON.stringify({ ...info, ...power, sectorSizeHuman: formatBytes(info.sectorSize) }, null, 2) }] };
  });

  server.tool('filecoin_actor', 'Get actor info for a Filecoin address', { address: z.string().describe('Filecoin address') }, async ({ address }) => {
    const client = getClient();
    const actor = await client.getActorInfo(address);
    return { content: [{ type: 'text' as const, text: JSON.stringify({ ...actor, balanceFil: formatFil(actor.balance) }, null, 2) }] };
  });

  server.tool('ipfs_resolve', 'Resolve an IPFS CID via gateway', { cid: z.string().describe('IPFS CID') }, async ({ cid }) => {
    const client = getClient();
    const info = await client.resolveIpfs(cid);
    return { content: [{ type: 'text' as const, text: JSON.stringify({ cid, ...info, sizeHuman: info.size ? formatBytes(info.size) : null }, null, 2) }] };
  });

  server.tool('ipfs_cat', 'Fetch IPFS content by CID', { cid: z.string().describe('IPFS CID') }, async ({ cid }) => {
    const client = getClient();
    const content = await client.fetchIpfs(cid);
    let parsed: any = null;
    try { parsed = JSON.parse(content); } catch { /* not JSON */ }
    return { content: [{ type: 'text' as const, text: JSON.stringify({ cid, content: parsed || content }, null, 2) }] };
  });

  const transport = new StdioServerTransport();
  await server.connect(transport);
}
