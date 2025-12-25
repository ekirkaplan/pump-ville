import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export async function DELETE() {
  try {
    const db = await getDb();
    
    // Delete all character assignments
    const result = await db.collection('avatars').deleteMany({});
    
    return NextResponse.json({
      success: true,
      deletedCount: result.deletedCount,
      message: 'All character assignments have been reset'
    });
  } catch (error) {
    console.error('Error resetting database:', error);
    
    return NextResponse.json(
      { error: 'Failed to reset database' },
      { status: 500 }
    );
  }
}