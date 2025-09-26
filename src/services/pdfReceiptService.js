import PDFDocument from 'pdfkit';
import fs from 'fs';
import path from 'path';
import { logEvent } from './logService.js';
import { getLogoPath } from '../utils/logoConverter.js';

/**
 * PDF Receipt Service - Generates booking confirmation receipts
 */
class PDFReceiptService {
    constructor() {
        this.receiptsDir = path.join(process.cwd(), 'receipts');
        this.ensureReceiptsDirectory();
    }

    /**
     * Ensure receipts directory exists
     */
    ensureReceiptsDirectory() {
        if (!fs.existsSync(this.receiptsDir)) {
            fs.mkdirSync(this.receiptsDir, { recursive: true });
        }
    }

    /**
     * Generate PDF receipt for booking
     * @param {Object} bookingData - Booking information
     * @param {string} language - Language for the receipt
     * @returns {Promise<string>} - Path to generated PDF file
     */
    async generateBookingReceipt(bookingData, language = 'en') {
        try {
            // Validate required booking data
            this.validateBookingData(bookingData);
            
            const fileName = `booking_receipt_${bookingData.id}_${Date.now()}.pdf`;
            const filePath = path.join(this.receiptsDir, fileName);

            // Create PDF document
            const doc = new PDFDocument({ margin: 50 });
            const stream = fs.createWriteStream(filePath);
            doc.pipe(stream);

            // Add content to PDF
            await this.addReceiptContent(doc, bookingData, language);

            // Finalize PDF
            doc.end();

            // Wait for file to be written
            await new Promise((resolve, reject) => {
                stream.on('finish', resolve);
                stream.on('error', reject);
            });

            await logEvent('info', 'PDF receipt generated successfully', {
                context: 'pdf_receipt_service',
                booking_id: bookingData?.id || 'unknown',
                file_path: filePath,
                language: language
            });

            return filePath;

        } catch (error) {
            await logEvent('error', 'PDF receipt generation failed', {
                context: 'pdf_receipt_service',
                booking_id: bookingData?.id || 'unknown',
                error: error.message,
                language: language
            });
            throw error;
        }
    }

    /**
     * Validate booking data before PDF generation
     * @param {Object} bookingData - Booking information to validate
     * @throws {Error} - If required data is missing or invalid
     */
    validateBookingData(bookingData) {
        if (!bookingData || typeof bookingData !== 'object') {
            throw new Error('Invalid booking data');
        }

        // Required fields
        const requiredFields = ['id'];
        for (const field of requiredFields) {
            if (!bookingData[field]) {
                throw new Error(`Missing required field: ${field}`);
            }
        }

        // Validate guest name
        const guestName = bookingData.guest_name || bookingData.first_name;
        if (!guestName || guestName.trim() === '') {
            throw new Error('Guest name is required');
        }

        // Validate hotel name
        if (!bookingData.hotel_name || bookingData.hotel_name.trim() === '') {
            throw new Error('Hotel name is required');
        }

        // Validate dates
        const checkInDate = bookingData.check_in_date || bookingData.check_in;
        const checkOutDate = bookingData.check_out_date || bookingData.check_out;
        
        if (checkInDate && checkOutDate) {
            const checkIn = new Date(checkInDate);
            const checkOut = new Date(checkOutDate);
            
            if (isNaN(checkIn.getTime()) || isNaN(checkOut.getTime())) {
                throw new Error('Invalid check-in or check-out date format');
            }
            
            if (checkOut <= checkIn) {
                throw new Error('Check-out date must be after check-in date');
            }
        }

        // Validate amount
        const amount = bookingData.total_price || bookingData.price_per_night || bookingData.total_amount;
        if (!amount || amount <= 0) {
            throw new Error('Valid booking amount is required');
        }
    }

    /**
     * Add content to PDF receipt
     * @param {PDFDocument} doc - PDF document
     * @param {Object} bookingData - Booking information
     * @param {string} language - Language for the receipt
     */
    async addReceiptContent(doc, bookingData, language) {
        const texts = this.getTexts(language);
        
        // Header with Logo
        try {
            const logoPath = await getLogoPath();
            if (logoPath && fs.existsSync(logoPath)) {
                // Add logo
                doc.image(logoPath, 50, 30, { width: 80, height: 80 });
                
                // Company name next to logo
                doc.fontSize(24)
                   .fillColor('#2c3e50')
                   .text('eQabo Hotels', 140, 50);
                   
                doc.fontSize(12)
                   .fillColor('#7f8c8d')
                   .text('Ethiopia\'s Premier Hotel Booking Platform', 140, 75);
            } else {
                // Fallback to text-only header
                doc.fontSize(24)
                   .fillColor('#2c3e50')
                   .text('🏨 eQabo Hotels', 50, 50);
            }
        } catch (error) {
            // Fallback to text-only header
            doc.fontSize(24)
               .fillColor('#2c3e50')
               .text('🏨 eQabo Hotels', 50, 50);
        }

        doc.fontSize(16)
           .fillColor('#34495e')
           .text(texts.bookingReceipt, 50, 120);

        // Booking ID and Date
        doc.fontSize(12)
           .fillColor('#7f8c8d')
           .text(`${texts.receiptDate}: ${new Date().toLocaleDateString()}`, 400, 50)
           .text(`${texts.bookingId}: ${bookingData.id}`, 400, 70);

        // Divider line
        doc.moveTo(50, 150)
           .lineTo(550, 150)
           .strokeColor('#bdc3c7')
           .stroke();

        // Guest Information
        let yPosition = 180;
        doc.fontSize(14)
           .fillColor('#2c3e50')
           .text(texts.guestInformation, 50, yPosition);

        yPosition += 25;
        doc.fontSize(11)
           .fillColor('#34495e')
           .text(`${texts.name}: ${bookingData.guest_name || bookingData.first_name || 'N/A'}`, 70, yPosition);

        yPosition += 20;
        doc.text(`${texts.email}: ${bookingData.guest_email || bookingData.email || 'N/A'}`, 70, yPosition);

        // Booking Details
        yPosition += 40;
        doc.fontSize(14)
           .fillColor('#2c3e50')
           .text(texts.bookingDetails, 50, yPosition);

        yPosition += 25;
        doc.fontSize(11)
           .fillColor('#34495e')
           .text(`${texts.hotel}: ${bookingData.hotel_name}`, 70, yPosition);

        yPosition += 20;
        doc.text(`${texts.city}: ${bookingData.city}`, 70, yPosition);

        yPosition += 20;
        doc.text(`${texts.checkIn}: ${bookingData.check_in_date || bookingData.check_in}`, 70, yPosition);

        yPosition += 20;
        doc.text(`${texts.checkOut}: ${bookingData.check_out_date || bookingData.check_out}`, 70, yPosition);

        yPosition += 20;
        doc.text(`${texts.guests}: ${bookingData.guests}`, 70, yPosition);

        yPosition += 20;
        doc.text(`${texts.paymentMethod}: ${bookingData.payment_method}`, 70, yPosition);

        // Price Information
        yPosition += 40;
        doc.fontSize(14)
           .fillColor('#2c3e50')
           .text(texts.priceDetails, 50, yPosition);

        yPosition += 25;
        doc.fontSize(11)
           .fillColor('#34495e')
           .text(`${texts.pricePerNight}: ${bookingData.total_price || bookingData.price_per_night || bookingData.total_amount} ETB`, 70, yPosition);

        // Calculate total nights and total amount
        if (bookingData.check_in_date && bookingData.check_out_date) {
            const checkIn = new Date(bookingData.check_in_date);
            const checkOut = new Date(bookingData.check_out_date);
            const nights = Math.ceil((checkOut - checkIn) / (1000 * 60 * 60 * 24));
            const totalAmount = (bookingData.total_price || bookingData.price_per_night || bookingData.total_amount) * nights;

            yPosition += 20;
            doc.text(`${texts.nights}: ${nights}`, 70, yPosition);

            yPosition += 20;
            doc.fontSize(12)
               .fillColor('#e74c3c')
               .text(`${texts.totalAmount}: ${totalAmount} ETB`, 70, yPosition);
        }

        // Status
        yPosition += 40;
        doc.fontSize(12)
           .fillColor('#27ae60')
           .text(`${texts.status}: ${texts.confirmed}`, 70, yPosition);

        // Footer
        yPosition += 60;
        doc.fontSize(10)
           .fillColor('#7f8c8d')
           .text(texts.footerText, 50, yPosition, { width: 500, align: 'center' });

        yPosition += 30;
        doc.text(texts.contactInfo, 50, yPosition, { width: 500, align: 'center' });

        // QR Code placeholder (you can add actual QR code generation later)
        yPosition += 40;
        doc.fontSize(8)
           .text(`${texts.bookingReference}: ${bookingData.id}`, 50, yPosition, { width: 500, align: 'center' });
    }

    /**
     * Get localized texts for receipt
     * @param {string} language - Language code
     * @returns {Object} - Localized texts
     */
    getTexts(language) {
        const texts = {
            en: {
                bookingReceipt: 'Booking Receipt',
                receiptDate: 'Receipt Date',
                bookingId: 'Booking ID',
                guestInformation: 'Guest Information',
                name: 'Name',
                email: 'Email',
                bookingDetails: 'Booking Details',
                hotel: 'Hotel',
                city: 'City',
                checkIn: 'Check-in Date',
                checkOut: 'Check-out Date',
                guests: 'Number of Guests',
                paymentMethod: 'Payment Method',
                priceDetails: 'Price Details',
                pricePerNight: 'Price per Night',
                nights: 'Number of Nights',
                totalAmount: 'Total Amount',
                status: 'Booking Status',
                confirmed: 'CONFIRMED',
                footerText: 'Thank you for choosing eQabo Hotels! We look forward to welcoming you.',
                contactInfo: 'For any inquiries, please contact us through our Telegram bot or visit eQabo.com',
                bookingReference: 'Booking Reference'
            },
            am: {
                bookingReceipt: 'የቦታ ምሕዛዝ ደረሰኝ',
                receiptDate: 'የደረሰኝ ቀን',
                bookingId: 'የቦታ ምሕዛዝ መለያ',
                guestInformation: 'የእንግዳ መረጃ',
                name: 'ስም',
                email: 'ኢሜል',
                bookingDetails: 'የቦታ ምሕዛዝ ዝርዝር',
                hotel: 'ሆቴል',
                city: 'ከተማ',
                checkIn: 'የመግቢያ ቀን',
                checkOut: 'የመውጫ ቀን',
                guests: 'የእንግዶች ቁጥር',
                paymentMethod: 'የክፍያ ዘዴ',
                priceDetails: 'የዋጋ ዝርዝር',
                pricePerNight: 'በሌሊት ዋጋ',
                nights: 'የሌሊቶች ቁጥር',
                totalAmount: 'ጠቅላላ መጠን',
                status: 'የቦታ ምሕዛዝ ሁኔታ',
                confirmed: 'ተረጋግጧል',
                footerText: 'eQabo ሆቴሎችን ስለመረጡ እናመሰግናለን! እርስዎን ለመቀበል እንጓጓለን።',
                contactInfo: 'ለማንኛውም ጥያቄ በቴሌግራም ቦት ወይም eQabo.com ላይ ያነጋግሩን',
                bookingReference: 'የቦታ ምሕዛዝ ማጣቀሻ'
            },
            ti: {
                bookingReceipt: 'ናይ ቦታ ምሕዛዝ ደረሰኝ',
                receiptDate: 'ናይ ደረሰኝ ዕለት',
                bookingId: 'ናይ ቦታ ምሕዛዝ መለለዪ',
                guestInformation: 'ናይ እንግዳ ሓበሬታ',
                name: 'ስም',
                email: 'ኢሜል',
                bookingDetails: 'ናይ ቦታ ምሕዛዝ ዝርዝር',
                hotel: 'ሆቴል',
                city: 'ከተማ',
                checkIn: 'ናይ መእተዊ ዕለት',
                checkOut: 'ናይ መውጻኢ ዕለት',
                guests: 'ቁጽሪ እንግዳታት',
                paymentMethod: 'ናይ ክፍሊት ኣገባብ',
                priceDetails: 'ናይ ዋጋ ዝርዝር',
                pricePerNight: 'ብሌሊት ዋጋ',
                nights: 'ቁጽሪ ሌላይቲ',
                totalAmount: 'ጠቅላላ መጠን',
                status: 'ናይ ቦታ ምሕዛዝ ኩነታት',
                confirmed: 'ተረጋጊጹ',
                footerText: 'eQabo ሆቴላት ስለመረጽኩም የቐንየልና! ንቀበልኩም ንጽበ።',
                contactInfo: 'ንዝኾነ ሕቶ ብቴሌግራም ቦት ወይ eQabo.com ላይ ተወከሱና',
                bookingReference: 'ናይ ቦታ ምሕዛዝ ማጣቀሲ'
            }
        };

        return texts[language] || texts.en;
    }

    /**
     * Clean up old receipt files (older than 7 days)
     */
    async cleanupOldReceipts() {
        try {
            const files = fs.readdirSync(this.receiptsDir);
            const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);

            for (const file of files) {
                const filePath = path.join(this.receiptsDir, file);
                const stats = fs.statSync(filePath);
                
                if (stats.mtime.getTime() < sevenDaysAgo) {
                    fs.unlinkSync(filePath);
                    await logEvent('info', 'Old receipt file cleaned up', {
                        context: 'pdf_receipt_service',
                        file_path: filePath
                    });
                }
            }
        } catch (error) {
            await logEvent('error', 'Receipt cleanup failed', {
                context: 'pdf_receipt_service',
                error: error.message
            });
        }
    }
}

// Create singleton instance
const pdfReceiptService = new PDFReceiptService();

export default pdfReceiptService;