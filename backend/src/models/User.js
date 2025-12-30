import mongoose from "mongoose";
import bcrypt from "bcryptjs";

const UserSchema = new mongoose.Schema({
    email: {
        type: String,
        required: true,
        unique: true,
        lowercase: true,
        trim: true,
    },
    password: {
        type: String,
        required: true,
        select: false,
    },
    googleId: {
        type: String,
        unique: true,
        sparse: true,
    },
    authMethod: {
        type: String,
        enum: ['local', 'google'],
        default: 'local',
    },

    // User profile information
    name: {
        type: String,
        required: true,
        trim: true,
    },
    avatarUrl: {
        type: String,
        default: '',
    },

    // Account Status
    isActive: {
        type: Boolean,
        default: true,
    },
    isVerified: {
        type: Boolean,
        default: false,
    },

    refreshTokens: [{
        token: String,
        expiresAt: Date,
        createdAt: {
            type: Date,
            default: Date.now,
        },
    }],
    lastLogin: Date,
    loginHistory: [{
        timestamp: Date,
        ipAddress: String,
        userAgent: String,
    }],

    // Timestamps
    createdAt: {
        type: Date,
        default: Date.now,
    },
    updatedAt: {
        type: Date,
        default: Date.now,
    },
}, {
    timestamps: true,
});

UserSchema.pre('save', async function(next) {
    if(!this.isModified('password') || this.authMethod !== 'local') return next();

    try {
        const salt = await bcrypt.genSalt(10);
        this.password = await bcrypt.hash(this.password, salt);
        next();
    } catch (error) {
        next(error);
    }
});

UserSchema.pre('save', function(next) {
    this.updatedAt = Date.now();
    next();
});

UserSchema.methods.comparePassword = async function(candidatePassword) {
    if(this.authMethod !== 'local') return false;
    return bcrypt.compare(candidatePassword, this.password);
};

UserSchema.methods.addRefreshToken = function(token, expiresAt) {
    this.refreshTokens.push({token, expiresAt});
    return this.save();
};

UserSchema.methods.removeRefreshToken = function(token) {
    this.refreshTokens = this.refreshTokens.filter(t = t.token !== token);
    return this.save();
};

UserSchema.methods.clearRereshTokens = function() {
    this.refreshTokens = [];
    return this.save();
};

export const User = mongoose.model('User', UserSchema);