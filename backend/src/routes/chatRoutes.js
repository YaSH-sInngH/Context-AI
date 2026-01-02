import express from "express";
import { body, param } from "express-validator";

import chatController from "../controllers/chatController.js";
import { authMiddleware } from "../middlewares/authMiddleware.js";
import { validate } from "../middlewares/validation.js";

const router = express.Router();

/* =========================
   Validation Middlewares
========================= */

const chatValidation = {
  createSession: [
    body("title")
      .optional()
      .isString()
      .isLength({ max: 100 })
      .withMessage("Title must be max 100 characters"),

    body("model")
      .optional()
      .isIn(["gpt-3.5-turbo", "gpt-4", "gemini-pro", "claude-3-haiku"])
      .withMessage("Invalid model"),

    body("settings.temperature")
      .optional()
      .isFloat({ min: 0, max: 2 })
      .withMessage("Temperature must be between 0 and 2"),

    body("settings.maxTokens")
      .optional()
      .isInt({ min: 100, max: 4000 })
      .withMessage("Max tokens must be between 100 and 4000"),

    validate,
  ],

  sendMessage: [
    body("sessionId")
      .notEmpty()
      .isMongoId()
      .withMessage("Valid sessionId is required"),

    body("message")
      .notEmpty()
      .isLength({ min: 1, max: 5000 })
      .withMessage("Message must be between 1 and 5000 characters"),

    body("useRAG")
      .optional()
      .isBoolean()
      .withMessage("useRAG must be boolean"),

    body("stream")
      .optional()
      .isBoolean()
      .withMessage("stream must be boolean"),

    validate,
  ],

  uploadDocument: [
    body("content")
      .notEmpty()
      .isLength({ min: 10 })
      .withMessage("Content must be at least 10 characters"),

    body("metadata.title")
      .optional()
      .isString()
      .isLength({ max: 200 }),

    body("metadata.author")
      .optional()
      .isString()
      .isLength({ max: 100 }),

    body("metadata.url")
      .optional()
      .isURL()
      .withMessage("Invalid URL"),

    body("metadata.tags")
      .optional()
      .isArray(),

    body("sourceType")
      .optional()
      .isIn(["document", "web", "manual", "knowledge-base"])
      .withMessage("Invalid source type"),

    validate,
  ],

  searchKnowledge: [
    body("query")
      .notEmpty()
      .isLength({ min: 1, max: 1000 }),

    body("topK")
      .optional()
      .isInt({ min: 1, max: 20 }),

    validate,
  ],

  deleteSession: [
    param("sessionId")
      .isMongoId()
      .withMessage("Invalid sessionId"),

    validate,
  ],
};

/* =========================
   Routes (Protected)
========================= */

router.use(authMiddleware.protect);

// Chat sessions
router.post(
  "/sessions",
  chatValidation.createSession,
  chatController.createSession
);

router.get(
  "/sessions",
  chatController.getSessions
);

router.delete(
  "/sessions/:sessionId",
  chatValidation.deleteSession,
  chatController.deleteSession
);

// Messages
router.post(
  "/message",
  chatValidation.sendMessage,
  chatController.sendMessage
);

// RAG
router.post(
  "/upload",
  chatValidation.uploadDocument,
  chatController.uploadDocument
);

router.post(
  "/search",
  chatValidation.searchKnowledge,
  chatController.searchKnowledge
);

// Vector stats
router.get(
  "/vector-stats",
  chatController.getVectorStats
);

export default router;
