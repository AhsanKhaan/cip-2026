import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod/v4';
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';
import { withLogging } from '@/lib/logging';

const ratelimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.fixedWindow(10, '1 h'),
});

const responseSchema = z.object({
  message: z.string(),
  timestamp: z.string(),
});

type TestResponse = z.infer<typeof responseSchema>;

async function GET(req: NextRequest): Promise<NextResponse<TestResponse>> {
  const ip = req.headers.get('x-forwarded-for') || 'unknown';
  const { success } = await ratelimit.limit(ip);

  if (!success) {
    return NextResponse.json(
      { message: 'Rate limit exceeded', timestamp: new Date().toISOString() },
      { status: 429 }
    );
  }

  const response: TestResponse = {
    message: 'Test endpoint working',
    timestamp: new Date().toISOString(),
  };

  return NextResponse.json(response, { status: 200 });
}

export const handler = withLogging(GET);
