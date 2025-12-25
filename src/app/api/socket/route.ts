import { NextRequest, NextResponse } from 'next/server';

// Basit in-memory message store
let messages: Array<{wallet: string, message: string, timestamp: number}> = [];

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { wallet, message } = body;
    
    const messageData = {
      wallet,
      message,
      timestamp: Date.now()
    };
    
    // Mesajı store'a ekle
    messages.push(messageData);
    
    // Son 50 mesajı tut
    if (messages.length > 50) {
      messages = messages.slice(-50);
    }
    
    console.log('Message received:', messageData);
    
    return NextResponse.json({ success: true, message: messageData });
  } catch (error) {
    console.error('Socket API error:', error);
    return NextResponse.json({ error: 'Failed to process message' }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  // Mesajları long-polling ile al
  const url = new URL(request.url);
  const since = parseInt(url.searchParams.get('since') || '0');
  
  // Son mesajları döndür
  const recentMessages = messages.filter(m => m.timestamp > since);
  
  return NextResponse.json({ messages: recentMessages });
}