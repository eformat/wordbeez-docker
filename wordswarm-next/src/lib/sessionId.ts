/*
 * Extract session ID from request headers.
 * Falls back to "default" if no X-Session-Id header is present.
 */

import { NextRequest } from 'next/server';

export function getSessionId(request: NextRequest): string {
  return request.headers.get('x-session-id') || 'default';
}
