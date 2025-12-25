'use client';

import { useState, type FormEvent, type KeyboardEvent } from 'react';

interface ChatSystemProps {
  isEnabled: boolean;
  onSendMessage: (message: string) => void;
}

export default function ChatSystem({ isEnabled, onSendMessage }: ChatSystemProps) {
  const [message, setMessage] = useState('');
  const [isVisible, setIsVisible] = useState(false);

  const submitMessage = () => {
    if (!message.trim() || !isEnabled) return;
    onSendMessage(message.trim());
    setMessage('');
    setIsVisible(false);
  };

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    submitMessage();
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      submitMessage();
    }
    if (e.key === 'Escape') {
      setIsVisible(false);
      setMessage('');
    }
  };

  if (!isEnabled) {
    return (
      <div className="fixed bottom-4 left-4 z-50 bg-red-500/20 text-red-300 p-3 rounded-lg border border-red-500/50">
        <div className="text-sm">
          ❌ Connect wallet with 10M+ tokens to chat
        </div>
      </div>
    );
  }

  return (
    <div className="fixed bottom-4 left-4 z-50">
      {!isVisible ? (
        <button
          onClick={() => setIsVisible(true)}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg shadow-lg transition-colors"
        >
          💬 Chat (5s)
        </button>
      ) : (
        <form onSubmit={handleSubmit} className="bg-black/90 p-4 rounded-lg shadow-lg border border-gray-700">
          <div className="text-white text-sm mb-2">
            💬 Chat message (5 seconds, ESC to cancel):
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type your message..."
              maxLength={100}
              autoFocus
              className="flex-1 bg-gray-800 text-white border border-gray-600 rounded px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
            />
            <button
              type="submit"
              disabled={!message.trim()}
              className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white px-3 py-2 rounded text-sm transition-colors"
            >
              Send
            </button>
          </div>
          <div className="text-xs text-gray-400 mt-1">
            {message.length}/100 characters
          </div>
        </form>
      )}
    </div>
  );
}
