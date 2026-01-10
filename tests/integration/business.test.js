const request = require('supertest');
const mongoose = require('mongoose');
const { app } = require('../../server');
const User = require('../../models/User.model');
const Business = require('../../models/Business.model');

describe('Business API Integration Tests', () => {
  let businessOwnerToken;
  let businessOwnerId;

  beforeAll(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(process.env.MONGODB_URI);
    }
  });

  beforeEach(async () => {
    // Clear collections
    await User.deleteMany({});
    await Business.deleteMany({});

    // Create business owner
    const response = await request(app)
      .post('/api/auth/register')
      .send({
        name: 'Business Owner',
        email: 'owner@example.com',
        phone: '9876543210',
        password: 'Owner@123',
        role: 'business'
      });

    businessOwnerToken = response.body.data.token;
    businessOwnerId = response.body.data.user.id;
  });

  afterAll(async () => {
    await User.deleteMany({});
    await Business.deleteMany({});
    await mongoose.connection.close();
  });

  describe('POST /api/business/register', () => {
    it('should register a new business successfully', async () => {
      const businessData = {
        name: 'Test Restaurant',
        category: 'restaurant',
        email: 'restaurant@example.com',
        phone: '1234567890',
        address: {
          street: '123 Main St',
          city: 'New York',
          state: 'NY',
          country: 'USA',
          zipCode: '10001'
        },
        location: {
          type: 'Point',
          coordinates: [-74.0060, 40.7128] // [longitude, latitude]
        },
        description: 'A great restaurant'
      };

      const response = await request(app)
        .post('/api/business/register')
        .set('Authorization', `Bearer ${businessOwnerToken}`)
        .send(businessData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.name).toBe(businessData.name);
      expect(response.body.data.status).toBe('pending');
      expect(response.body.data.kycStatus).toBe('pending');
    });

    it('should require authentication', async () => {
      const businessData = {
        name: 'Test Restaurant',
        category: 'restaurant',
        email: 'restaurant@example.com',
        phone: '1234567890',
        location: {
          type: 'Point',
          coordinates: [-74.0060, 40.7128]
        }
      };

      const response = await request(app)
        .post('/api/business/register')
        .send(businessData)
        .expect(401);

      expect(response.body.success).toBe(false);
    });

    it('should validate required fields', async () => {
      const response = await request(app)
        .post('/api/business/register')
        .set('Authorization', `Bearer ${businessOwnerToken}`)
        .send({
          name: 'Test Restaurant'
          // Missing required fields
        })
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    it('should validate location coordinates', async () => {
      const businessData = {
        name: 'Test Restaurant',
        category: 'restaurant',
        email: 'restaurant@example.com',
        phone: '1234567890',
        location: {
          type: 'Point',
          coordinates: [200, 100] // Invalid coordinates
        }
      };

      const response = await request(app)
        .post('/api/business/register')
        .set('Authorization', `Bearer ${businessOwnerToken}`)
        .send(businessData)
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    it('should set default radius to 50 meters', async () => {
      const businessData = {
        name: 'Test Restaurant',
        category: 'restaurant',
        email: 'restaurant@example.com',
        phone: '1234567890',
        location: {
          type: 'Point',
          coordinates: [-74.0060, 40.7128]
        }
      };

      const response = await request(app)
        .post('/api/business/register')
        .set('Authorization', `Bearer ${businessOwnerToken}`)
        .send(businessData);

      expect(response.body.data.radius).toBe(50);
    });
  });

  describe('GET /api/business/nearby', () => {
    beforeEach(async () => {
      // Create some test businesses
      const businesses = [
        {
          name: 'Nearby Restaurant 1',
          owner: businessOwnerId,
          category: 'restaurant',
          email: 'rest1@example.com',
          phone: '1111111111',
          location: {
            type: 'Point',
            coordinates: [-74.0060, 40.7128] // New York
          },
          status: 'active'
        },
        {
          name: 'Nearby Restaurant 2',
          owner: businessOwnerId,
          category: 'restaurant',
          email: 'rest2@example.com',
          phone: '2222222222',
          location: {
            type: 'Point',
            coordinates: [-74.0070, 40.7130] // ~100m away
          },
          status: 'active'
        },
        {
          name: 'Far Restaurant',
          owner: businessOwnerId,
          category: 'restaurant',
          email: 'rest3@example.com',
          phone: '3333333333',
          location: {
            type: 'Point',
            coordinates: [-118.2437, 34.0522] // Los Angeles
          },
          status: 'active'
        }
      ];

      await Business.insertMany(businesses);
    });

    it('should return businesses within specified radius', async () => {
      const response = await request(app)
        .get('/api/business/nearby')
        .query({
          latitude: 40.7128,
          longitude: -74.0060,
          maxDistance: 5000 // 5km
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.length).toBe(2); // Should return 2 nearby businesses
    });

    it('should require latitude and longitude', async () => {
      const response = await request(app)
        .get('/api/business/nearby')
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    it('should use default maxDistance if not provided', async () => {
      const response = await request(app)
        .get('/api/business/nearby')
        .query({
          latitude: 40.7128,
          longitude: -74.0060
        })
        .expect(200);

      expect(response.body.success).toBe(true);
    });

    it('should only return active businesses', async () => {
      // Create a pending business
      await Business.create({
        name: 'Pending Restaurant',
        owner: businessOwnerId,
        category: 'restaurant',
        email: 'pending@example.com',
        phone: '4444444444',
        location: {
          type: 'Point',
          coordinates: [-74.0062, 40.7129]
        },
        status: 'pending'
      });

      const response = await request(app)
        .get('/api/business/nearby')
        .query({
          latitude: 40.7128,
          longitude: -74.0060,
          maxDistance: 5000
        });

      // Should still return 2 active businesses, not the pending one
      expect(response.body.data.length).toBe(2);
      const statuses = response.body.data.map(b => b.status);
      expect(statuses.every(status => status === 'active')).toBe(true);
    });
  });

  describe('GET /api/business/:id', () => {
    let businessId;

    beforeEach(async () => {
      const business = await Business.create({
        name: 'Test Restaurant',
        owner: businessOwnerId,
        category: 'restaurant',
        email: 'restaurant@example.com',
        phone: '1234567890',
        location: {
          type: 'Point',
          coordinates: [-74.0060, 40.7128]
        },
        status: 'active'
      });

      businessId = business._id;
    });

    it('should get business by ID', async () => {
      const response = await request(app)
        .get(`/api/business/${businessId}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.name).toBe('Test Restaurant');
    });

    it('should return 404 for non-existent business', async () => {
      const fakeId = new mongoose.Types.ObjectId();
      
      const response = await request(app)
        .get(`/api/business/${fakeId}`)
        .expect(404);

      expect(response.body.success).toBe(false);
    });

    it('should return 400 for invalid ID format', async () => {
      const response = await request(app)
        .get('/api/business/invalid-id')
        .expect(400);

      expect(response.body.success).toBe(false);
    });
  });
});

