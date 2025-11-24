const parseCookies = (header) => {
    if (!header)
        return {};
    return header.split(';').reduce((acc, part) => {
        const [key, ...rest] = part.split('=');
        if (!key)
            return acc;
        const value = rest.join('=');
        acc[key.trim()] = decodeURIComponent(value?.trim() ?? '');
        return acc;
    }, {});
};
export const cookieMiddleware = (req, _res, next) => {
    req.cookies = parseCookies(req.headers.cookie);
    next();
};
//# sourceMappingURL=cookies.js.map