import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getDb } from '@/lib/db';
import { Assignment } from '@/lib/types';

const bodySchema = z.object({
  mint: z.string().min(1),
  holders: z.array(z.object({
    owner: z.string(),
    uiAmount: z.number(),
  })),
  charCount: z.number().min(1),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { mint, holders, charCount } = bodySchema.parse(body);

    const db = await getDb();
    const collection = db.collection<Assignment>('avatars');

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

    const result = await collection.bulkWrite(operations);

    return NextResponse.json({
      success: true,
      matched: result.matchedCount,
      modified: result.modifiedCount,
      upserted: result.upsertedCount,
    });
  } catch (error) {
    console.error('Error in /api/assign:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request body', details: error.issues },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to assign characters' },
      { status: 500 }
    );
  }
}
