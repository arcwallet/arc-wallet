import express, { Request, Response } from 'express';
import { body, validationResult } from 'express-validator';
import { aiService } from '../services/aiService.js';
import { saveConversation, getUserConversations, clearUserHistory, getConversationStats } from '../database/agentDatabase.js';
import { randomUUID } from 'crypto';

const router = express.Router();

// Rate limiting map (in-memory, simple implementation)
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT = parseInt(process.env.AGENT_RATE_LIMIT || '10');
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute

function checkRateLimit(userId: string): boolean {
    const now = Date.now();
    const userLimit = rateLimitMap.get(userId);

    if (!userLimit || now > userLimit.resetTime) {
        rateLimitMap.set(userId, { count: 1, resetTime: now + RATE_LIMIT_WINDOW });
        return true;
    }

    if (userLimit.count >= RATE_LIMIT) {
        return false;
    }

    userLimit.count++;
    return true;
}

// Parse user intent
router.post(
    '/parse',
    [
        body('message').isString().trim().isLength({ min: 1, max: 500 })
            .withMessage('Message must be between 1 and 500 characters'),
    ],
    async (req: Request, res: Response) => {
        try {
            // Validate input
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({ errors: errors.array() });
            }

            // Get user ID from JWT (assuming it's set by auth middleware)
            const userId = (req as any).userId || 'anonymous';

            // Check rate limit
            if (!checkRateLimit(userId)) {
                return res.status(429).json({
                    error: 'Rate limit exceeded',
                    message: `Too many requests. Maximum ${RATE_LIMIT} requests per minute.`,
                });
            }

            const { message } = req.body;

            // Parse intent using AI service
            const response = await aiService.parseIntent(message);

            // Save conversation to database
            const conversationId = randomUUID();
            saveConversation({
                id: conversationId,
                userId,
                message,
                response: response.message,
                intentType: response.intent.type,
                intentParams: JSON.stringify(response.intent.params),
                confidence: response.confidence,
            });

            // Return response
            return res.json({
                id: conversationId,
                message: response.message,
                intent: response.intent,
                confidence: response.confidence,
                aiConfigured: aiService.isReady(),
            });
        } catch (error: any) {
            console.error('Agent parse error:', error);
            return res.status(500).json({
                error: 'Internal server error',
                message: 'Failed to parse intent. Please try again.',
            });
        }
    }
);

// Get conversation history
router.get('/history', async (req: Request, res: Response) => {
    try {
        const userId = (req as any).userId || 'anonymous';
        const limit = parseInt(req.query.limit as string) || 50;

        const conversations = getUserConversations(userId, limit);

        return res.json({
            conversations: conversations.map(c => ({
                id: c.id,
                message: c.message,
                response: c.response,
                intentType: c.intentType,
                intentParams: c.intentParams ? JSON.parse(c.intentParams) : null,
                confidence: c.confidence,
                createdAt: c.createdAt,
            })),
        });
    } catch (error: any) {
        console.error('Agent history error:', error);
        return res.status(500).json({
            error: 'Internal server error',
            message: 'Failed to retrieve history.',
        });
    }
});

// Get conversation stats
router.get('/stats', async (req: Request, res: Response) => {
    try {
        const userId = (req as any).userId || 'anonymous';
        const stats = getConversationStats(userId);

        return res.json(stats);
    } catch (error: any) {
        console.error('Agent stats error:', error);
        return res.status(500).json({
            error: 'Internal server error',
            message: 'Failed to retrieve stats.',
        });
    }
});

// Clear conversation history
router.delete('/history', async (req: Request, res: Response) => {
    try {
        const userId = (req as any).userId || 'anonymous';
        clearUserHistory(userId);

        return res.json({
            message: 'Conversation history cleared successfully.',
        });
    } catch (error: any) {
        console.error('Agent clear history error:', error);
        return res.status(500).json({
            error: 'Internal server error',
            message: 'Failed to clear history.',
        });
    }
});

// Health check
router.get('/health', (req: Request, res: Response) => {
    return res.json({
        status: 'ok',
        aiConfigured: aiService.isReady(),
        timestamp: Date.now(),
    });
});

export default router;
