import { body, validationResult } from 'express-validator';
import { responseHandler } from '../utils/responseHandler.js';

export const validate = (req, res, next) => {
    const errors = validationResult(req);

    if(!errors.isEmpty()) {
        const formattedErrors = errors.array().map(err => ({
            field: err.param,
            message: err.msg,
        }));
        return responseHandler.badRequest(res, 'Validation failed', formattedErrors);
    }

    next();
};

export const authSchemas = {
    register: [
        body('name')
            .trim()
            .isLength({ min: 2, max: 50 })
            .withMessage('Name must be between 2 and 50 characters'),

        body('email')
            .isEmail()
            .withMessage('Invalid email address'),

        body('password')
            .isLength({ min: 6 })
            .withMessage('Password must be at least 6 characters long'),

        body('confirmPassword')
            .custom((value, { req }) => value === req.body.password)
            .withMessage('Passwords do not match'),

        validate,
    ],

    login: [
        body('email')
            .isEmail()
            .withMessage('Invalid email address'),

        body('password')
            .notEmpty()
            .withMessage('Password is required'),

        validate,
    ],

    refreshToken: [
        body('refreshToken')
            .notEmpty()
            .withMessage('Refresh token is required'),

        validate,
    ],

    updateProfile: [
        body('name')
            .optional()
            .trim()
            .isLength({ min: 2, max: 50 })
            .withMessage('Name must be between 2 and 50 characters'),

        body('avatar')
            .optional()
            .isURL()
            .withMessage('Avatar must be a valid URL'),

        body('preferences.theme')
            .optional()
            .isIn(['light', 'dark', 'auto'])
            .withMessage('Theme must be light, dark, or auto'),

        body('preferences.language')
            .optional()
            .isLength({ min: 2, max: 2 })
            .withMessage('Language must be a 2-letter code'),

        validate,
    ],
};