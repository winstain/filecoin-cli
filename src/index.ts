#!/usr/bin/env node

import { Command } from 'commander';
import { makeChainCommand } from './commands/chain';
import { makeBalanceCommand } from './commands/balance';
import { makeMinerCommand } from './commands/miner';
import { makeActorCommand } from './commands/actor';
import { makeIpfsCommand } from './commands/ipfs';
import { makeAddressCommand } from './commands/address';
import { makeMessageCommand, makeTransferCommand } from './commands/message';

const pkg = require('../package.json');

const program = new Command();

program
  .name('filecoin')
  .description('Agent-first CLI for Filecoin and IPFS. JSON output by default.')
  .version(pkg.version);

program.addCommand(makeChainCommand());
program.addCommand(makeBalanceCommand());
program.addCommand(makeMinerCommand());
program.addCommand(makeActorCommand());
program.addCommand(makeIpfsCommand());
program.addCommand(makeAddressCommand());
program.addCommand(makeMessageCommand());
program.addCommand(makeTransferCommand());

// MCP server subcommand
program
  .command('mcp')
  .description('Start MCP server over stdio (for Claude Desktop, Claude Code, etc.)')
  .action(async () => {
    const { startMcpServer } = await import('./mcp');
    await startMcpServer();
  });

program.parse();
