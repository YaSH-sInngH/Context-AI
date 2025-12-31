import dotenv from 'dotenv';
dotenv.config({override: true});
import app from './src/index.js';
import { connectDB } from './src/config/database.js';
import logger from './src/utils/logger.js';
const PORT = process.env.PORT || 5000;


const startServer = async () => {
    try {
        await connectDB();

        const server = app.listen(PORT, () => {
            logger.info(`Server running on port ${PORT} in ${process.env.NODE_ENV} mode`);
            logger.info(`Health check: http://localhost:${PORT}/health`);
            logger.info(`API Documentation: http://localhost:${PORT}/api-docs`);
        });

        const shutdown = async () => {
            logger.info('Shutting down server...');
            
            server.close(async () => {
                logger.info('Server closed');
                process.exit(0);
            });
            
            setTimeout(() => {
                logger.error('Forcing shutdown...');
                process.exit(1);
            }, 10000);
        };

        process.on('SIGTERM', shutdown);
        process.on('SIGINT', shutdown);
    } catch (error) {
        logger.error(`Failed to start server: ${error.message}`);
        process.exit(1);
    }
};

startServer();