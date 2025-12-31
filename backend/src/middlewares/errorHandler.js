import { responseHandler } from "../utils/responseHandler.js";
import logger from "../utils/logger.js";

export const errorHandler = (err, req, res, next) => {
    logger.error('Global error handler', err);
   
    if(err.name === 'ValidationError') {
        const errors = Object.values(err.errors).map(error => ({
            field: error.path,
            message: error.message,
        }));
        return responseHandler.badRequest(res, 'Validation failed', errors);
    }
    if (err.code === 11000) {
        const field = Object.keys(err.keyPattern)[0];
        return responseHandler.conflict(res, `${field} already exists`);
    }
    if (err.name === 'JsonWebTokenError') {
        return responseHandler.unauthorized(res, 'Invalid token');
    }
    if (err.name === 'TokenExpiredError') {
        return responseHandler.unauthorized(res, 'Token expired');
    }
    return responseHandler.serverError(res, err.message || 'Internal server error', err);
}