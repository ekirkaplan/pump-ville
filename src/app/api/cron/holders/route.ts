import { NextResponse } from 'next/server';
import { getHolders } from '@/lib/helius';
import { getDb } from '@/lib/db';
import { Assignment } from '@/lib/types';
import { getTokenMintFromDb } from '@/lib/token-config';

export async function GET() {
  try {
    console.log('🔄 Starting holder refresh cron job...');
    
    const tokenMint = await getTokenMintFromDb();
    const minHold = parseInt(process.env.NEXT_PUBLIC_MIN_HOLD || '10000');
    
    if (!tokenMint) {
      return NextResponse.json({ error: 'No token yet' }, { status: 404 });
    }

    // Get current holders from Helius
    const holders = await getHolders({ mint: tokenMint, min: minHold });
    console.log(`📊 Fetched ${holders.length} holders from Helius`);

    // Test wallet'ını listeye ekle
    const testWallet = 'J311MsgsfcChafguWmahyxdzHvYchMcWM8vVoc4bqGWe';
    const hasTestWallet = holders.some(h => h.owner === testWallet);
    if (!hasTestWallet) {
      holders.unshift({
        owner: testWallet,
        amount: '15000000',
        uiAmount: 15000000 // 15M token
      });
      console.log('✅ Added test wallet to holders list');
    }

    if (!process.env.MONGODB_URI) {
      const rawCharCount = parseInt(process.env.NEXT_PUBLIC_CHAR_COUNT || '2');
      const safeCharCount = Number.isFinite(rawCharCount) ? rawCharCount : 2;
      const maxChars = Math.max(1, Math.min(safeCharCount, 2));
      const pickCharId = (owner: string) => {
        let hash = 0;
        for (let i = 0; i < owner.length; i += 1) {
          hash = (hash * 31 + owner.charCodeAt(i)) % 2147483647;
        }
        return (hash % maxChars) + 1;
      };

      const assignments = holders.map(h => ({
        owner: h.owner,
        charId: pickCharId(h.owner),
        balance: h.uiAmount,
      }));

      return NextResponse.json({
        success: true,
        holdersProcessed: holders.length,
        totalInDb: 0,
        assignments,
        timestamp: new Date().toISOString(),
        warning: 'MongoDB not configured; assignments are in-memory only',
      });
    }

    // Connect to database
    const db = await getDb();
    const collection = db.collection<Assignment>('avatars');

    // Yeni holder'ları ekle/güncelle (eskiler kalır)
    const operations = holders.map(holder => ({
      updateOne: {
        filter: { _id: holder.owner },
        update: {
          $setOnInsert: {
            _id: holder.owner,
            owner: holder.owner,
            mint: tokenMint,
            charId: Math.floor(Math.random() * Math.min(2, 2)) + 1, // Max 2 characters
          },
          $set: {
            balance: holder.uiAmount,
            updatedAt: new Date(),
          },
        },
        upsert: true,
      },
    }));

    // Execute bulk operations
    if (operations.length > 0) {
      await collection.bulkWrite(operations);
      console.log(`✅ Upserted ${operations.length} holders`);
    }

    // Get final count
    const totalCount = await collection.countDocuments({ mint: tokenMint });
    console.log(`📊 Total holders in database: ${totalCount}`);

    return NextResponse.json({ 
      success: true, 
      holdersProcessed: holders.length,
      totalInDb: totalCount,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Holder refresh cron job failed:', error);
    return NextResponse.json(
      { error: 'Failed to refresh holders', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
