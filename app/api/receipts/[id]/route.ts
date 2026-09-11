import type { Receipt } from '@/lib/domain';
import { getRecord } from '@/lib/repository';
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params,
    r = await getRecord<Receipt>('receipts', id);
  return r
    ? Response.json({ data: r })
    : Response.json(
        { error: { code: 'not_found', message: 'Receipt not available' } },
        { status: 404 },
      );
}
