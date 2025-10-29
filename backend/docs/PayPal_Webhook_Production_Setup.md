# PayPal Webhook Production Setup Guide

## Overview

PayPal webhooks are essential for handling external payment events like refunds, disputes, and subscription cancellations that occur outside your application. This guide covers setting up webhooks for production deployment.

## Important Notes

- **Development Environment**: Webhooks don't work with `localhost` - PayPal cannot reach your local development server
- **Production Only**: Webhook setup is required only for production deployments with public URLs
- **Normal Payments**: User-initiated payments work fine without webhooks (handled synchronously)
- **External Events**: Webhooks catch events from PayPal dashboard, disputes, and subscription changes

## Webhook Events We Handle

### Primary Events (Recommended)
- `PAYMENT.SALE.COMPLETED` - Backup for missed transaction creation
- `PAYMENT.SALE.REFUNDED` - Refunds initiated from PayPal website
- `PAYMENT.SALE.DENIED` - Failed payments after initial success
- `BILLING.SUBSCRIPTION.CANCELLED` - Subscription cancellations from PayPal

### Additional Events (Optional)
- `PAYMENT.DISPUTE.CREATED` - Customer disputes payment
- `PAYMENT.CAPTURE.COMPLETED` - Alternative payment completion event
- `BILLING.SUBSCRIPTION.SUSPENDED` - Subscription suspended
- `BILLING.SUBSCRIPTION.REACTIVATED` - Subscription reactivated

## Production Setup Steps

### 1. PayPal Developer Dashboard Configuration

1. **Login to PayPal Developer Console**
   - Go to: https://developer.paypal.com/
   - Login with your PayPal business account

2. **Select Your Production App**
   - Navigate to "My Apps & Credentials"
   - Switch to "Live" environment
   - Select your production application

3. **Create Webhook**
   - Click "Add Webhook" button
   - Enter your production webhook URL: `https://yourdomain.com/api/v1/webhook-listener/paypal/webhook`
   - Select the events listed above

4. **Get Webhook ID**
   - Copy the Webhook ID from the dashboard
   - You'll need this for verification (optional but recommended)

### 2. Server Environment Configuration

Add these environment variables to your production server:

```bash
# PayPal Configuration
PAYPAL_CLIENT_ID=your_live_client_id
PAYPAL_CLIENT_SECRET=your_live_client_secret
PAYPAL_MODE=live

# Webhook Configuration (Optional - for verification)
PAYPAL_WEBHOOK_ID=your_webhook_id_from_dashboard
```

### 3. Server Requirements

Your production server must:
- ✅ Have a **public domain** (not IP address)
- ✅ Use **HTTPS** (SSL certificate required)
- ✅ Be accessible from internet (no firewall blocking)
- ✅ Return HTTP 200 for successful webhook processing

### 4. Webhook URL Format

Your webhook endpoint will be:
```
https://yourdomain.com/api/v1/webhook-listener/paypal/webhook
```

**Examples:**
- ✅ `https://api.mychurch.org/api/v1/webhook-listener/paypal/webhook`
- ✅ `https://church-backend.herokuapp.com/api/v1/webhook-listener/paypal/webhook`
- ❌ `http://localhost:8000/api/v1/webhook-listener/paypal/webhook` (localhost)
- ❌ `http://myserver.com/...` (not HTTPS)

## Testing Webhook Setup

### 1. Webhook Simulator (PayPal Dashboard)
1. Go to PayPal Developer Dashboard
2. Navigate to your webhook
3. Click "Simulate Events"
4. Send test `PAYMENT.SALE.COMPLETED` event
5. Check your server logs for webhook reception

### 2. Manual Testing
1. Create a test payment in production
2. Refund it from PayPal dashboard
3. Check logs for `PAYMENT.SALE.REFUNDED` webhook

### 3. Log Verification
Look for these log entries:
```
🔔 PayPal Webhook received: PAYMENT.SALE.REFUNDED
✅ Webhook payload validated successfully
🔄 Webhook updated transaction status to REFUNDED
```

## Common Production Issues

### Issue 1: Webhook Not Received
**Symptoms:** No webhook logs appear
**Solutions:**
- Verify URL is publicly accessible
- Check HTTPS certificate validity
- Ensure no firewall blocking port 443/80
- Test URL with online tools like webhook.site

### Issue 2: SSL Certificate Problems
**Symptoms:** PayPal reports SSL errors
**Solutions:**
- Verify certificate is valid and not self-signed
- Use tools like SSL Labs to test certificate
- Ensure intermediate certificates are properly configured

### Issue 3: HTTP 500 Errors
**Symptoms:** Webhook returns server errors
**Solutions:**
- Check server logs for Python errors
- Verify database connectivity
- Test webhook endpoint manually with curl

### Issue 4: Authentication Failures
**Symptoms:** PayPal reports authentication errors
**Solutions:**
- Verify `PAYPAL_CLIENT_ID` and `PAYPAL_CLIENT_SECRET`
- Ensure using LIVE credentials (not sandbox)
- Check PayPal app is approved for production

## Webhook Security

### Signature Verification (Recommended)
Our webhook handler includes payload validation:

```python
# Automatic validation in webhook handler
validated_payload = validate_webhook_payload(payload)
payment_info = extract_payment_info(validated_payload)
```

### Additional Security Measures
1. **IP Whitelist** (optional): Restrict to PayPal IP ranges
2. **Rate Limiting**: Implement webhook rate limiting
3. **Duplicate Prevention**: We handle duplicate webhook events
4. **Logging**: All webhook events are logged for audit

## Development vs Production

| Feature | Development | Production |
|---------|-------------|------------|
| Webhook URL | ❌ localhost (won't work) | ✅ Public HTTPS domain |
| Payment Events | ✅ Handled synchronously | ✅ Handled synchronously |
| External Events | ❌ Not available | ✅ Webhooks catch them |
| Refunds | ❌ Manual status update | ✅ Automatic via webhook |
| Disputes | ❌ Not handled | ✅ Webhook notification |

## Deployment Checklist

- [ ] Production PayPal app created and approved
- [ ] Live PayPal credentials configured
- [ ] Webhook URL configured in PayPal dashboard
- [ ] Server has valid SSL certificate
- [ ] Webhook endpoint is publicly accessible
- [ ] Test webhook with PayPal simulator
- [ ] Monitor logs for webhook activity
- [ ] Test refund scenario from PayPal dashboard

## Troubleshooting Commands

### Test webhook endpoint accessibility:
```bash
curl -X POST https://yourdomain.com/api/v1/webhook-listener/paypal/webhook \
  -H "Content-Type: application/json" \
  -d '{"test": "webhook"}'
```

### Check SSL certificate:
```bash
openssl s_client -connect yourdomain.com:443 -servername yourdomain.com
```

### Monitor webhook logs:
```bash
tail -f /path/to/your/logs | grep "PayPal Webhook"
```

## Support

If you encounter issues:

1. **Check server logs** for detailed error messages
2. **Verify PayPal dashboard** webhook status
3. **Test with webhook simulator** in PayPal dashboard
4. **Ensure all environment variables** are set correctly
5. **Follow the [PayPal Webhook Troubleshooting Guide](./PayPal_Webhook_Troubleshooting.md)** for step-by-step diagnostics

For PayPal-specific webhook issues, consult:
- [PayPal Webhook Documentation](https://developer.paypal.com/docs/api/webhooks/)
- [PayPal Webhook Events Reference](https://developer.paypal.com/docs/api/webhooks/event-names/)

---

*Remember: Your application works perfectly without webhooks for normal user payments. Webhooks are only needed for external events like refunds from PayPal dashboard or disputes.*