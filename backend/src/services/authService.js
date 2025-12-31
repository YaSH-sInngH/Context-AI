import { User } from "../models/User.js";
import { generateAccessToken, generateRefreshToken } from "../utils/tokenHelper.js";
import logger from "../utils/logger.js";

export default class AuthService {
    // Local registration
    async register(userData) {
        try {
            // Check if user exists
            const existingUser = await User.findOne({ 
                email: userData.email.toLowerCase() 
            });
            
            if (existingUser) {
                throw new Error('User already exists');
            }
            
            // Create new user
            const user = new User({
                email: userData.email.toLowerCase(),
                password: userData.password,
                name: userData.name,
                authMethod: 'local',
                isVerified: false, // Email verification would be added here
            });
            
            await user.save();
            
            // Generate tokens
            const accessToken = generateAccessToken(user);
            const refreshToken = generateRefreshToken(user);
            
            // Save refresh token
            const expiresAt = new Date();
            expiresAt.setDate(expiresAt.getDate() + 30); // 30 days
            await user.addRefreshToken(refreshToken, expiresAt);
            
            // Remove password from response
            user.password = undefined;
            
            return {
                user,
                accessToken,
                refreshToken,
            };
            
        } catch (error) {
            logger.error('Registration error:', error);
            throw error;
        }
    }
    
    // Local login
    async login(email, password) {
        try {
            // Find user with password
            const user = await User.findOne({ email: email.toLowerCase() })
                .select('+password');
            
            if (!user) {
                throw new Error('Invalid credentials');
            }
            
            if (user.authMethod !== 'local') {
                throw new Error(`Please login using ${user.authMethod}`);
            }
            
            // Check password
            const isPasswordValid = await user.comparePassword(password);
            if (!isPasswordValid) {
                throw new Error('Invalid credentials');
            }
            
            // Check if account is active
            if (!user.isActive) {
                throw new Error('Account is deactivated');
            }
            
            // Update last login
            user.lastLogin = new Date();
            await user.save();
            
            // Generate tokens
            const accessToken = generateAccessToken(user);
            const refreshToken = generateRefreshToken(user);
            
            // Save refresh token
            const expiresAt = new Date();
            expiresAt.setDate(expiresAt.getDate() + 30);
            await user.addRefreshToken(refreshToken, expiresAt);
            
            // Remove password from response
            user.password = undefined;
            
            return {
                user,
                accessToken,
                refreshToken,
            };
            
        } catch (error) {
            logger.error('Login error:', error);
            throw error;
        }
    }
    
    // Google OAuth login/registration
    async googleAuth(profile) {
        try {
            // Find or create user (handled in passport strategy)
            const user = await User.findOne({ googleId: profile.id });
            
            if (!user) {
                throw new Error('Google authentication failed');
            }
            
            // Generate tokens
            const accessToken = generateAccessToken(user);
            const refreshToken = generateRefreshToken(user);
            
            // Save refresh token
            const expiresAt = new Date();
            expiresAt.setDate(expiresAt.getDate() + 30);
            await user.addRefreshToken(refreshToken, expiresAt);
            
            return {
                user,
                accessToken,
                refreshToken,
            };
            
        } catch (error) {
            logger.error('Google auth error:', error);
            throw error;
        }
    }
    
    // Logout
    async logout(userId, refreshToken) {
        try {
            const user = await User.findById(userId);
            if (user && refreshToken) {
                await user.removeRefreshToken(refreshToken);
            }
            return true;
        } catch (error) {
            logger.error('Logout error:', error);
            throw error;
        }
    }
    
    // Get user profile
    async getProfile(userId) {
        try {
            const user = await User.findById(userId);
            if (!user) {
                throw new Error('User not found');
            }
            return user;
        } catch (error) {
            logger.error('Get profile error:', error);
            throw error;
        }
    }
    
    // Update profile
    async updateProfile(userId, updateData) {
        try {
            const user = await User.findById(userId);
            if (!user) {
                throw new Error('User not found');
            }
            
            // Prevent updating sensitive fields
            delete updateData.password;
            delete updateData.email;
            delete updateData.authMethod;
            delete updateData.googleId;
            
            Object.assign(user, updateData);
            await user.save();
            
            return user;
        } catch (error) {
            logger.error('Update profile error:', error);
            throw error;
        }
    }
}