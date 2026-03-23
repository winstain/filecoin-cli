import { Command } from 'commander';
import { FilecoinClient } from '../api/client';
import { getRpcUrl, getIpfsGateway } from '../config/store';
import { header, row, jsonError } from '../utils/format';

type UnsignedFilecoinMessage = {
  Version: 0;
  To: string;
  From: string;
  Nonce: number;
  Value: string;
  GasLimit: number;
  GasFeeCap: string;
  GasPremium: string;
  Method: number;
  Params: string;
};

function parseNonNegativeInteger(value: string, field: string): number {
  if (!/^\d+$/.test(value)) {
    throw new Error(`Invalid ${field}. Must be a non-negative integer.`);
  }

  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed)) {
    throw new Error(`Invalid ${field}. Must be a safe integer.`);
  }

  return parsed;
}

function parseAttoFil(value: string, field: string): string {
  if (!/^\d+$/.test(value)) {
    throw new Error(`Invalid ${field}. Must be a non-negative integer string in attoFIL.`);
  }

  return value;
}

function normalizeEstimatedMessage(message: Record<string, unknown>): Pick<UnsignedFilecoinMessage, 'GasLimit' | 'GasFeeCap' | 'GasPremium'> {
  return {
    GasLimit: typeof message.GasLimit === 'number' ? message.GasLimit : 0,
    GasFeeCap: typeof message.GasFeeCap === 'string' ? message.GasFeeCap : '0',
    GasPremium: typeof message.GasPremium === 'string' ? message.GasPremium : '0',
  };
}

export async function buildUnsignedMessage(client: FilecoinClient, input: {
  from: string;
  to: string;
  value: string;
  method: string;
  params: string;
  nonce?: string;
  gasLimit?: string;
  gasFeeCap?: string;
  gasPremium?: string;
}): Promise<UnsignedFilecoinMessage> {
  const nonce = input.nonce != null
    ? parseNonNegativeInteger(input.nonce, 'nonce')
    : await client.getMessageNonce(input.from);

  const message: UnsignedFilecoinMessage = {
    Version: 0,
    To: input.to,
    From: input.from,
    Nonce: nonce,
    Value: parseAttoFil(input.value, 'value'),
    GasLimit: input.gasLimit != null ? parseNonNegativeInteger(input.gasLimit, 'gas limit') : 0,
    GasFeeCap: input.gasFeeCap != null ? parseAttoFil(input.gasFeeCap, 'gas fee cap') : '0',
    GasPremium: input.gasPremium != null ? parseAttoFil(input.gasPremium, 'gas premium') : '0',
    Method: parseNonNegativeInteger(input.method, 'method'),
    Params: input.params,
  };

  if (input.gasLimit == null || input.gasFeeCap == null || input.gasPremium == null) {
    const estimated = normalizeEstimatedMessage(await client.estimateMessageGas(message));
    message.GasLimit = input.gasLimit != null ? parseNonNegativeInteger(input.gasLimit, 'gas limit') : estimated.GasLimit;
    message.GasFeeCap = input.gasFeeCap != null ? parseAttoFil(input.gasFeeCap, 'gas fee cap') : estimated.GasFeeCap;
    message.GasPremium = input.gasPremium != null ? parseAttoFil(input.gasPremium, 'gas premium') : estimated.GasPremium;
  }

  return message;
}

export function toMoonPayPayload(network: string, message: UnsignedFilecoinMessage) {
  return {
    chain: 'filecoin',
    network,
    kind: 'filecoin_unsigned_message',
    message,
    moonpay: {
      chain: 'filecoin',
      payloadType: 'filecoin_unsigned_message',
      transaction: message,
      signer: 'moonpay-cli@>=1.12.1',
    },
  };
}

export function makeMessageCommand(): Command {
  const cmd = new Command('message')
    .description('Build unsigned Filecoin messages for external signing');

  cmd
    .command('build')
    .description('Build a raw unsigned Filecoin message')
    .requiredOption('--from <address>', 'Sender address')
    .requiredOption('--to <address>', 'Recipient/actor address')
    .requiredOption('--value <attoFil>', 'Value in attoFIL')
    .option('--method <method>', 'Filecoin method number', '0')
    .option('--params <base64>', 'Base64-encoded params', '')
    .option('--nonce <nonce>', 'Explicit nonce (otherwise fetched from RPC)')
    .option('--gas-limit <gasLimit>', 'Explicit gas limit (otherwise estimated from RPC)')
    .option('--gas-fee-cap <attoFil>', 'Explicit gas fee cap in attoFIL (otherwise estimated from RPC)')
    .option('--gas-premium <attoFil>', 'Explicit gas premium in attoFIL (otherwise estimated from RPC)')
    .option('--pretty', 'Human-readable colored output')
    .action(async (opts) => {
      try {
        const client = new FilecoinClient(getRpcUrl(), getIpfsGateway());
        const [network, message] = await Promise.all([
          client.getNetworkName(),
          buildUnsignedMessage(client, { ...opts, params: opts.params }),
        ]);
        const payload = toMoonPayPayload(network, message);

        if (opts.pretty) {
          header(`Unsigned Filecoin Message (${network})`);
          row('From', message.From);
          row('To', message.To);
          row('Value (attoFIL)', message.Value);
          row('Nonce', String(message.Nonce));
          row('Method', String(message.Method));
          row('Gas Limit', String(message.GasLimit));
          row('Gas Fee Cap', message.GasFeeCap);
          row('Gas Premium', message.GasPremium);
          row('Params', message.Params || '(empty)');
          row('MoonPay Payload', 'Use JSON output mode for signer handoff');
          return;
        }

        console.log(JSON.stringify(payload));
      } catch (err) {
        if (err instanceof Error) {
          jsonError(err.message, 'INVALID_INPUT', 1);
        } else {
          jsonError('Unknown error', 'UNKNOWN', 1);
        }
      }
    });

  return cmd;
}

export function makeTransferCommand(): Command {
  return new Command('transfer')
    .description('Build a simple FIL transfer message (method 0, empty params)')
    .requiredOption('--from <address>', 'Sender address')
    .requiredOption('--to <address>', 'Recipient address')
    .requiredOption('--value <attoFil>', 'Value in attoFIL')
    .option('--nonce <nonce>', 'Explicit nonce (otherwise fetched from RPC)')
    .option('--gas-limit <gasLimit>', 'Explicit gas limit (otherwise estimated from RPC)')
    .option('--gas-fee-cap <attoFil>', 'Explicit gas fee cap in attoFIL (otherwise estimated from RPC)')
    .option('--gas-premium <attoFil>', 'Explicit gas premium in attoFIL (otherwise estimated from RPC)')
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
            method: '0',
            params: '',
            nonce: opts.nonce,
            gasLimit: opts.gasLimit,
            gasFeeCap: opts.gasFeeCap,
            gasPremium: opts.gasPremium,
          }),
        ]);
        const payload = toMoonPayPayload(network, message);

        if (opts.pretty) {
          header(`Unsigned FIL Transfer (${network})`);
          row('From', message.From);
          row('To', message.To);
          row('Value (attoFIL)', message.Value);
          row('Nonce', String(message.Nonce));
          row('Gas Limit', String(message.GasLimit));
          row('Gas Fee Cap', message.GasFeeCap);
          row('Gas Premium', message.GasPremium);
          return;
        }

        console.log(JSON.stringify(payload));
      } catch (err) {
        if (err instanceof Error) {
          jsonError(err.message, 'INVALID_INPUT', 1);
        } else {
          jsonError('Unknown error', 'UNKNOWN', 1);
        }
      }
    });
}
