import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getHolders } from '@/lib/helius';
import { getDb } from '@/lib/db';

const querySchema = z.object({
  mint: z.string().min(1, 'Mint address is required'),
  min: z.string().optional().transform(val => val ? parseInt(val) : 10000),
});

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const query = {
      mint: searchParams.get('mint'),
      min: searchParams.get('min'),
    };

    const { mint, min } = querySchema.parse(query);

    // Get current holders
    const holders = await getHolders({ mint, min });

    // Get character count from environment
    const charCount = parseInt(process.env.CHAR_COUNT || '3');

    // Assign characters to holders
    const assignResponse = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/assign`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mint,
        holders: holders.map(h => ({ owner: h.owner, uiAmount: h.uiAmount })),
        charCount,
      }),
    });

    if (!assignResponse.ok) {
      throw new Error('Failed to assign characters');
    }

    // Get assignments from database
    const db = await getDb();
    const assignments = await db.collection('avatars')
      .find({ mint })
      .project({ owner: 1, charId: 1, balance: 1 })
      .toArray();

    // Filter by minimum balance
    const filteredAssignments = assignments
      .filter(a => a.balance >= min)
      .map(a => ({
        owner: a.owner,
        charId: a.charId,
        balance: a.balance,
      }));

    return NextResponse.json(filteredAssignments);
  } catch (error) {
    console.error('Error in /api/assignments:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid parameters', details: error.issues },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to get assignments' },
      { status: 500 }
    );
  }
}
