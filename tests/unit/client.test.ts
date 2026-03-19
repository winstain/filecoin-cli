import { FilecoinClient, FilecoinRpcError } from '../../src/api/client';

const mockFetch = jest.fn();
global.fetch = mockFetch as any;

describe('FilecoinClient', () => {
  let client: FilecoinClient;

  beforeEach(() => {
    client = new FilecoinClient('https://rpc.test', 'https://ipfs.test');
    jest.clearAllMocks();
  });

  function mockRpcResponse(result: any) {
    mockFetch.mockResolvedValue({ ok: true, json: () => Promise.resolve({ jsonrpc: '2.0', result, id: 1 }) });
  }

  function mockRpcError(code: number, message: string) {
    mockFetch.mockResolvedValue({ ok: true, json: () => Promise.resolve({ jsonrpc: '2.0', error: { code, message }, id: 1 }) });
  }

  describe('getChainHead', () => {
    test('returns height and blocks', async () => {
      mockRpcResponse({ Height: 1000, Blocks: [{ Miner: 'f01234', Timestamp: 1700000000 }] });
      const result = await client.getChainHead();
      expect(result.height).toBe(1000);
      expect(result.blocks[0].miner).toBe('f01234');
    });

    test('handles empty blocks', async () => {
      mockRpcResponse({ Height: 500, Blocks: [] });
      const result = await client.getChainHead();
      expect(result.blocks).toEqual([]);
    });

    test('handles missing Blocks', async () => {
      mockRpcResponse({ Height: 500 });
      const result = await client.getChainHead();
      expect(result.blocks).toEqual([]);
    });
  });

  describe('getNetworkVersion', () => {
    test('returns version number', async () => {
      mockRpcResponse(27);
      expect(await client.getNetworkVersion()).toBe(27);
    });
  });

  describe('getNetworkName', () => {
    test('returns network name', async () => {
      mockRpcResponse('mainnet');
      expect(await client.getNetworkName()).toBe('mainnet');
    });
  });

  describe('getBalance', () => {
    test('returns balance string', async () => {
      mockRpcResponse('1000000000000000000');
      expect(await client.getBalance('f01234')).toBe('1000000000000000000');
    });
  });

  describe('lookupAddress', () => {
    test('returns ID address', async () => {
      mockRpcResponse('f01234');
      expect(await client.lookupAddress('f3xxx')).toBe('f01234');
    });
  });

  describe('getActorInfo', () => {
    test('returns actor data', async () => {
      mockRpcResponse({ Code: { '/': 'bafk...' }, Head: { '/': 'bafy...' }, Nonce: 5, Balance: '100' });
      const result = await client.getActorInfo('f01234');
      expect(result.code).toBe('bafk...');
      expect(result.nonce).toBe(5);
    });
  });

  describe('getMessageNonce', () => {
    test('returns mempool nonce', async () => {
      mockRpcResponse(12);
      expect(await client.getMessageNonce('f1from')).toBe(12);
    });
  });

  describe('estimateMessageGas', () => {
    test('returns estimated gas fields', async () => {
      mockRpcResponse({ GasLimit: 101325, GasFeeCap: '100', GasPremium: '3' });
      const result = await client.estimateMessageGas({ Version: 0, To: 'f1to', From: 'f1from', Nonce: 1, Value: '10', GasLimit: 0, GasFeeCap: '0', GasPremium: '0', Method: 0, Params: '' });
      expect(result.GasLimit).toBe(101325);
      expect(result.GasFeeCap).toBe('100');
      expect(result.GasPremium).toBe('3');
    });
  });

  describe('getMinerInfo', () => {
    test('returns miner data', async () => {
      mockRpcResponse({ Owner: 'f01', Worker: 'f02', SectorSize: 34359738368, PeerId: 'peer123' });
      const result = await client.getMinerInfo('f01234');
      expect(result.owner).toBe('f01');
      expect(result.sectorSize).toBe(34359738368);
    });

    test('handles missing PeerId', async () => {
      mockRpcResponse({ Owner: 'f01', Worker: 'f02', SectorSize: 1024 });
      const result = await client.getMinerInfo('f01234');
      expect(result.peerID).toBe('');
    });
  });

  describe('getMinerPower', () => {
    test('returns power data', async () => {
      mockRpcResponse({
        MinerPower: { QualityAdjPower: '1000' },
        TotalPower: { QualityAdjPower: '99999' },
        HasMinPower: true,
      });
      const result = await client.getMinerPower('f01234');
      expect(result.minerPower).toBe('1000');
      expect(result.hasMinPower).toBe(true);
    });

    test('handles missing power fields', async () => {
      mockRpcResponse({ MinerPower: null, TotalPower: null, HasMinPower: false });
      const result = await client.getMinerPower('f01234');
      expect(result.minerPower).toBe('0');
      expect(result.totalPower).toBe('0');
    });
  });

  describe('getBaseFee', () => {
    test('returns base fee from first block', async () => {
      mockRpcResponse({ Height: 1000, Blocks: [{ ParentBaseFee: '100' }] });
      expect(await client.getBaseFee()).toBe('100');
    });

    test('returns 0 if no blocks', async () => {
      mockRpcResponse({ Height: 1000, Blocks: [] });
      expect(await client.getBaseFee()).toBe('0');
    });

    test('returns 0 if missing ParentBaseFee', async () => {
      mockRpcResponse({ Height: 1000, Blocks: [{}] });
      expect(await client.getBaseFee()).toBe('0');
    });
  });

  describe('resolveIpfs', () => {
    test('returns URL and headers', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        headers: new Map([['content-type', 'application/json'], ['content-length', '1234']]),
      });
      // Override headers.get
      mockFetch.mockResolvedValue({
        ok: true,
        headers: { get: (k: string) => k === 'content-type' ? 'application/json' : k === 'content-length' ? '1234' : null },
      });
      const result = await client.resolveIpfs('QmTest');
      expect(result.url).toBe('https://ipfs.test/ipfs/QmTest');
      expect(result.contentType).toBe('application/json');
      expect(result.size).toBe(1234);
    });

    test('handles missing content-length header', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        headers: { get: (k: string) => k === 'content-type' ? 'text/html' : null },
      });
      const result = await client.resolveIpfs('QmNoSize');
      expect(result.size).toBeNull();
      expect(result.contentType).toBe('text/html');
    });

    test('throws on non-ok response', async () => {
      mockFetch.mockResolvedValue({ ok: false, status: 404 });
      await expect(client.resolveIpfs('QmBad')).rejects.toThrow('404');
    });
  });

  describe('fetchIpfs', () => {
    test('returns text content', async () => {
      mockFetch.mockResolvedValue({ ok: true, text: () => Promise.resolve('hello world') });
      expect(await client.fetchIpfs('QmTest')).toBe('hello world');
    });

    test('throws on non-ok response', async () => {
      mockFetch.mockResolvedValue({ ok: false, status: 500 });
      await expect(client.fetchIpfs('QmBad')).rejects.toThrow('500');
    });
  });

  describe('RPC error handling', () => {
    test('throws on HTTP error', async () => {
      mockFetch.mockResolvedValue({ ok: false, status: 500, statusText: 'Internal Server Error' });
      await expect(client.getNetworkName()).rejects.toThrow('HTTP 500');
    });

    test('throws on JSON-RPC error', async () => {
      mockRpcError(-32000, 'method not found');
      await expect(client.getNetworkName()).rejects.toThrow('method not found');
    });

    test('uses default code -1 when error.code missing', async () => {
      mockFetch.mockResolvedValue({ ok: true, json: () => Promise.resolve({ jsonrpc: '2.0', error: { message: 'bad' }, id: 1 }) });
      try { await client.getNetworkName(); } catch (e: any) { expect(e.code).toBe(-1); }
    });

    test('uses default message when error.message missing', async () => {
      mockFetch.mockResolvedValue({ ok: true, json: () => Promise.resolve({ jsonrpc: '2.0', error: { code: 42 }, id: 1 }) });
      await expect(client.getNetworkName()).rejects.toThrow('RPC error');
    });

    test('FilecoinRpcError has code', () => {
      const err = new FilecoinRpcError(500, 'test');
      expect(err.code).toBe(500);
      expect(err.name).toBe('FilecoinRpcError');
    });
  });
});
