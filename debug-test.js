import notificationService from './src/services/notificationService.js';
import pdfReceiptService from './src/services/pdfReceiptService.js';

console.log('🔧 Starting debug test...');

async function debugTest() {
    try {
        console.log('1. Testing notification service...');
        const emailConfigValid = !!(process.env.SMTP_USER && process.env.SMTP_PASS);
        console.log(`   Email configured: ${emailConfigValid}`);
        
        console.log('2. Testing PDF service...');
        const pdfServiceValid = typeof pdfReceiptService.generateBookingReceipt === 'function';
        console.log(`   PDF service available: ${pdfServiceValid}`);
        
        console.log('3. Testing simple booking flow...');
        
        const testBooking = {
            id: 'DEBUG-TEST-001',
            guest_name: 'Debug User',
            guest_email: 'debug@example.com',
            hotel_name: 'Debug Hotel',
            city: 'Debug City',
            check_in_date: '2024-12-01',
            check_out_date: '2024-12-03',
            guests: 1,
            payment_method: 'Credit Card',
            total_amount: 1000,
            booking_status: 'confirmed',
            booking_date: new Date().toISOString()
        };
        
        // Test email
        console.log('   Testing email...');
        try {
            await notificationService.sendBookingConfirmation(testBooking, testBooking.guest_email);
            console.log('   ✅ Email sent successfully');
        } catch (emailError) {
            console.log(`   ❌ Email failed: ${emailError.message}`);
        }
        
        // Test PDF
        console.log('   Testing PDF...');
        try {
            const pdfPath = await pdfReceiptService.generateBookingReceipt(testBooking);
            console.log(`   ✅ PDF generated: ${pdfPath}`);
        } catch (pdfError) {
            console.log(`   ❌ PDF failed: ${pdfError.message}`);
        }
        
        console.log('🎉 Debug test completed!');
        
    } catch (error) {
        console.log(`❌ Debug test failed: ${error.message}`);
        console.log(error.stack);
    }
}

debugTest();