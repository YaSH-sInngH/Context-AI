import express from 'express';
import historyController from '../controllers/historyController.js';
import {authMiddleware} from '../middlewares/authMiddleware.js';

const router = express.Router();

// All routes require authentication
router.use(authMiddleware.protect);

// Chat history
router.get('/session/:sessionId',
    historyController.getChatHistory
);

router.delete('/session/:sessionId',
    historyController.clearChatHistory
);

router.delete('/message/:messageId',
    historyController.deleteMessage
);

router.get('/export/:sessionId',
    historyController.exportChatHistory
);

router.get('/recent',
    historyController.getRecentChats
);

export default router;