require('dotenv').config();
const mongoose = require('mongoose');

const MONGODB_URI = 'mongodb+srv://hashview2025:hashview@hashviewapp.fvr6ve4.mongodb.net/hashview?retryWrites=true&w=majority';

async function fixBusinessRatingDirectly() {
    try {
        await mongoose.connect(MONGODB_URI);
        console.log('✅ Connected\n');

        // Update directly in MongoDB without using the model
        const result = await mongoose.connection.db.collection('businesses').updateMany(
            { rating: { $type: 'number' } }, // Find documents where rating is a number
            [{
                $set: {
                    rating: {
                        average: '$rating',
                        count: { $ifNull: ['$reviewCount', 0] }
                    }
                }
            }]
        );

        console.log(`✅ Updated ${result.modifiedCount} businesses`);

    } catch (error) {
        console.error('❌ Error:', error.message);
    } finally {
        await mongoose.disconnect();
        console.log('🔌 Disconnected');
    }
}

fixBusinessRatingDirectly();
