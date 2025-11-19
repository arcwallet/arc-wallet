import jwt from 'jsonwebtoken';
import { Request, Response, NextFunction } from 'express';

declare global {
  namespace Express {
    interface Request {
      user?: { id: string; email: string };
    }
  }
}

export const authMiddleware = (secret: string) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const authHeader = req.headers.authorization;
    
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ 
        success: false, 
        error: 'Missing authorization token',
        code: 'UNAUTHORIZED'
      });
    }
    
    const token = authHeader.slice(7);
    
    try {
      const decoded = jwt.verify(token, secret) as { id: string; email: string };
      req.user = decoded;
      next();
    } catch (error) {
      return res.status(401).json({ 
        success: false, 
        error: 'Invalid or expired token',
        code: 'UNAUTHORIZED'
      });
    }
  };
};
