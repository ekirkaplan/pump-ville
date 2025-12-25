import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getHolders } from '@/lib/helius';

const querySchema = z.object({
  mint: z.string().min(1, 'Mint address is required'),
  min: z.string().optional().transform(val => val ? parseInt(val) : undefined),
});

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const query = {
      mint:
        searchParams.get('mint') ||
        process.env.NEXT_PUBLIC_TOKEN_MINT ||
        process.env.TOKEN_MINT,
      min:
        searchParams.get('min') ||
        process.env.NEXT_PUBLIC_MIN_HOLD ||
        process.env.MIN_HOLD,
    };

    const { mint, min } = querySchema.parse(query);
    const safeMin = typeof min === 'number' && Number.isFinite(min) ? min : 10000;

    const holders = await getHolders({ mint, min: safeMin });

    return NextResponse.json(holders);
  } catch (error) {
    console.error('Error in /api/holders:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid parameters', details: error.issues },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to fetch holders', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
