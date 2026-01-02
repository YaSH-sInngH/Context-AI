import mongoose from 'mongoose';

const chatHistorySchema = new mongoose.Schema({
    session: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'ChatSession',
        required: true,
        index: true
    },
    
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true
    },
    
    // Message content
    role: {
        type: String,
        required: true,
        enum: ['user', 'assistant', 'system']
    },
    
    content: {
        type: String,
        required: true
    },
    
    // For RAG context
    contextReferences: [{
        sourceId: String,
        sourceType: {
            type: String,
            enum: ['document', 'web', 'database', 'knowledge-base']
        },
        chunkId: String,
        similarityScore: Number
    }],
    
    // Metadata
    tokens: {
        type: Number,
        default: 0
    },
    
    model: {
        type: String,
        default: 'gpt-3.5-turbo'
    },
    
    // For streaming responses
    isComplete: {
        type: Boolean,
        default: true
    },
    
    // For error handling
    error: {
        type: String
    },
    
    // Timestamps
    createdAt: {
        type: Date,
        default: Date.now,
        index: true
    }
}, {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
});

// Indexes for efficient querying
chatHistorySchema.index({ session: 1, createdAt: 1 });
chatHistorySchema.index({ user: 1, createdAt: -1 });
chatHistorySchema.index({ 'contextReferences.sourceId': 1 });

// Update session message count
chatHistorySchema.post('save', async function() {
    const ChatSession = mongoose.model('ChatSession');
    
    if (this.role === 'user' || this.role === 'assistant') {
        await ChatSession.findByIdAndUpdate(this.session, {
            $inc: { messageCount: 1 },
            lastMessageAt: new Date()
        });
    }
});

const ChatHistory = mongoose.model('ChatHistory', chatHistorySchema);
export default ChatHistory;