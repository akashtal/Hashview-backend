const Review = require('../models/Review.model');
const Coupon = require('../models/Coupon.model');
const Business = require('../models/Business.model');

// @desc    Get business analytics
// @route   GET /api/business/:id/analytics
// @access  Private (Business owner, Admin)
exports.getBusinessAnalytics = async (req, res, next) => {
  try {
    const { id: businessId } = req.params;
    const { timeRange = 'week' } = req.query; // week, month, year

    // Verify business exists
    const business = await Business.findById(businessId);
    if (!business) {
      return res.status(404).json({
        success: false,
        message: 'Business not found'
      });
    }

    // Check authorization
    if (business.owner.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to view these analytics'
      });
    }

    // Calculate date range
    const now = new Date();
    let startDate = new Date();
    
    switch (timeRange) {
      case 'week':
        startDate.setDate(now.getDate() - 7);
        break;
      case 'month':
        startDate.setMonth(now.getMonth() - 1);
        break;
      case 'year':
        startDate.setFullYear(now.getFullYear() - 1);
        break;
      default:
        startDate.setDate(now.getDate() - 7);
    }

    // Get reviews in time range
    const reviews = await Review.find({
      business: businessId,
      createdAt: { $gte: startDate }
    }).populate('user', 'name profileImage');

    // Get all-time reviews for comparison
    const allReviews = await Review.find({ business: businessId });

    // Get coupons in time range
    const coupons = await Coupon.find({
      business: businessId,
      createdAt: { $gte: startDate }
    }).populate('user', 'name');

    // Calculate basic stats
    const totalReviews = reviews.length;
    const previousPeriodReviews = allReviews.length - totalReviews;
    const reviewsGrowth = previousPeriodReviews > 0 
      ? Math.round(((totalReviews - previousPeriodReviews) / previousPeriodReviews) * 100)
      : totalReviews > 0 ? 100 : 0;

    const averageRating = reviews.length > 0
      ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
      : 0;

    const couponsIssued = coupons.length;
    const couponsRedeemed = coupons.filter(c => c.status === 'redeemed').length;
    const redemptionRate = couponsIssued > 0 
      ? Math.round((couponsRedeemed / couponsIssued) * 100) 
      : 0;

    // Rating distribution
    const ratingDistribution = {
      5: allReviews.filter(r => r.rating === 5).length,
      4: allReviews.filter(r => r.rating === 4).length,
      3: allReviews.filter(r => r.rating === 3).length,
      2: allReviews.filter(r => r.rating === 2).length,
      1: allReviews.filter(r => r.rating === 1).length
    };

    // Reviews over time
    const reviewsOverTime = generateTimeSeriesData(reviews, timeRange);

    // Peak hours analysis
    const peakHours = generatePeakHoursData(reviews);

    // Coupon types performance
    const couponTypes = [
      { type: 'Percentage', count: coupons.filter(c => c.rewardType === 'percentage').length },
      { type: 'Fixed', count: coupons.filter(c => c.rewardType === 'fixed').length },
      { type: 'B1G1', count: coupons.filter(c => c.rewardType === 'buy1get1').length },
      { type: 'Free', count: coupons.filter(c => c.rewardType === 'free_drink').length }
    ].filter(ct => ct.count > 0);

    // Additional stats
    const verifiedReviews = allReviews.filter(r => r.verified).length;
    const helpfulVotes = allReviews.reduce((sum, r) => sum + (r.helpfulCount || 0), 0);
    const totalViews = business.viewCount || 0;
    
    // Response rate (reviews with business reply)
    const reviewsWithReply = allReviews.filter(r => r.businessReply).length;
    const responseRate = allReviews.length > 0 
      ? Math.round((reviewsWithReply / allReviews.length) * 100) 
      : 0;

    res.status(200).json({
      success: true,
      analytics: {
        totalReviews,
        reviewsGrowth,
        averageRating,
        couponsIssued,
        couponsRedeemed,
        redemptionRate,
        ratingDistribution,
        reviewsOverTime,
        peakHours,
        couponTypes,
        verifiedReviews,
        helpfulVotes,
        totalViews,
        responseRate
      }
    });
  } catch (error) {
    next(error);
  }
};

// Helper: Generate time series data
function generateTimeSeriesData(reviews, timeRange) {
  const labels = [];
  const data = [];
  const now = new Date();

  if (timeRange === 'week') {
    // Last 7 days
    for (let i = 6; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      const dayName = date.toLocaleDateString('en-US', { weekday: 'short' });
      labels.push(dayName);
      
      const dayStart = new Date(date.setHours(0, 0, 0, 0));
      const dayEnd = new Date(date.setHours(23, 59, 59, 999));
      const count = reviews.filter(r => {
        const reviewDate = new Date(r.createdAt);
        return reviewDate >= dayStart && reviewDate <= dayEnd;
      }).length;
      
      data.push(count);
    }
  } else if (timeRange === 'month') {
    // Last 4 weeks
    for (let i = 3; i >= 0; i--) {
      const weekStart = new Date(now);
      weekStart.setDate(weekStart.getDate() - (i * 7 + 6));
      const weekEnd = new Date(now);
      weekEnd.setDate(weekEnd.getDate() - (i * 7));
      
      labels.push(`Week ${4 - i}`);
      
      const count = reviews.filter(r => {
        const reviewDate = new Date(r.createdAt);
        return reviewDate >= weekStart && reviewDate <= weekEnd;
      }).length;
      
      data.push(count);
    }
  } else {
    // Last 12 months
    for (let i = 11; i >= 0; i--) {
      const date = new Date(now);
      date.setMonth(date.getMonth() - i);
      const monthName = date.toLocaleDateString('en-US', { month: 'short' });
      labels.push(monthName);
      
      const monthStart = new Date(date.getFullYear(), date.getMonth(), 1);
      const monthEnd = new Date(date.getFullYear(), date.getMonth() + 1, 0);
      
      const count = reviews.filter(r => {
        const reviewDate = new Date(r.createdAt);
        return reviewDate >= monthStart && reviewDate <= monthEnd;
      }).length;
      
      data.push(count);
    }
  }

  return { labels, data };
}

// Helper: Generate peak hours data
function generatePeakHoursData(reviews) {
  const hourCounts = new Array(24).fill(0);
  
  reviews.forEach(review => {
    const hour = new Date(review.createdAt).getHours();
    hourCounts[hour]++;
  });

  // Group into 6 time periods
  const periods = [
    { label: '12-4 AM', hours: [0, 1, 2, 3] },
    { label: '4-8 AM', hours: [4, 5, 6, 7] },
    { label: '8-12 PM', hours: [8, 9, 10, 11] },
    { label: '12-4 PM', hours: [12, 13, 14, 15] },
    { label: '4-8 PM', hours: [16, 17, 18, 19] },
    { label: '8-12 AM', hours: [20, 21, 22, 23] }
  ];

  const labels = periods.map(p => p.label);
  const data = periods.map(p => 
    p.hours.reduce((sum, hour) => sum + hourCounts[hour], 0)
  );

  return { labels, data };
}
