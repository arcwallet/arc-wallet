import type { Request, Response, NextFunction } from 'express';

type CookieAwareRequest = Request & { cookies?: Record<string, string> };

const parseCookies = (header?: string): Record<string, string> => {
  if (!header) return {};
  return header.split(';').reduce<Record<string, string>>((acc, part) => {
    const [key, ...rest] = part.split('=');
    if (!key) return acc;
    const value = rest.join('=');
    acc[key.trim()] = decodeURIComponent(value?.trim() ?? '');
    return acc;
  }, {});
};

export const cookieMiddleware = (req: Request, _res: Response, next: NextFunction) => {
  (req as CookieAwareRequest).cookies = parseCookies(req.headers.cookie);
  next();
};
