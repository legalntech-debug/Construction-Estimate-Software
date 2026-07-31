// Simple In-Memory Rate Limiter for API protection
const rateLimitMap = new Map<string, { count: number; expiresAt: number }>();

export function rateLimit(
  identifier: string,
  limit: number = 10, // Max requests allowed
  windowMs: number = 60 * 1000 // Time window in milliseconds (default: 1 minute)
): { success: boolean; remaining: number; resetIn: number } {
  const now = Date.now();
  
  if (rateLimitMap.size > 10000) {
    for (const [key, value] of rateLimitMap.entries()) {
      if (value.expiresAt < now) {
        rateLimitMap.delete(key);
      }
    }
  }

  const record = rateLimitMap.get(identifier);

  if (!record || record.expiresAt < now) {
    rateLimitMap.set(identifier, { count: 1, expiresAt: now + windowMs });
    return { success: true, remaining: limit - 1, resetIn: windowMs };
  }

  if (record.count >= limit) {
    const resetIn = Math.ceil((record.expiresAt - now) / 1000);
    return { success: false, remaining: 0, resetIn };
  }

  record.count += 1;
  rateLimitMap.set(identifier, record);
  return { success: true, remaining: limit - record.count, resetIn: Math.ceil((record.expiresAt - now) / 1000) };
}