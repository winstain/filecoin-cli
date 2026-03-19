export class FilecoinRpcError extends Error {
  constructor(
    public code: number,
    message: string,
  ) {
    super(message);
    this.name = 'FilecoinRpcError';
  }
}

export class FilecoinClient {
  constructor(
    private rpcUrl: string,
    private ipfsGateway: string,
  ) {}

  private async rpc(method: string, params: unknown[] = []): Promise<any> {
    const res = await fetch(this.rpcUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', method, params, id: 1 }),
    });

    if (!res.ok) {
      throw new FilecoinRpcError(res.status, `HTTP ${res.status}: ${res.statusText}`);
    }

    const json = await res.json() as any;
    if (json.error) {
      throw new FilecoinRpcError(json.error.code || -1, json.error.message || 'RPC error');
    }

    return json.result;
  }

  // Chain methods

  async getChainHead(): Promise<{
    height: number;
    blocks: Array<{ miner: string; timestamp: number }>;
  }> {
    const result = await this.rpc('Filecoin.ChainHead');
    return {
      height: result.Height,
      blocks: (result.Blocks || []).map((b: any) => ({
        miner: b.Miner,
        timestamp: b.Timestamp,
      })),
    };
  }

  async getNetworkVersion(): Promise<number> {
    const result = await this.rpc('Filecoin.StateNetworkVersion', [null]);
    return result;
  }

  async getNetworkName(): Promise<string> {
    return await this.rpc('Filecoin.StateNetworkName');
  }

  // Actor / address methods

  async getBalance(address: string): Promise<string> {
    return await this.rpc('Filecoin.WalletBalance', [address]);
  }

  async lookupAddress(address: string): Promise<string> {
    return await this.rpc('Filecoin.StateLookupID', [address, null]);
  }

  async getMessageNonce(address: string): Promise<number> {
    return await this.rpc('Filecoin.MpoolGetNonce', [address]);
  }

  async estimateMessageGas(message: {
    Version: number;
    To: string;
    From: string;
    Nonce: number;
    Value: string;
    GasLimit: number;
    GasFeeCap: string;
    GasPremium: string;
    Method: number;
    Params: string;
  }): Promise<{ GasLimit: number; GasFeeCap: string; GasPremium: string }> {
    return await this.rpc('Filecoin.GasEstimateMessageGas', [message, { MaxFee: '0' }, null]);
  }

  async getActorInfo(address: string): Promise<{ code: string; head: string; nonce: number; balance: string }> {
    const result = await this.rpc('Filecoin.StateGetActor', [address, null]);
    return {
      code: result.Code['/'],
      head: result.Head['/'],
      nonce: result.Nonce,
      balance: result.Balance,
    };
  }

  // Storage methods

  async getMinerInfo(minerAddress: string): Promise<{
    owner: string;
    worker: string;
    sectorSize: number;
    peerID: string;
  }> {
    const result = await this.rpc('Filecoin.StateMinerInfo', [minerAddress, null]);
    return {
      owner: result.Owner,
      worker: result.Worker,
      sectorSize: result.SectorSize,
      peerID: result.PeerId || '',
    };
  }

  async getMinerPower(minerAddress: string): Promise<{
    minerPower: string;
    totalPower: string;
    hasMinPower: boolean;
  }> {
    const result = await this.rpc('Filecoin.StateMinerPower', [minerAddress, null]);
    return {
      minerPower: result.MinerPower?.QualityAdjPower || '0',
      totalPower: result.TotalPower?.QualityAdjPower || '0',
      hasMinPower: result.HasMinPower || false,
    };
  }

  // IPFS methods

  async resolveIpfs(cid: string): Promise<{ url: string; contentType: string | null; size: number | null }> {
    const url = `${this.ipfsGateway}/ipfs/${cid}`;
    const res = await fetch(url, { method: 'HEAD' });
    if (!res.ok) {
      throw new Error(`IPFS gateway returned ${res.status} for CID: ${cid}`);
    }
    return {
      url,
      contentType: res.headers.get('content-type'),
      size: res.headers.get('content-length') ? parseInt(res.headers.get('content-length')!, 10) : null,
    };
  }

  async fetchIpfs(cid: string): Promise<string> {
    const url = `${this.ipfsGateway}/ipfs/${cid}`;
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`IPFS gateway returned ${res.status} for CID: ${cid}`);
    }
    return await res.text();
  }

  // Gas methods

  async getBaseFee(): Promise<string> {
    const head = await this.rpc('Filecoin.ChainHead');
    if (head.Blocks && head.Blocks.length > 0) {
      return head.Blocks[0].ParentBaseFee || '0';
    }
    return '0';
  }
}
