import { AsyncLocalStorage } from 'node:async_hooks';
import { Injectable, NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import type { JwtPayload } from '@crm/shared';

interface RequestContext {
  req: Request & { user?: JwtPayload };
}

const storage = new AsyncLocalStorage<RequestContext>();

/** Makes the current HTTP request reachable from services (e.g. audit: who, from which IP). */
@Injectable()
export class RequestContextMiddleware implements NestMiddleware {
  use(req: Request, _res: Response, next: NextFunction): void {
    storage.run({ req }, next);
  }
}

/** The request being handled, or undefined outside an HTTP request (jobs, tests). */
export function currentRequest(): RequestContext['req'] | undefined {
  return storage.getStore()?.req;
}
