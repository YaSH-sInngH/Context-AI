import { User } from "../models/User.js";
import logger from "../utils/logger.js";
import { verifyAccessToken } from "../utils/tokenHelper.js";
import {responseHandler} from "../utils/responseHandler.js";

const extractToken = (req) => {
    const authHeader = req.headers?.authorization;
    if( !authHeader || !authHeader.startsWith('Bearer ')){
        return null;
    }
    return authHeader.split(' ')[1];
}

const attachUserToRequest = async (req, token) => {
    const decoded = verifyAccessToken(token);
    if(!decoded) return null;

    const user = await User.findById(decoded.userId).lean();
    if(!user || !user.isActive) return null;

    return user;
}

export const authMiddleware = {
    protect: async (req, res, next) => {
        try {
            const token = extractToken(req);
            if(!token) {
                return responseHandler.unauthorized(res, 'No Authentication token provided');
            }
            
            const user = await attachUserToRequest(req, token);
            if(!user) {
                return responseHandler.unauthorized(res, 'Invalid or expired token');
            }

            req.user = user;
            next();
        } catch (error) {
            logger.error('Auth Middleware Error', {
                error: error.message,
                stack: error.stack,
            });

            return responseHandler.serverError(res, 'Authentication failed');
        }
    },
    optional: async (req, res, next) => {
        try {
            const token = extractToken(req);
            if(!token) return next();

            const user = await attachUserToRequest(req, token);
            if(user) req.user = user;

            return next();
        } catch (error) {
            logger.warn('Optional Auth Middleware Failed', {
                error: error.message,
            });
            return next();
        }
    },
    restrictTo: (...allowedRoles) => {
        return (req, res, next) => {
            if(!req.user) {
                return responseHandler.unauthorized(res, 'Authentication required');
            }
            if(!allowedRoles.includes(req,user.role)){
                return responseHandler.forbidden(res, 'You do not have permission to perform this action');
            }
            return next();
        }
    },
    requireVerified: (req, res, next) => {
        if (!req.user?.isVerified) {
            return responseHandler.forbidden(res,'Please verify your email to access this resource');
        }
        return next();
    },
}