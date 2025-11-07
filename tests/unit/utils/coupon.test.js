const { generateCouponCode, calculateCouponExpiry } = require('../../../utils/coupon');

describe('Coupon Utils', () => {
  describe('generateCouponCode', () => {
    it('should generate a coupon code with correct format', () => {
      const code = generateCouponCode();
      
      expect(code).toMatch(/^HASH-[A-Z0-9]{6}$/);
    });

    it('should generate unique codes', () => {
      const codes = new Set();
      for (let i = 0; i < 100; i++) {
        codes.add(generateCouponCode());
      }
      
      // All 100 codes should be unique
      expect(codes.size).toBe(100);
    });

    it('should generate codes with only uppercase letters and numbers', () => {
      const code = generateCouponCode();
      const codeBody = code.split('-')[1];
      
      expect(codeBody).toMatch(/^[A-Z0-9]+$/);
    });
  });

  describe('calculateCouponExpiry', () => {
    it('should return date 2 hours in the future', () => {
      const now = new Date();
      const expiry = calculateCouponExpiry();
      
      const diff = expiry - now;
      const twoHours = 2 * 60 * 60 * 1000; // 2 hours in milliseconds
      
      // Allow 1 second tolerance
      expect(diff).toBeGreaterThanOrEqual(twoHours - 1000);
      expect(diff).toBeLessThanOrEqual(twoHours + 1000);
    });

    it('should return a Date object', () => {
      const expiry = calculateCouponExpiry();
      
      expect(expiry).toBeInstanceOf(Date);
    });

    it('should return a valid date', () => {
      const expiry = calculateCouponExpiry();
      
      expect(expiry.getTime()).not.toBeNaN();
      expect(expiry > new Date()).toBe(true);
    });
  });
});

