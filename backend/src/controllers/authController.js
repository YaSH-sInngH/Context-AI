import AuthService from '../services/authService.js';
import { refreshTokenPair } from '../utils/tokenHelper.js';
import { responseHandler } from '../utils/responseHandler.js';
import logger from '../utils/logger.js';

const authService = new AuthService();

export class AuthController {
    async register(req, res){
        try {
            const {user, accessToken, refreshToken} = await authService.register(req.body);
            res.cookie('refreshToken', refreshToken, {
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                sameSite: 'Strict',
                maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
            });
            return responseHandler.created(res, 'User registered successfully', {
                user: {
                    id: user._id,
                    name: user.name,
                    email: user.email,
                    avatar: user.avatar,
                    isVerified: user.isVerified,
                    createdAt: user.createdAt,
                },
                accessToken,
            });
        } catch (error) {
            logger.error('Registration controller Error', error);

            if(error.message === 'User already exists'){
                return responseHandler.conflict(res, error.message);
            }

            return responseHandler.badRequest(res, error.message);
        }
    }

    async login(req, res){
        try {
            const {email, password} = req.body;
            const {user, accessToken, refreshToken} = await authService.login(email, password);

            res.cookie('refreshToken', refreshToken, {
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                sameSite: 'strict',
                maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
            })
            return responseHandler.success(res, 'Login successful', {
                user: {
                    id: user._id,
                    name: user.name,
                    email: user.email,
                    avatar: user.avatar,
                    isVerified: user.isVerified,
                    createdAt: user.createdAt,
                },
                accessToken,
            })
        } catch (error) {
            logger.error('Error while logging in', error);
            if (error.message.includes('Invalid credentials') || error.message.includes('Please login using')){
                return responseHandler.unauthorized(res, error.message);
            }
            return responseHandler.badRequest(res, error.message);
        }
    }

    async googleCallback(req, res){
        try {
            if(!req.user){
                return responseHandler.unauthorized(res, 'Google authentication failed');
            }
            const {user, accessToken, refreshToken} = await authService.googleLogin(req.user);
            res.cookie('refreshToken', refreshToken, {
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                sameSite: 'strict',
                maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
            });
            const redirectUrl = `${process.env.CLIENT_URL}/auth/callback?accessToken=${accessToken}`;
            res.redirect(redirectUrl);
        } catch (error) {
            logger.error('Google Callback Error', error);
            const redirectUrl = `${process.env.CLIENT_URL}/auth/error?message=${encodeURIComponent(error.message)}`;
            res.redirect(redirectUrl);
        }
    }

    async refresh(req, res){
        try {
            const refreshToken = req.cookie.refreshToken || req.body.refreshToken;
            if(!refreshToken){
                return responseHandler.badRequest(res, 'Refresh token is required');
            }
            const tokens = await refreshTokenPair(refreshToken);
            res.cookie('refreshToken', tokens.refreshToken, {
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                sameSite: 'strict',
                maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
            });
            return responseHandler.success(res, 'Tokens refreshed successfully', {
                accessToken: tokens.accessToken,
                user: tokens.user,
            });
        } catch (error) {
            logger.error('Refresh token error:', error);
            res.clearCookie('refreshToken');
            if (error.message.includes('Invalid') || 
                error.message.includes('not found') ||
                error.message.includes('expired')) {
                return responseHandler.unauthorized(res, error.message);
            }
            return responseHandler.serverError(res, 'Failed to refresh tokens');
        }
    }

    async logout(req, res){
        try {
            const refreshToken = req.cookie.refreshToken;
            if(req.user && refreshToken){
                await authService.logout(req.user._id, refreshToken);
                res.clearCookie('refreshToken');
                return responseHandler.success(res, 'Logged out successfully');
            }
        } catch (error) {
            logger.error('Logout Error', error);
            res.clearCookie('refreshToken');
            return responseHandler.success(res, 'Logged out successfully');
        }
    }

    async getProfile(req, res){
        try {
            const user = await authService.getUserById(req.user._id);
            return responseHandler.success(res, 'Profile fetched successfully', {
                user: {
                    id: user._id,
                    email: user.email,
                    name: user.name,
                    avatar: user.avatar,
                    isVerified: user.isVerified,
                    preferences: user.preferences,
                    createdAt: user.createdAt,
                    lastLogin: user.lastLogin,
                },
            })
        } catch (error) {
            logger.error('Get Profile Error', error);
            return responseHandler.serverError(res, 'Failed to get profile');
        }
    }

    async updateProfile(req, res){
        try {
            const user = await authService.updateUserProfile(req.user._id, req.body);
            return responseHandler.success(res, 'Profile updated successfully', {
                user: {
                    id: user._id,
                    email: user.email,
                    name: user.name,
                    avatar: user.avatar,
                    preferences: user.preferences,
                },
            })
        } catch (error) {
            logger.error('Update profile error:', error);         
            if (error.message === 'User not found') {
                return responseHandler.notFound(res, error.message);
            }
            return responseHandler.badRequest(res, error.message);
        }
    }
}