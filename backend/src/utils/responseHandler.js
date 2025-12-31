export const responseHandler = {
    success: (res, message, data = null, statusCode = 200) => {
        return res.status(statusCode).json({
            success: true,
            message,
            data,
        });
    },
    
    created: (res, message, data = null) => {
        return responseHandler.success(res, message, data, 201);
    },
    
    badRequest: (res, message, errors = null) => {
        return res.status(400).json({
            success: false,
            message,
            errors,
        });
    },
    
    unauthorized: (res, message) => {
        return res.status(401).json({
            success: false,
            message,
        });
    },
    
    forbidden: (res, message) => {
        return res.status(403).json({
            success: false,
            message,
        });
    },
    
    notFound: (res, message) => {
        return res.status(404).json({
            success: false,
            message,
        });
    },
    
    conflict: (res, message) => {
        return res.status(409).json({
            success: false,
            message,
        });
    },
    
    serverError: (res, message, error = null) => {
        console.error('Server Error:', error);
        return res.status(500).json({
            success: false,
            message: message || 'Internal server error',
        });
    },
};