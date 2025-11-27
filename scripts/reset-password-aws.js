const mongoose = require('mongoose');
const User = require('../models/User.model');
require('dotenv').config();

// Hardcoded URI from the previous step since we can't rely on .env being loaded correctly if we run this script standalone without the full environment setup
const MONGODB_URI = 'mongodb+srv://hashview2025:hashview@hashviewapp.fvr6ve4.mongodb.net/hashview?retryWrites=true&w=majority';

const EMAIL = 'djtalukdar290@gmail.com';
const NEW_PASSWORD = 'Akashtal';

async function resetPassword() {
    try {
        console.log('Connecting to MongoDB...');
        await mongoose.connect(MONGODB_URI);
        console.log('✅ Connected to MongoDB');

        const user = await User.findOne({ email: EMAIL });

        if (!user) {
            console.log(`❌ User not found: ${EMAIL}`);
            process.exit(1);
        }

        console.log(`Found user: ${user.name} (${user._id})`);

        // Update password - the pre-save hook in User.model.js will hash it
        user.passwordHash = NEW_PASSWORD;
        await user.save();

        console.log('✅ Password reset successfully!');

    } catch (error) {
        console.error('❌ Error:', error);
    } finally {
        await mongoose.disconnect();
        process.exit(0);
    }
}

resetPassword();
