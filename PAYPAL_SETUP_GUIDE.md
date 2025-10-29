# PayPal Integration Setup Guide 🏦

PayPal-specific configuration for ChurchLink payment system.

## 📋 Prerequisites

- ChurchLink project already cloned and basic setup completed
- Backend and frontend environment files already created
- PayPal Developer Account
- Internet connection

---

## 🔧 Part 1: PayPal Developer Account Setup

### Step 1: Create PayPal Developer Account
1. Go to [PayPal Developer Portal](https://developer.paypal.com/)
2. Click **"Get Started"** or **"Sign In"**
3. Use your existing PayPal account or create a new one
4. Complete the developer account verification

### Step 2: Create Application
1. Log into [PayPal Developer Dashboard](https://developer.paypal.com/dashboard/)
2. Click **"Create App"** button
3. Fill in the application details:
   ```
   App Name: ChurchLink Payment System
   Merchant: [Your Business/Personal Account]
   Features: Accept payments via PayPal (checked)
   ```
4. Click **"Create App"**

### Step 3: Get API Credentials
After creating the app, you'll see:
- **Client ID**: `AYour_PayPal_Client_ID_Will_Appear_Here`
- **Client Secret**: `EYour_PayPal_Client_Secret_Will_Appear_Here`

**⚠️ Important**: These are your SANDBOX credentials for testing!

---

## 🏗️ Part 2: Backend PayPal Configuration

### Step 1: Configure PayPal Environment Variables
Edit `backend/.env` file and add your PayPal credentials:

```bash
# PayPal Configuration (SANDBOX - for testing)
PAYPAL_CLIENT_ID=your_paypal_client_id_from_dashboard
PAYPAL_CLIENT_SECRET=your_paypal_client_secret_from_dashboard
PAYPAL_MODE=sandbox
```

---

## 🔗 Part 3: PayPal Webhook Configuration

### Step 1: Set Up Webhook URL (Development)

For local development, you'll need to expose your local server to the internet:

#### Option A: Using ngrok (Recommended)
1. Install ngrok: [https://ngrok.com/](https://ngrok.com/)
2. Start ngrok tunnel:
   ```bash
   ngrok http 8000
   ```
3. Copy the HTTPS URL (e.g., `https://abc123.ngrok.io`)

#### Option B: Using localhost.run
```bash
ssh -R 80:localhost:8000 nokey@localhost.run
```

### Step 2: Configure Webhook in PayPal Dashboard
1. Go to [PayPal Developer Dashboard](https://developer.paypal.com/dashboard/)
2. Select your app
3. Click **"Add Webhook"**
4. Configure webhook:
   ```
   Webhook URL: https://your-ngrok-url.ngrok.io/paypal/webhook
   Event types: 
   ✅ Payment sale completed
   ✅ Payment sale refunded
   ✅ Payment capture completed
   ✅ Payment capture denied
   ```
5. Click **"Save"**

### Step 3: Test Webhook (Optional)
For debugging webhook events, you can monitor the backend logs directly or check the PayPal Developer Dashboard for webhook delivery status.

---

## 🧪 Part 4: Testing PayPal Integration

### Step 1: Create Test PayPal Accounts
1. Go to [PayPal Sandbox Accounts](https://developer.paypal.com/dashboard/accounts)
2. Click **"Create Account"**
3. Create two accounts:
   - **Business Account** (receives payments)
   - **Personal Account** (makes payments)

### Step 2: Test Payment Flow
1. Navigate to an event or form with payment in your application
2. Select PayPal payment option
3. Use sandbox personal account credentials to complete payment
4. Verify transaction in:
   - Backend logs
   - Database (MongoDB)
   - PayPal sandbox dashboard

### Step 3: Test Webhook Delivery
1. Complete a payment in sandbox
2. Check backend logs for webhook events:
   ```
   🔔 PayPal Webhook received: PAYMENT.SALE.COMPLETED
   ✅ Webhook payload validated successfully
   💰 Payment info: {...}
   ```

---

## 🚀 Part 5: Production Deployment

### Step 1: Get Production Credentials
1. Go to PayPal Developer Dashboard
2. Switch to **"Live"** mode
3. Create a new live application
4. Get live Client ID and Secret

### Step 2: Update Production Environment
```bash
# Production .env
PAYPAL_CLIENT_ID=your_live_client_id
PAYPAL_CLIENT_SECRET=your_live_client_secret
PAYPAL_MODE=live

# Production Frontend URL
FRONTEND_URL=https://your-domain.com
```

### Step 3: Configure Production Webhooks
1. Update webhook URL to production domain:
   ```
   https://your-domain.com/paypal/webhook
   ```
2. Verify SSL certificate is valid
3. Test webhook delivery in production

---

## 🔍 Part 6: Troubleshooting

### Common Issues & Solutions

#### 1. "PayPal credentials not configured"
**Problem**: Environment variables not loaded
**Solution**: 
- Check `.env` file exists in backend directory
- Verify environment variables are set correctly
- Restart backend server after changing `.env`

#### 2. "Invalid PayPal credentials"
**Problem**: Wrong Client ID or Secret
**Solution**:
- Verify credentials in PayPal Dashboard
- Ensure you're using sandbox credentials for testing
- Check for extra spaces or newlines in `.env`

#### 3. "Webhook not received"
**Problem**: Webhook URL not accessible
**Solution**:
- Verify ngrok tunnel is running
- Check webhook URL in PayPal dashboard
- Ensure backend server is running on correct port

#### 4. "CORS error in browser"
**Problem**: Frontend can't connect to backend
**Solution**:
- Check backend CORS configuration
- Ensure backend is running on correct port

#### 5. "Payment capture failed"
**Problem**: PayPal order capture issues
**Solution**:
- Check PayPal order status in dashboard
- Verify webhook events are configured
- Check backend logs for detailed error messages

### Debug Commands
```bash
# Check PayPal configuration
curl http://localhost:8000/health

# Test PayPal token generation manually in Python
python -c "import sys; sys.path.append('backend'); from helpers.paypalHelper import get_paypal_access_token; print(get_paypal_access_token())"

# Check environment variables
python -c "import os; print(f'ID: {os.getenv(\"PAYPAL_CLIENT_ID\")[:10]}...'); print(f'Mode: {os.getenv(\"PAYPAL_MODE\")}')"
```

---

## 📝 Part 7: PayPal Environment Variables Reference

### Backend (.env)
```bash
# Required PayPal Configuration
PAYPAL_CLIENT_ID=your_paypal_client_id
PAYPAL_CLIENT_SECRET=your_paypal_client_secret
PAYPAL_MODE=sandbox  # or 'live' for production
```

---

## ✅ PayPal Setup Checklist

- [ ] PayPal Developer account created
- [ ] PayPal application created and credentials obtained  
- [ ] Backend `.env` configured with PayPal credentials
- [ ] Webhook URL configured in PayPal dashboard (for production)
- [ ] Test payment completed successfully
- [ ] Webhook delivery verified

---

## 📞 Support

If you encounter PayPal-specific issues:

1. **Check Logs**: Backend logs show detailed PayPal integration status
2. **PayPal Dashboard**: Monitor transactions and webhook events
3. **Developer Tools**: Use browser network tab to debug PayPal API calls

---

## 🔐 Security Notes

- **Never commit** `.env` files to version control
- **Use sandbox** credentials for development/testing
- **Validate webhooks** to ensure they come from PayPal
- **Use HTTPS** in production for webhook URLs
- **Rotate credentials** periodically for security

---

**🎉 Congratulations!** Your PayPal integration is now set up and ready for payments!