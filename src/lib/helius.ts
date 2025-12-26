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

// Vercel uyumlu fetch wrapper - timeout destekli
const fetchWithTimeout = async (
    input: RequestInfo | URL,
    init?: RequestInit
): Promise<Response> => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 saniye timeout

  try {
    const response = await fetch(input, {
      ...init,
      signal: controller.signal,
    });
    return response;
  } finally {
    clearTimeout(timeoutId);
  }
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

  let lastError: Error | null = null;

  for (let i = 0; i < rpcUrls.length; i += 1) {
    const rpcUrl = rpcUrls[i];
    try {
      const connection = new Connection(rpcUrl, {
        commitment: 'confirmed',
        fetch: fetchWithTimeout,
      });
      return await fetchWithConnection(connection);
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      const message = lastError.message;

      const isRetryableError =
          message.includes('SSL') ||
          message.includes('tlsv1') ||
          message.includes('ECONNRESET') ||
          message.includes('ENOTFOUND') ||
          message.includes('EAI_AGAIN') ||
          message.includes('fetch failed') ||
          message.includes('socket') ||
          message.includes('aborted') ||
          message.includes('timeout') ||
          message.includes('ETIMEDOUT');

      // Eğer retry yapılabilir bir hata ise ve daha fazla URL varsa devam et
      if (isRetryableError && i < rpcUrls.length - 1) {
        let host = rpcUrl;
        try {
          host = new URL(rpcUrl).hostname;
        } catch {
          // ignore
        }
        console.warn(`RPC ${host} failed, trying next endpoint...`);
        continue;
      }

      // Son endpoint veya retry yapılamaz hata
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

  throw lastError || new Error('Failed to fetch holders from all RPC endpoints');
}
