import { Request, Response, NextFunction } from 'express';

const WINDOW_SIZE = 15 * 60 * 1000; // 15 minutes
const MAX_REQUESTS = 100; // Maximum requests per window

interface RequestLog {
    timestamp: number;
}

const requestLogs: Map<string, RequestLog[]> = new Map();

export const rateLimiter = (req: Request, res: Response, next: NextFunction) => {
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    const now = Date.now();
    
    if (!requestLogs.has(ip)) {
        requestLogs.set(ip, []);
    }
    
    const logs = requestLogs.get(ip)!;
    const windowStart = now - WINDOW_SIZE;
    
    // Remove old requests
    while (logs.length > 0 && logs[0].timestamp < windowStart) {
        logs.shift();
    }
    
    if (logs.length >= MAX_REQUESTS) {
        return res.status(429).json({
            error: 'Too many requests, please try again later.'
        });
    }
    
    logs.push({ timestamp: now });
    next();
}; 