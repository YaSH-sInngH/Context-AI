import { act } from "react";
import {generateToken, verifyToken} from "../config/jwt.js";
import { User } from "../models/User.js";
import logger from "./logger.js";

export const generateAccessToken = (user) => {
    const payload = {
        userId: user._id,
        email: user.email,
        name: user.name,
        isVerified: user.isVerified,
    };

    return generateToken(payload, 'access');
};

export const generateRefreshToken = (user) => {
    const payload = {
        userId: user._id,
        tokenVersion: Date.now(),
    };
    return generateToken(payload, 'refresh');
};

export const verifyAccessToken = (token) => {
    return verifyToken(token, 'access');
};

const verifyRefreshToken = (token) => {
    return verifyToken(token, 'refresh');
};

export const refreshTokenPair  = async (refreshToken) => {
    try {
        const decoded = verifyRefreshToken(refreshToken);
        if(!decoded) {
            throw new Error('Invalid refresh token');
        }

        const user = await User.findById(decoded.userId);
        if(!user || !user.isActive){
            throw new Error('User not found or inactive');
        }

        const tokenExists = user.refreshTokens.some(
            token => token.token === refreshToken && token.expiresAt > new Date()
        );
        if(!tokenExists) {
            throw new Error('Refresh token not found or expired');
        }

        const newAccessToken = generateAccessToken(user);
        const newRefreshToken = generateRefreshToken(user);

        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 30);

        await User.removeRefreshToken(refreshToken);
        await User.addRefreshToken(newRefreshToken, expiresAt);

        return{
            accessToken: newAccessToken,
            refreshToken: newRefreshToken,
            user: {
                id: user._id,
                email: user.email,
                name: user.name,
                avatar: user.avatar,
                isVerified: user.isVerified,
            },
        };
    } catch (error) {
        logger.error('Error verifying refresh token:', error);
        throw error;
    }
}