'use client';

import dynamic from 'next/dynamic';
import { useCallback, useState } from 'react';
import type { Game, Scene } from 'phaser';
import WalletConnection from './WalletConnection';
import ChatSystem from './ChatSystem';
import HoldersPanel from './HoldersPanel';
import { useSocket } from '@/hooks/useSocket';

const PhaserGame = dynamic(() => import('@/components/PhaserGame'), {
  ssr: false,
});

export default function GameWrapper() {
  const [hasEnoughTokens, setHasEnoughTokens] = useState(false);
  const [userWallet, setUserWallet] = useState<string>('');
  const [gameInstance, setGameInstance] = useState<Game | null>(null);

  type GameSceneWithChat = Scene & {
    showUserMessage?: (wallet: string, message: string) => void;
  };

  // Socket bağlantısı ve mesaj handling
  const { sendMessage } = useSocket({
    onMessageReceived: (data) => {
      console.log('Socket message received:', data);
      // Tüm oyunculara mesaj göster
      if (gameInstance?.scene?.scenes?.[0]) {
        const gameScene = gameInstance.scene.scenes[0] as GameSceneWithChat;
        gameScene.showUserMessage?.(data.wallet, data.message);
      }
    }
  });

  const handleWalletConnected = (publicKey: string, hasTokens: boolean) => {
    setHasEnoughTokens(hasTokens);
    setUserWallet(publicKey);
    console.log('Wallet connected:', publicKey, 'Has tokens:', hasTokens);
  };

  const handleWalletDisconnected = () => {
    setHasEnoughTokens(false);
    setUserWallet('');
    console.log('Wallet disconnected');
  };

  const handleSendMessage = (message: string) => {
    if (!hasEnoughTokens || !userWallet) return;
    
    console.log('Sending message via socket:', message, 'from wallet:', userWallet);
    
    // Socket üzerinden mesajı gönder (tüm oyunculara)
    sendMessage(userWallet, message);
  };

  const handleGameReady = useCallback((game: Game) => {
    setGameInstance(game);
  }, []);

  return (
    <div className="relative w-full h-screen">
      <PhaserGame onGameReady={handleGameReady} />
      
      <WalletConnection
        onWalletConnected={handleWalletConnected}
        onWalletDisconnected={handleWalletDisconnected}
      />

      <HoldersPanel />
      
      <ChatSystem
        isEnabled={hasEnoughTokens}
        onSendMessage={handleSendMessage}
      />
    </div>
  );
}
