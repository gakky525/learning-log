import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import { Log } from '@/models/Log';
import { z } from 'zod';
import { getServerToken } from '@/lib/auth';

const updateSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  content: z.string().min(1).optional(),
  tags: z.array(z.string()).optional(),
  date: z.string().optional(),
});

async function resolveIdFromContext(context?: unknown): Promise<string | undefined> {
  if (!context) return undefined;

  const maybeParams = (context as { params?: unknown }).params;
  if (maybeParams === undefined) return undefined;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const params = await Promise.resolve(maybeParams as any);
  return params?.id as string | undefined;
}

// GET
export async function GET(_req: Request, context?: unknown) {
  const token = await getServerToken(_req);
  if (!token?.sub) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const id = await resolveIdFromContext(context);
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

  await connectToDatabase();
  const log = await Log.findById(id).lean();
  if (!log || log.userId !== token.sub) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  return NextResponse.json(log);
}

// PUT
export async function PUT(req: Request, context?: unknown) {
  const token = await getServerToken(req);
  if (!token?.sub) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const id = await resolveIdFromContext(context);
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

  const body = await req.json().catch(() => ({}));
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid input', details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  await connectToDatabase();
  const existing = await Log.findById(id);
  if (!existing || existing.userId !== token.sub) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  if (parsed.data.title !== undefined) existing.title = parsed.data.title;
  if (parsed.data.content !== undefined) existing.content = parsed.data.content;
  if (parsed.data.tags !== undefined) existing.tags = parsed.data.tags;
  if (parsed.data.date !== undefined) existing.date = new Date(parsed.data.date);

  await existing.save();
  return NextResponse.json(existing);
}

// DELETE
export async function DELETE(_req: Request, context?: unknown) {
  const token = await getServerToken(_req);
  if (!token?.sub) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const id = await resolveIdFromContext(context);
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

  await connectToDatabase();
  const existing = await Log.findById(id);
  if (!existing || existing.userId !== token.sub) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  await Log.findByIdAndDelete(id);
  return NextResponse.json({ message: 'Deleted' });
}
