import { Command } from 'commander';
import { FilecoinClient } from '../api/client';
import { getRpcUrl, getIpfsGateway } from '../config/store';
import { header, row, formatBytes, jsonError } from '../utils/format';
import { buildUnsignedMessage, toMoonPayPayload } from './message';

export function makeRetrieveCommand(): Command {
  return new Command('retrieve')
    .description('High-level content retrieval command (IPFS/Filecoin read path)')
    .requiredOption('--cid <cid>', 'IPFS/Filecoin content CID')
    .option('--resolve-only', 'Only resolve metadata and gateway URL')
    .option('--pretty', 'Human-readable colored output')
    .action(async (opts) => {
      try {
        const client = new FilecoinClient(getRpcUrl(), getIpfsGateway());

        if (opts.resolveOnly) {
          const info = await client.resolveIpfs(opts.cid);
          const data = {
            kind: 'filecoin_retrieve_plan',
            cid: opts.cid,
            mode: 'resolve',
            url: info.url,
            contentType: info.contentType,
            size: info.size,
            sizeHuman: info.size ? formatBytes(info.size) : null,
          };

          if (opts.pretty) {
            header(`Retrieve (resolve): ${opts.cid}`);
            row('Gateway URL', info.url);
            row('Content-Type', info.contentType || '(unknown)');
            row('Size', info.size ? formatBytes(info.size) : '(unknown)');
            return;
          }

          console.log(JSON.stringify(data));
          return;
        }

        const [info, content] = await Promise.all([
          client.resolveIpfs(opts.cid),
          client.fetchIpfs(opts.cid),
        ]);

        let parsed: unknown = null;
        try { parsed = JSON.parse(content); } catch { /* text payload */ }

        const data = {
          kind: 'filecoin_retrieve_result',
          cid: opts.cid,
          mode: 'content',
          url: info.url,
          contentType: info.contentType,
          size: info.size,
          sizeHuman: info.size ? formatBytes(info.size) : null,
          content: parsed ?? content,
          length: content.length,
        };

        if (opts.pretty) {
          header(`Retrieve: ${opts.cid}`);
          row('Gateway URL', info.url);
          row('Content-Type', info.contentType || '(unknown)');
          row('Size', info.size ? formatBytes(info.size) : '(unknown)');
          console.log('');
          console.log(parsed ? JSON.stringify(parsed, null, 2) : content.slice(0, 2000));
          if (!parsed && content.length > 2000) console.log(`\n... (${content.length} bytes total)`);
          return;
        }

        console.log(JSON.stringify(data));
      } catch (err) {
        if (err instanceof Error) {
          jsonError(err.message, 'RETRIEVE_ERROR', 1);
        } else {
          jsonError('Unknown error', 'UNKNOWN', 1);
        }
      }
    });
}

export function makeStoreCommand(): Command {
  return new Command('store')
    .description('High-level storage command for building unsigned Filecoin storage-related actor messages')
    .requiredOption('--from <address>', 'Sender address')
    .requiredOption('--to <address>', 'Recipient/actor address (storage actor, provider, or target contract)')
    .requiredOption('--method <method>', 'Filecoin method number for the storage-related call')
    .requiredOption('--params <base64>', 'Base64-encoded Filecoin params payload')
    .option('--value <attoFil>', 'Value in attoFIL', '0')
    .option('--nonce <nonce>', 'Explicit nonce (otherwise fetched from RPC)')
    .option('--gas-limit <gasLimit>', 'Explicit gas limit (otherwise estimated from RPC)')
    .option('--gas-fee-cap <attoFil>', 'Explicit gas fee cap in attoFIL (otherwise estimated from RPC)')
    .option('--gas-premium <attoFil>', 'Explicit gas premium in attoFIL (otherwise estimated from RPC)')
    .option('--cid <cid>', 'Optional content CID for operator/agent context')
    .option('--provider <miner>', 'Optional storage provider/miner for operator/agent context')
    .option('--pretty', 'Human-readable colored output')
    .action(async (opts) => {
      try {
        const client = new FilecoinClient(getRpcUrl(), getIpfsGateway());
        const [network, message] = await Promise.all([
          client.getNetworkName(),
          buildUnsignedMessage(client, {
            from: opts.from,
            to: opts.to,
            value: opts.value,
            method: opts.method,
            params: opts.params,
            nonce: opts.nonce,
            gasLimit: opts.gasLimit,
            gasFeeCap: opts.gasFeeCap,
            gasPremium: opts.gasPremium,
          }),
        ]);

        const payload = {
          ...toMoonPayPayload(network, message),
          intent: 'store',
          storage: {
            cid: opts.cid ?? null,
            provider: opts.provider ?? null,
          },
        };

        if (opts.pretty) {
          header(`Store Message (${network})`);
          row('From', message.From);
          row('To', message.To);
          row('Method', String(message.Method));
          row('Value (attoFIL)', message.Value);
          row('CID', opts.cid ?? '(none)');
          row('Provider', opts.provider ?? '(none)');
          row('Nonce', String(message.Nonce));
          row('Gas Limit', String(message.GasLimit));
          row('Gas Fee Cap', message.GasFeeCap);
          row('Gas Premium', message.GasPremium);
          return;
        }

        console.log(JSON.stringify(payload));
      } catch (err) {
        if (err instanceof Error) {
          jsonError(err.message, 'STORE_ERROR', 1);
        } else {
          jsonError('Unknown error', 'UNKNOWN', 1);
        }
      }
    });
}
