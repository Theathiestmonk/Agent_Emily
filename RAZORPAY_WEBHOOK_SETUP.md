# Razorpay Webhook Setup Guide

## 🎯 **Overview**
This guide explains how to set up Razorpay webhooks to automatically activate subscriptions when payments are completed.

## 🔧 **Current Issues Fixed**

### 1. **Webhook Handler Updated**
- ✅ Added service role key usage for admin access
- ✅ Added payment amount validation (₹10 for starter, ₹20 for pro)
- ✅ Added proper error handling and logging
- ✅ Added payment transaction recording

### 2. **Payment Link Events**
- ✅ Added `payment_link.paid` event handling
- ✅ Extracts subscription ID from payment description
- ✅ Validates payment amounts match plan prices

## 📋 **Setup Steps**

### Step 1: Configure Razorpay Webhook URL

1. **Go to Razorpay Dashboard**
   - Visit: https://dashboard.razorpay.com/
   - Login to your account

2. **Navigate to Webhooks**
   - Go to **Settings** → **Webhooks**
   - Click **Add New Webhook**

3. **Configure Webhook**
   - **Webhook URL**: `https://your-backend-url.com/subscription/webhook`
   - **Events to Subscribe**: Select `payment_link.paid`
   - **Secret**: Generate a strong secret key (save this!)

4. **Update Environment Variables**
   ```bash
   RAZORPAY_WEBHOOK_SECRET=your_generated_secret_key
   ```

### Step 2: Test Webhook

Run the test script to verify webhook functionality:

```bash
cd backend
source venv/bin/activate
python test_webhook.py
```

### Step 3: Deploy Backend

Make sure your backend is deployed and accessible at the webhook URL.

## 🔄 **How It Works**

### Payment Flow:
1. **User clicks "Choose Plan"** → Creates payment link with subscription ID
2. **User pays on Razorpay** → Payment processed
3. **Razorpay sends webhook** → `payment_link.paid` event
4. **Webhook handler processes** → Validates amount, activates subscription
5. **User redirected** → Payment success page → Dashboard

### Webhook Processing:
```python
# 1. Extract payment details
payment_id = payment.get("id")
amount = payment.get("amount")  # in paise
subscription_id = extract_from_description()

# 2. Validate payment amount
if amount != expected_amount:
    reject_payment()

# 3. Activate subscription
update_user_profile({
    "subscription_status": "active",
    "subscription_start_date": now,
    "subscription_end_date": now + 30_days
})

# 4. Record transaction
insert_payment_transaction()
```

## 🛡️ **Security Features**

### 1. **Amount Validation**
- Only accepts exact amounts: ₹10 (1000 paise) for starter, ₹20 (2000 paise) for pro
- Rejects payments with incorrect amounts

### 2. **Webhook Signature Verification**
- Verifies Razorpay signature using webhook secret
- Prevents unauthorized webhook calls

### 3. **Service Role Access**
- Uses service role key for database updates
- Ensures webhook has necessary permissions

## 🐛 **Troubleshooting**

### Common Issues:

1. **Webhook not receiving events**
   - Check webhook URL is accessible
   - Verify events are subscribed in Razorpay dashboard
   - Check webhook secret is correct

2. **Subscription not activating**
   - Check webhook logs for errors
   - Verify service role key has correct permissions
   - Check if subscription ID is being extracted correctly

3. **Payment amount validation failing**
   - Verify plan prices in database match expected amounts
   - Check if billing cycle (monthly/yearly) is correct

### Debug Commands:

```bash
# Check webhook logs
tail -f /var/log/your-app/webhook.log

# Test webhook manually
python test_webhook.py

# Check user subscription status
python activate_with_service_key.py
```

## 📊 **Monitoring**

### Webhook Events Logged:
- Payment received
- Amount validation
- User lookup
- Subscription activation
- Transaction recording

### Database Tables Updated:
- `profiles` → subscription status, dates
- `subscription_transactions` → payment records
- `subscription_webhooks` → webhook events

## 🚀 **Testing**

### Test Payment Flow:
1. Go to subscription page
2. Select a plan (₹10 or ₹20)
3. Complete payment on Razorpay
4. Check if subscription activates automatically
5. Verify user can access dashboard

### Manual Testing:
```bash
# Test webhook handler
python test_webhook.py

# Check user status
python activate_with_service_key.py
```

## 📝 **Next Steps**

1. **Configure webhook URL** in Razorpay dashboard
2. **Deploy updated backend** with webhook fixes
3. **Test payment flow** end-to-end
4. **Monitor webhook logs** for any issues
5. **Set up alerts** for failed webhook processing

---

**Note**: Make sure to test thoroughly in a staging environment before going live!
