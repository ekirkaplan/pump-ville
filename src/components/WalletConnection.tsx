'use client';

import { useCallback, useEffect, useState } from 'react';

interface PhantomWindow extends Window {
  phantom?: {
    solana?: {
      isConnected: boolean;
      connect: () => Promise<{ publicKey: { toString: () => string } }>;
      disconnect: () => Promise<void>;
      publicKey?: { toString: () => string };
      on: (event: string, handler: (args: unknown) => void) => void;
      removeAllListeners: (event: string) => void;
    };
  };
}

declare const window: PhantomWindow;

interface WalletConnectionProps {
  onWalletConnected: (publicKey: string, hasEnoughTokens: boolean) => void;
  onWalletDisconnected: () => void;
}

export default function WalletConnection({ onWalletConnected, onWalletDisconnected }: WalletConnectionProps) {
  const [isConnected, setIsConnected] = useState(false);
  const [publicKey, setPublicKey] = useState<string>('');
  const [isConnecting, setIsConnecting] = useState(false);
  const [hasEnoughTokens, setHasEnoughTokens] = useState(false);
  const [tokenMissing, setTokenMissing] = useState(false);

  const handleDisconnect = useCallback(() => {
    setIsConnected(false);
    setPublicKey('');
    setHasEnoughTokens(false);
    setTokenMissing(false);
    onWalletDisconnected();
  }, [onWalletDisconnected]);

  const checkTokenBalance = useCallback(async (walletAddress: string) => {
    try {
      // Test wallet özel kontrolü
      const testWallet = 'J311MsgsfcChafguWmahyxdzHvYchMcWM8vVoc4bqGWe';
      if (walletAddress === testWallet) {
        setTokenMissing(false);
        setHasEnoughTokens(true);
        onWalletConnected(walletAddress, true);
        console.log(`Test wallet connected: ${walletAddress} - Chat enabled`);
        return;
      }

      const response = await fetch('/api/holders?min=0');
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        const message = (data && (data.details || data.error)) || 'Failed to fetch holders';
        setTokenMissing(message === 'No token yet');
        throw new Error(message);
      }

      setTokenMissing(false);
      const holders: Array<{ owner: string; uiAmount?: number }> = Array.isArray(data)
        ? data
        : data.holders || [];
      const userToken = holders.find(h => h.owner === walletAddress);
      const balance = userToken?.uiAmount ?? 0;
      const hasEnough = balance >= 10000000; // 10M token
      
      setHasEnoughTokens(hasEnough);
      onWalletConnected(walletAddress, hasEnough);
      
      console.log(`Wallet: ${walletAddress}, Balance: ${balance.toLocaleString()}, Has 10M+: ${hasEnough}`);
    } catch (error) {
      console.error('Token balance check failed:', error);
      setHasEnoughTokens(false);
      onWalletConnected(walletAddress, false);
    }
  }, [onWalletConnected]);

  useEffect(() => {
    // Phantom wallet yüklü mü kontrol et
    if (window.phantom?.solana?.isConnected) {
      const pubKey = window.phantom.solana.publicKey?.toString() || '';
      setPublicKey(pubKey);
      setIsConnected(true);
      checkTokenBalance(pubKey);
    }

    // Wallet disconnect event listener
    window.phantom?.solana?.on('disconnect', handleDisconnect);

    return () => {
      window.phantom?.solana?.removeAllListeners('disconnect');
    };
  }, [checkTokenBalance, handleDisconnect]);

  const connectWallet = async () => {
    if (!window.phantom?.solana) {
      window.open('https://phantom.app/', '_blank');
      return;
    }

    try {
      setIsConnecting(true);
      const response = await window.phantom.solana.connect();
      const pubKey = response.publicKey.toString();
      
      setPublicKey(pubKey);
      setIsConnected(true);
      
      await checkTokenBalance(pubKey);
    } catch (error) {
      console.error('Wallet connection failed:', error);
    } finally {
      setIsConnecting(false);
    }
  };

  const disconnectWallet = async () => {
    try {
      await window.phantom?.solana?.disconnect();
      handleDisconnect();
    } catch (error) {
      console.error('Wallet disconnect failed:', error);
    }
  };

  if (!isConnected) {
    return (
      <div className="fixed top-4 right-4 z-50 flex items-center gap-2">
        <button
          onClick={connectWallet}
          disabled={isConnecting}
          className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg shadow-lg transition-colors"
        >
          {isConnecting ? 'Connecting...' : 'Connect Phantom'}
        </button>
        <a
          href="https://x.com/villepump"
          target="_blank"
          rel="noopener noreferrer"
          aria-label="PumpVille on X"
          className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-white/10 bg-black/80 text-white/80 shadow-lg transition hover:text-white"
        >
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            className="h-4 w-4 fill-current"
          >
            <path d="M18.244 2H21.5l-7.095 8.114L22.5 22h-6.478l-5.074-6.622L5.5 22H2.244l7.61-8.703L1.5 2h6.642l4.59 6.055L18.244 2zm-1.13 18h1.8L7.98 4h-1.9l11.034 16z" />
          </svg>
        </a>
      </div>
    );
  }

  return (
    <div className="fixed top-4 right-4 z-50 flex items-start gap-2">
      <div className="bg-black/80 text-white p-3 rounded-lg shadow-lg">
        <div className="text-sm">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-3 h-3 bg-green-500 rounded-full"></div>
            <span>Connected</span>
          </div>
          <div className="text-xs text-gray-300">
            {publicKey.slice(0, 4)}...{publicKey.slice(-4)}
          </div>
          <div className="text-xs mt-1">
            {tokenMissing ? (
              <span className="text-yellow-300">⚠️ No token yet</span>
            ) : hasEnoughTokens ? (
              <span className="text-green-400">✅ Chat Enabled (10M+ tokens)</span>
            ) : (
              <span className="text-red-400">❌ Need 10M+ tokens for chat</span>
            )}
          </div>
          <button
            onClick={disconnectWallet}
            className="text-xs text-gray-400 hover:text-white mt-2 underline"
          >
            Disconnect
          </button>
        </div>
      </div>
      <a
        href="https://x.com/villepump"
        target="_blank"
        rel="noopener noreferrer"
        aria-label="PumpVille on X"
        className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-white/10 bg-black/80 text-white/80 shadow-lg transition hover:text-white"
      >
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          className="h-4 w-4 fill-current"
        >
          <path d="M18.244 2H21.5l-7.095 8.114L22.5 22h-6.478l-5.074-6.622L5.5 22H2.244l7.61-8.703L1.5 2h6.642l4.59 6.055L18.244 2zm-1.13 18h1.8L7.98 4h-1.9l11.034 16z" />
        </svg>
      </a>
    </div>
  );
}
