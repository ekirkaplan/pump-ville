'use client';

import { useEffect, useRef } from 'react';

interface UseSocketProps {
  onMessageReceived?: (data: { wallet: string; message: string; timestamp: number }) => void;
}

type SocketMessage = {
  wallet: string;
  message: string;
  timestamp: number;
};

export const useSocket = ({ onMessageReceived }: UseSocketProps = {}) => {
  const lastTimestamp = useRef<number>(0);
  const pollingInterval = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // Polling ile mesajları kontrol et
    const pollMessages = async () => {
      try {
        const response = await fetch(`/api/socket?since=${lastTimestamp.current}`);
        const data = await response.json();
        const messages: SocketMessage[] = Array.isArray(data.messages) ? data.messages : [];

        if (messages.length > 0) {
          messages.forEach((msg) => {
            onMessageReceived?.(msg);
            lastTimestamp.current = Math.max(lastTimestamp.current, msg.timestamp);
          });
        }
      } catch (error) {
        console.error('Polling error:', error);
      }
    };

    // İlk yükleme
    pollMessages();
    
    // Her 2 saniyede bir kontrol et
    pollingInterval.current = setInterval(pollMessages, 2000);

    return () => {
      if (pollingInterval.current) {
        clearInterval(pollingInterval.current);
      }
    };
  }, [onMessageReceived]);

  const sendMessage = async (wallet: string, message: string) => {
    try {
      const response = await fetch('/api/socket', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ wallet, message }),
      });

      if (response.ok) {
        console.log('Message sent:', { wallet, message });
      } else {
        console.error('Failed to send message');
      }
    } catch (error) {
      console.error('Send message error:', error);
    }
  };

  return { sendMessage };
};
