import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getHolders } from '@/lib/helius';
import { getDb } from '@/lib/db';
import { Assignment } from '@/lib/types';
import { WorldResponse } from '@/lib/types';
import { getTokenMintFromDb } from '@/lib/token-config';

const querySchema = z.object({
  min: z.string().optional().transform(val => val ? parseInt(val) : 10000),
  charCount: z.string().optional().transform(val => val ? parseInt(val) : 3),
});

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const query = {
      min:
        searchParams.get('min') ||
        process.env.NEXT_PUBLIC_MIN_HOLD ||
        process.env.MIN_HOLD,
      charCount:
        searchParams.get('charCount') ||
        process.env.NEXT_PUBLIC_CHAR_COUNT ||
        process.env.CHAR_COUNT,
    };

    const { min, charCount } = querySchema.parse(query);
    const mint = await getTokenMintFromDb();
    if (!mint) {
      return NextResponse.json({ error: 'No token yet' }, { status: 404 });
    }

    // Get current holders
    const holders = await getHolders({ mint, min });

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
      const safeCharCount = Number.isFinite(charCount) ? charCount : 2;
      const maxChars = Math.max(1, Math.min(safeCharCount, 2));
      const pickCharId = (owner: string) => {
        let hash = 0;
        for (let i = 0; i < owner.length; i += 1) {
          hash = (hash * 31 + owner.charCodeAt(i)) % 2147483647;
        }
        return (hash % maxChars) + 1;
      };

      const response: WorldResponse = {
        characters: holders
          .filter(h => h.uiAmount >= min)
          .map(h => ({
            owner: h.owner,
            charId: pickCharId(h.owner),
            balance: h.uiAmount,
          })),
      };

      return NextResponse.json(response);
    }

    // Connect to database
    const db = await getDb();
    const collection = db.collection<Assignment>('avatars');

    // Prepare bulk operations for upsert
    const operations = holders.map(holder => ({
      updateOne: {
        filter: { _id: holder.owner },
        update: {
          $setOnInsert: {
            _id: holder.owner,
            owner: holder.owner,
            mint: mint,
            charId: Math.floor(Math.random() * Math.min(charCount, 2)) + 1, // Max 2 characters
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
    }

    // Get all assignments for this mint with minimum balance
    const assignments = await collection
      .find({ 
        mint,
        balance: { $gte: min }
      })
      .project({ owner: 1, charId: 1, balance: 1 })
      .toArray();

    const response: WorldResponse = {
      characters: assignments.map(a => ({
        owner: a.owner,
        charId: a.charId,
        balance: a.balance,
      })),
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Error in /api/world:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid parameters', details: error.issues },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to get world data' },
      { status: 500 }
    );
  }
}
