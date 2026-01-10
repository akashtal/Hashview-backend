const express = require('express');
const router = express.Router();
const {
  submitSupportTicket,
  getMyTickets,
  getTicket,
  addTicketResponse,
  getAllTickets,
  updateTicketStatus
} = require('../controllers/support.controller');
const { protect, authorize } = require('../middleware/auth.middleware');

// User routes
router.post('/ticket', protect, submitSupportTicket);
router.get('/my-tickets', protect, getMyTickets);
router.get('/ticket/:id', protect, getTicket);
router.post('/ticket/:id/response', protect, addTicketResponse);

// Admin routes
router.get('/admin/tickets', protect, authorize('admin'), getAllTickets);
router.put('/admin/ticket/:id/status', protect, authorize('admin'), updateTicketStatus);

module.exports = router;

