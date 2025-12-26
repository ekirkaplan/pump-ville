import { getDb } from '@/lib/db';

type TokenConfigDoc = {
  _id?: string;
  key?: string;
  value?: unknown;
  mint?: unknown;
  tokenMint?: unknown;
};

const extractMint = (doc: TokenConfigDoc | null): string | null => {
  if (!doc) return null;

  const candidates = [doc.value, doc.mint, doc.tokenMint];
  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate.trim().length > 0) {
      return candidate.trim();
    }
  }
  return null;
};

export async function getTokenMintFromDb(): Promise<string | null> {
  if (!process.env.MONGODB_URI) return null;

  const db = await getDb();
  const collection = db.collection<TokenConfigDoc>('settings');

  const byId = await collection.findOne({ _id: 'tokenMint' });
  const mintById = extractMint(byId);
  if (mintById) return mintById;

  const byKey = await collection.findOne({ key: 'tokenMint' });
  return extractMint(byKey);
}
