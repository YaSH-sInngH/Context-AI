import mongoose from 'mongoose';

const vectorStoreSchema = new mongoose.Schema({
    // Source information
    sourceType: {
        type: String,
        required: true,
        enum: ['document', 'web', 'manual', 'knowledge-base']
    },
    
    sourceId: {
        type: String,
        required: true,
        index: true
    },
    
    // Content
    content: {
        type: String,
        required: true
    },
    
    metadata: {
        title: String,
        author: String,
        url: String,
        fileType: String,
        uploadedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        },
        tags: [String],
        pageNumber: Number,
        section: String
    },
    
    // Vector information
    embeddingId: {
        type: String,
        required: true,
        unique: true
    },
    
    embeddingModel: {
        type: String,
        default: 'text-embedding-ada-002'
    },
    
    // Usage tracking
    accessCount: {
        type: Number,
        default: 0
    },
    
    lastAccessed: {
        type: Date
    },
    
    // Timestamps
    createdAt: {
        type: Date,
        default: Date.now
    },
    
    updatedAt: {
        type: Date,
        default: Date.now
    }
}, {
    timestamps: true
});

// Indexes
vectorStoreSchema.index({ sourceType: 1, sourceId: 1 });
vectorStoreSchema.index({ 'metadata.tags': 1 });
vectorStoreSchema.index({ createdAt: -1 });

// Update lastAccessed timestamp
vectorStoreSchema.methods.incrementAccess = function() {
    this.accessCount += 1;
    this.lastAccessed = new Date();
    return this.save();
};

const VectorStore = mongoose.model('VectorStore', vectorStoreSchema);
export default VectorStore;