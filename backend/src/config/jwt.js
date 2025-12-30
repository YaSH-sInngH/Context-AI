import jwt from 'jsonwebtoken';

export const jwtConfig = {
    accessToken: {
        secret: process.env.JWT_SECRET,
        expiresIn: process.env.JWT_EXPIRES_IN,
    },
    refreshToken: {
        secret: process.env.JWT_REFRESH_SECRET,
        expiresIn: process.env.JWT_REFRESH_EXPIRES_IN,
    }
}

export const generateToken = (payload, type = 'access') => {
    const config = type === 'access' ? jwtConfig.accessToken : jwtConfig.refreshToken;
    return jwt.sign(payload, config.secret, {expiresIn: config.expiresIn});
}

export const verifyToken = (token, type = 'access') => {
    const config = type === 'access' ? jwtConfig.accessToken : jwtConfig.refreshToken;
    try {
        return jwt.verify(token, config.secret);
    } catch (error) {
        return null;
    }
};

