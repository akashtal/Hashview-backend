const QRCode = require('qrcode');
const { createCanvas, loadImage } = require('canvas');
const fs = require('fs');
const path = require('path');

// HashView Brand Colors
const BRAND_COLORS = {
  primary: '#210059',      // Main Purple
  secondary: '#FC8603',     // Orange
  accent: '#d651f3',       // Magenta/Pink
  white: '#FFFFFF',
  black: '#000000',
  lightGray: '#F5F5F5'
};

// Generate QR code for business with logo and branding
exports.generateBusinessQRCode = async (businessId, businessName) => {
  try {
    const qrData = {
      type: 'business',
      id: businessId,
      name: businessName,
      timestamp: new Date().toISOString()
    };

    // Step 1: Generate base QR code with brand colors
    const qrCodeBuffer = await QRCode.toBuffer(JSON.stringify(qrData), {
      errorCorrectionLevel: 'H', // High error correction to allow logo overlay
      type: 'png',
      width: 800,
      margin: 2,
      color: {
        dark: BRAND_COLORS.primary,    // QR code dark modules (purple)
        light: BRAND_COLORS.white       // QR code light modules (white)
      }
    });

    // Step 2: Load QR code image and logo
    const qrImage = await loadImage(qrCodeBuffer);
    
    // Try to load logo from different possible locations
    let logoImage = null;
    const logoPaths = [
      path.join(__dirname, '../assets/HashViewlogo-01.png'),
      path.join(process.cwd(), 'backend/assets/HashViewlogo-01.png'),
      path.join(process.cwd(), 'assets/HashViewlogo-01.png'),
      path.join(__dirname, '../../frontend/assets/HashViewlogo-01.png'),
      path.join(process.cwd(), 'frontend/assets/HashViewlogo-01.png')
    ];

    for (const logoPath of logoPaths) {
      if (fs.existsSync(logoPath)) {
        try {
          logoImage = await loadImage(logoPath);
          console.log(`✅ Logo loaded from: ${logoPath}`);
          break;
        } catch (err) {
          console.log(`⚠️ Could not load logo from ${logoPath}:`, err.message);
        }
      }
    }

    if (!logoImage) {
      console.log('⚠️ Logo not found, generating QR code without logo overlay');
    }

    // Step 3: Create canvas with padding and branding
    const padding = 60; // Padding around QR code
    const logoSize = 120; // Logo size in center
    const qrSize = 800;
    const canvasWidth = qrSize + (padding * 2);
    const canvasHeight = qrSize + (padding * 2) + 100; // Extra space for text at bottom

    const canvas = createCanvas(canvasWidth, canvasHeight);
    const ctx = canvas.getContext('2d');

    // Step 4: Draw background with gradient
    const gradient = ctx.createLinearGradient(0, 0, canvasWidth, canvasHeight);
    gradient.addColorStop(0, BRAND_COLORS.lightGray);
    gradient.addColorStop(1, BRAND_COLORS.white);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);

    // Step 5: Draw border with brand color
    ctx.strokeStyle = BRAND_COLORS.primary;
    ctx.lineWidth = 8;
    ctx.strokeRect(20, 20, canvasWidth - 40, canvasHeight - 40);

    // Step 6: Draw inner border with secondary color
    ctx.strokeStyle = BRAND_COLORS.secondary;
    ctx.lineWidth = 4;
    ctx.strokeRect(30, 30, canvasWidth - 60, canvasHeight - 60);

    // Step 7: Draw QR code in center
    ctx.drawImage(qrImage, padding, padding, qrSize, qrSize);

    // Step 8: Overlay logo in center of QR code (if available)
    if (logoImage) {
      const logoX = padding + (qrSize / 2) - (logoSize / 2);
      const logoY = padding + (qrSize / 2) - (logoSize / 2);
      
      // Draw white background circle for logo
      ctx.fillStyle = BRAND_COLORS.white;
      ctx.beginPath();
      ctx.arc(padding + qrSize / 2, padding + qrSize / 2, logoSize / 2 + 10, 0, Math.PI * 2);
      ctx.fill();

      // Draw logo
      ctx.save();
      ctx.beginPath();
      ctx.arc(padding + qrSize / 2, padding + qrSize / 2, logoSize / 2, 0, Math.PI * 2);
      ctx.clip();
      ctx.drawImage(logoImage, logoX, logoY, logoSize, logoSize);
      ctx.restore();

      // Draw border around logo
      ctx.strokeStyle = BRAND_COLORS.primary;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(padding + qrSize / 2, padding + qrSize / 2, logoSize / 2 + 5, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Step 9: Add business name at bottom (if space allows)
    if (businessName && businessName.length < 30) {
      ctx.fillStyle = BRAND_COLORS.primary;
      ctx.font = 'bold 28px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(businessName, canvasWidth / 2, padding + qrSize + 40);
      
      // Add "Scan for Details" text
      ctx.fillStyle = BRAND_COLORS.secondary;
      ctx.font = '18px Arial';
      ctx.fillText('Scan for Business Details', canvasWidth / 2, padding + qrSize + 70);
    }

    // Step 10: Convert canvas to data URL
    const dataURL = canvas.toDataURL('image/png');
    return dataURL;
  } catch (error) {
    console.error('Error generating styled QR code:', error);
    // Fallback to simple QR code if styling fails
    try {
      const qrCodeString = await QRCode.toDataURL(JSON.stringify({
        type: 'business',
        id: businessId,
        name: businessName,
        timestamp: new Date().toISOString()
      }), {
        errorCorrectionLevel: 'H',
        type: 'image/png',
        width: 300,
        margin: 1,
        color: {
          dark: BRAND_COLORS.primary,
          light: BRAND_COLORS.white
        }
      });
      return qrCodeString;
    } catch (fallbackError) {
      throw new Error('Failed to generate QR code: ' + fallbackError.message);
    }
  }
};

// Parse QR code data (for mobile app)
exports.parseQRCodeData = (qrDataString) => {
  try {
    const parsed = JSON.parse(qrDataString);
    if (parsed.type === 'business' && parsed.id) {
      return {
        valid: true,
        businessId: parsed.id,
        businessName: parsed.name,
        data: parsed
      };
    }
    return {
      valid: false,
      error: 'Invalid QR code format'
    };
  } catch (error) {
    return {
      valid: false,
      error: 'Invalid QR code data'
    };
  }
};

// Generate QR code for coupon
exports.generateCouponQRCode = async (couponCode, couponData) => {
  try {
    const qrData = {
      type: 'coupon',
      code: couponCode,
      ...couponData,
      timestamp: new Date().toISOString()
    };

    const qrCodeString = await QRCode.toDataURL(JSON.stringify(qrData), {
      errorCorrectionLevel: 'H',
      type: 'image/png',
      width: 300,
      margin: 1,
      color: {
        dark: BRAND_COLORS.secondary,  // Orange for coupons
        light: BRAND_COLORS.white
      }
    });

    return qrCodeString;
  } catch (error) {
    throw new Error('Failed to generate QR code: ' + error.message);
  }
};

// Verify QR code data
exports.verifyQRCode = (qrData) => {
  try {
    const parsed = JSON.parse(qrData);
    return {
      valid: true,
      data: parsed
    };
  } catch (error) {
    return {
      valid: false,
      error: 'Invalid QR code data'
    };
  }
};
