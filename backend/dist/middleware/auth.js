import jwt from 'jsonwebtoken';
export const authMiddleware = (secret) => {
    return (req, res, next) => {
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
            const decoded = jwt.verify(token, secret);
            req.user = decoded;
            next();
        }
        catch (error) {
            return res.status(401).json({
                success: false,
                error: 'Invalid or expired token',
                code: 'UNAUTHORIZED'
            });
        }
    };
};
//# sourceMappingURL=auth.js.map