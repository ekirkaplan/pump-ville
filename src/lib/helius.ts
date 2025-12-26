import axios from 'axios';
import dns from 'dns';
import https from 'https';
import { Connection, PublicKey } from '@solana/web3.js';
import { AccountLayout, MintLayout, TOKEN_PROGRAM_ID, u64 } from '@solana/spl-token';
import { Holder } from './types';

const TOKEN_2022_PROGRAM_ID = new PublicKey(
  'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb'
);

const normalizeRpcUrl = (rawUrl: string, label: string) => {
  const trimmed = rawUrl.trim();
  const stripped = trimmed.replace(/^['"]|['"]$/g, '');
  const sanitized = stripped.replace(/\s+/g, '');

  if (!sanitized.startsWith('https://') && !sanitized.startsWith('http://')) {
    throw new Error(`${label} must start with https://`);
  }

  let url: URL;
  try {
    url = new URL(sanitized);
  } catch {
    throw new Error(`${label} is invalid`);
  }

  return url.toString();
};

const getHeliusRpcUrls = () => {
  const rawUrl = process.env.HELIUS_RPC_URL;
  if (!rawUrl) {
    throw new Error('HELIUS_RPC_URL environment variable is not set');
  }

  const primaryUrl = normalizeRpcUrl(rawUrl, 'HELIUS_RPC_URL');
  const urls = [primaryUrl];

  const primaryHost = new URL(primaryUrl).hostname.toLowerCase();
  if (primaryHost === 'rpc.helius.xyz') {
    const alt = new URL(primaryUrl);
    alt.hostname = 'mainnet.helius-rpc.com';
    urls.push(alt.toString());
  } else if (primaryHost === 'mainnet.helius-rpc.com') {
    const alt = new URL(primaryUrl);
    alt.hostname = 'rpc.helius.xyz';
    urls.push(alt.toString());
  }

  const extraFallbacks = [
    process.env.SOLANA_RPC_FALLBACK_URL,
    process.env.SOLANA_RPC_URL,
    'https://api.mainnet-beta.solana.com',
  ];

  for (const fallback of extraFallbacks) {
    if (!fallback) {
      continue;
    }
    try {
      const normalized = normalizeRpcUrl(fallback, 'RPC fallback URL');
      urls.push(normalized);
    } catch {
      continue;
    }
  }

  return Array.from(new Set(urls));
};

if (typeof dns.setDefaultResultOrder === 'function') {
  dns.setDefaultResultOrder('ipv4first');
}
const httpsAgent = new https.Agent({ keepAlive: true });

const normalizeHeaders = (headers?: HeadersInit): Record<string, string> => {
  if (!headers) {
    return {};
  }
  if (headers instanceof Headers) {
    const output: Record<string, string> = {};
    headers.forEach((value, key) => {
      output[key] = value;
    });
    return output;
  }
  if (Array.isArray(headers)) {
    const output: Record<string, string> = {};
    for (const [key, value] of headers) {
      output[key] = String(value);
    }
    return output;
  }
  const output: Record<string, string> = {};
  for (const [key, value] of Object.entries(headers)) {
    output[key] = String(value);
  }
  return output;
};

const axiosFetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
  const method = init?.method || (typeof input !== 'string' && !(input instanceof URL) ? input.method : undefined) || 'GET';
  const headers = {
    ...(typeof input !== 'string' && !(input instanceof URL) ? normalizeHeaders(input.headers) : {}),
    ...normalizeHeaders(init?.headers),
  };

  const response = await axios({
    url,
    method,
    headers,
    data: init?.body,
    timeout: 15000,
    responseType: 'text',
    validateStatus: () => true,
    httpsAgent,
  });

  const responseHeaders = new Headers();
  for (const [key, value] of Object.entries(response.headers || {})) {
    if (Array.isArray(value)) {
      responseHeaders.set(key, value.join(', '));
    } else if (value != null) {
      responseHeaders.set(key, String(value));
    }
  }

  const body = typeof response.data === 'string' ? response.data : JSON.stringify(response.data ?? {});
  return new Response(body, {
    status: response.status,
    statusText: response.statusText,
    headers: responseHeaders,
  });
};

export async function getHolders({ 
  mint, 
  min = 10000 
}: { 
  mint: string; 
  min: number; 
}): Promise<Holder[]> {
  const rpcUrls = getHeliusRpcUrls();

  const fetchWithConnection = async (connection: Connection) => {
    const mintPubkey = new PublicKey(mint);
    
    const mintAccountInfo = await connection.getAccountInfo(mintPubkey);
    if (!mintAccountInfo) {
      throw new Error(`Mint account not found: ${mintPubkey.toBase58()}`);
    }

    let tokenProgramId = TOKEN_PROGRAM_ID;
    if (mintAccountInfo.owner.equals(TOKEN_2022_PROGRAM_ID)) {
      tokenProgramId = TOKEN_2022_PROGRAM_ID;
    } else if (!mintAccountInfo.owner.equals(TOKEN_PROGRAM_ID)) {
      throw new Error(
        `Unsupported mint owner program: ${mintAccountInfo.owner.toBase58()}`
      );
    }

    // Get mint info to get decimals
    const mintData = MintLayout.decode(mintAccountInfo.data);
    const decimals = mintData.decimals as number;

    // Get all token accounts for this mint
    const filters = [
      {
        memcmp: {
          offset: 0, // mint field offset
          bytes: mintPubkey.toBase58(),
        },
      },
    ];

    if (tokenProgramId.equals(TOKEN_PROGRAM_ID)) {
      filters.unshift({
        dataSize: AccountLayout.span, // Token account size
      });
    }

    const accounts = await connection.getProgramAccounts(tokenProgramId, {
      filters,
    });

    const holders: Holder[] = [];

    for (const account of accounts) {
      try {
        const accountData = AccountLayout.decode(account.account.data);
        const amount = u64.fromBuffer(accountData.amount);
        const state = accountData.state as number;

        // Skip frozen or uninitialized accounts and 0 balances
        if (state !== 1 || amount.isZero()) {
          continue;
        }

        const uiAmount = Number(amount.toString()) / Math.pow(10, decimals);

        // Filter by minimum amount
        if (uiAmount >= min) {
          holders.push({
            owner: new PublicKey(accountData.owner).toBase58(),
            amount: amount.toString(),
            uiAmount: uiAmount,
          });
        }
      } catch (error) {
        console.error('Error parsing account data:', error);
        continue;
      }
    }

    return holders;
  };

  for (let i = 0; i < rpcUrls.length; i += 1) {
    const rpcUrl = rpcUrls[i];
    try {
      const connection = new Connection(rpcUrl, {
        commitment: 'confirmed',
        fetch: axiosFetch,
      });
      return await fetchWithConnection(connection);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const isTlsError = message.includes('SSL') || message.includes('tlsv1');
      const isNetworkError =
        message.includes('ECONNRESET') ||
        message.includes('ENOTFOUND') ||
        message.includes('EAI_AGAIN') ||
        message.includes('fetch failed') ||
        message.includes('socket');
      const shouldRetry = (isTlsError || isNetworkError) && i < rpcUrls.length - 1;

      if (shouldRetry) {
        continue;
      }

      let host = rpcUrl;
      try {
        host = new URL(rpcUrl).hostname;
      } catch {
        // ignore
      }

      console.error(`Error fetching holders from ${host}:`, error);
      throw error;
    }
  }

  throw new Error('Failed to fetch holders from all RPC endpoints');
}
