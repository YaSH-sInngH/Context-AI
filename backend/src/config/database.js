import mongoose from "mongoose";
import logger from "../utils/logger.js";

const MONGO_URI = process.env.MONGO_URI;

if(!MONGO_URI) {
    logger.error("MONGO_URI is not defined in environment variables");
    process.exit(1);
}

export const connectDB = async () => {
    try{
        mongoose.set('strictQuery', true);

        const connection = await mongoose.connect(MONGO_URI);
        logger.info(`MongoDB Connected: ${connection.connection.host}`);
        registerConnectionEvents();
        registerShutdownHook();
    } catch (error){
        logger.error(`Error: ${error.message}`);
        process.exit(1);
    }
}

const registerConnectionEvents = () => {
    mongoose.connection.on('connected', () => {
        logger.info('Mongoose connected to MongoDB');
    });

    mongoose.connection.on('error', (err) => {
        logger.error('Mongoose connection error', {
            message: err.message,
        });
    });

    mongoose.connection.on('disconnected', () => {
        logger.warn('MongoDB Disconnected');
    });

    mongoose.connection.on('reconnected', () => {
        logger.info('MongoDB Reconnected');
    });
}

const registerShutdownHook = () => {
    const shutdown = async (signal) => {
        try {
            logger.info(`Received ${signal}. Closing MongoDB connection...`);
            await mongoose.connection.close();
            logger.info('Mongoose connection closed');
            process.exit(0);
        } catch (error){
            logger.error('Error during MongoDB disconnection', {
                message: error.message,
            });
            process.exit(1);
        }
    };

    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);
    process.on('SIGUSR2', shutdown);
}