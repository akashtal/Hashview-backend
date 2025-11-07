const SupportTicket = require('../models/SupportTicket.model');
const { sendEmail } = require('../utils/emailService');

// @desc    Submit a support ticket
// @route   POST /api/support/ticket
// @access  Private
exports.submitSupportTicket = async (req, res, next) => {
  try {
    const { subject, message, category, priority } = req.body;

    // Validation
    if (!subject || !message) {
      return res.status(400).json({
        success: false,
        message: 'Subject and message are required'
      });
    }

    const ticket = await SupportTicket.create({
      user: req.user.id,
      subject,
      message,
      category: category || 'general',
      priority: priority || 'medium'
    });

    // Populate user details
    await ticket.populate('user', 'name email');

    // Send confirmation email to user
    try {
      await sendEmail({
        to: req.user.email,
        subject: `Support Ticket Created: ${ticket.subject}`,
        html: `
          <h2>Support Ticket Submitted</h2>
          <p>Hi ${req.user.name},</p>
          <p>Your support ticket has been successfully submitted. Our team will review it and get back to you within 24 hours.</p>
          <p><strong>Ticket ID:</strong> ${ticket._id}</p>
          <p><strong>Subject:</strong> ${ticket.subject}</p>
          <p><strong>Status:</strong> ${ticket.status}</p>
          <p>Thank you for contacting HashView Support!</p>
        `
      });
    } catch (emailError) {
      console.error('Failed to send ticket confirmation email:', emailError);
    }

    res.status(201).json({
      success: true,
      message: 'Support ticket submitted successfully',
      ticket
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get user's support tickets
// @route   GET /api/support/my-tickets
// @access  Private
exports.getMyTickets = async (req, res, next) => {
  try {
    const tickets = await SupportTicket.find({ user: req.user.id })
      .sort({ createdAt: -1 })
      .select('-responses');

    res.status(200).json({
      success: true,
      count: tickets.length,
      tickets
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get single ticket details
// @route   GET /api/support/ticket/:id
// @access  Private
exports.getTicket = async (req, res, next) => {
  try {
    const ticket = await SupportTicket.findById(req.params.id)
      .populate('user', 'name email')
      .populate('responses.author', 'name email');

    if (!ticket) {
      return res.status(404).json({
        success: false,
        message: 'Ticket not found'
      });
    }

    // Check if user owns the ticket or is admin
    if (ticket.user._id.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to view this ticket'
      });
    }

    res.status(200).json({
      success: true,
      ticket
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Add response to ticket
// @route   POST /api/support/ticket/:id/response
// @access  Private
exports.addTicketResponse = async (req, res, next) => {
  try {
    const { message } = req.body;

    if (!message) {
      return res.status(400).json({
        success: false,
        message: 'Response message is required'
      });
    }

    const ticket = await SupportTicket.findById(req.params.id);

    if (!ticket) {
      return res.status(404).json({
        success: false,
        message: 'Ticket not found'
      });
    }

    // Check if user owns the ticket or is admin
    if (ticket.user.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to respond to this ticket'
      });
    }

    ticket.responses.push({
      message,
      author: req.user.id,
      createdAt: new Date()
    });

    // Update status if it was closed
    if (ticket.status === 'closed') {
      ticket.status = 'open';
    }

    await ticket.save();
    await ticket.populate('responses.author', 'name email');

    res.status(200).json({
      success: true,
      message: 'Response added successfully',
      ticket
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get all support tickets (Admin only)
// @route   GET /api/support/admin/tickets
// @access  Private (Admin)
exports.getAllTickets = async (req, res, next) => {
  try {
    const { status, priority, page = 1, limit = 20 } = req.query;
    const skip = (page - 1) * limit;

    const query = {};
    if (status) query.status = status;
    if (priority) query.priority = priority;

    const tickets = await SupportTicket.find(query)
      .populate('user', 'name email')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await SupportTicket.countDocuments(query);

    res.status(200).json({
      success: true,
      count: tickets.length,
      total,
      page: parseInt(page),
      pages: Math.ceil(total / limit),
      tickets
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update ticket status (Admin only)
// @route   PUT /api/support/admin/ticket/:id/status
// @access  Private (Admin)
exports.updateTicketStatus = async (req, res, next) => {
  try {
    const { status, assignedTo } = req.body;

    const ticket = await SupportTicket.findById(req.params.id);

    if (!ticket) {
      return res.status(404).json({
        success: false,
        message: 'Ticket not found'
      });
    }

    if (status) {
      ticket.status = status;
      if (status === 'resolved') ticket.resolvedAt = new Date();
      if (status === 'closed') ticket.closedAt = new Date();
    }

    if (assignedTo) {
      ticket.assignedTo = assignedTo;
    }

    await ticket.save();

    res.status(200).json({
      success: true,
      message: 'Ticket updated successfully',
      ticket
    });
  } catch (error) {
    next(error);
  }
};

module.exports = exports;

