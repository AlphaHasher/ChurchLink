#!/usr/bin/env python3
"""
Webhook monitoring script - monitors incoming webhooks in real-time
Run this while testing PayPal webhook simulator
"""

import asyncio
import logging
import sys
import os
from datetime import datetime

# Add the backend directory to the Python path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

# Configure logging to show webhook events in real-time
logging.basicConfig(
    level=logging.INFO, 
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(sys.stdout),
        logging.FileHandler('webhook_monitor.log')
    ]
)

async def monitor_webhook_logs():
    """Monitor webhook logs in real-time"""
    
    print("🔍 WEBHOOK MONITOR STARTED")
    print("=" * 50)
    print("📝 Monitoring webhook activity...")
    print("🌐 Test PayPal webhooks at: https://developer.paypal.com/dashboard/webhooksSimulator")
    print("🔗 Webhook endpoint: http://localhost:8000/paypal/webhook")
    print("📧 Expected event: PAYMENT.SALE.COMPLETED")
    print("")
    print("🟢 Waiting for webhooks... (Press Ctrl+C to stop)")
    print("=" * 50)
    
    # Monitor the payment audit log file
    log_file = "logs/payment_audit.log"
    webhook_keywords = [
        "PayPal Webhook received",
        "🔔",
        "PAYMENT.SALE.COMPLETED", 
        "Webhook updated",
        "✅ Webhook",
        "❌ Webhook"
    ]
    
    last_size = 0
    if os.path.exists(log_file):
        last_size = os.path.getsize(log_file)
    
    webhook_count = 0
    
    try:
        while True:
            await asyncio.sleep(1)  # Check every second
            
            if os.path.exists(log_file):
                current_size = os.path.getsize(log_file)
                
                if current_size > last_size:
                    # File has grown, read new content
                    with open(log_file, 'r', encoding='utf-8') as f:
                        f.seek(last_size)
                        new_content = f.read()
                        
                    # Check for webhook-related content
                    lines = new_content.strip().split('\n')
                    for line in lines:
                        if line.strip() and any(keyword in line for keyword in webhook_keywords):
                            webhook_count += 1
                            timestamp = datetime.now().strftime("%H:%M:%S")
                            print(f"🔔 [{timestamp}] WEBHOOK EVENT #{webhook_count}:")
                            print(f"    {line.strip()}")
                            print("")
                    
                    last_size = current_size
                    
    except KeyboardInterrupt:
        print("\n" + "=" * 50)
        print(f"📊 WEBHOOK MONITORING SUMMARY:")
        print(f"   Total webhook events detected: {webhook_count}")
        print(f"   Monitor duration: {datetime.now().strftime('%H:%M:%S')}")
        if webhook_count == 0:
            print("\n❌ No webhooks received!")
            print("🔧 Troubleshooting steps:")
            print("   1. Check PayPal webhook URL configuration")
            print("   2. Ensure webhook URL is: http://localhost:8000/paypal/webhook")
            print("   3. Verify webhook events include PAYMENT.SALE.COMPLETED")
            print("   4. Use ngrok for external access if testing from PayPal")
        else:
            print(f"\n✅ Webhooks are working! Detected {webhook_count} events.")
        print("=" * 50)

async def test_webhook_availability():
    """Test if webhook endpoint is accessible"""
    
    import aiohttp
    
    webhook_url = "http://localhost:8000/paypal/webhook"
    
    test_payload = {
        "event_type": "PAYMENT.SALE.COMPLETED",
        "resource": {
            "id": "TEST_SALE_123",
            "parent_payment": "TEST_PARENT_123",
            "amount": {"total": "50.00", "currency": "USD"},
            "state": "completed"
        }
    }
    
    try:
        async with aiohttp.ClientSession() as session:
            async with session.post(webhook_url, json=test_payload, timeout=5) as response:
                status = response.status
                text = await response.text()
                
                if status == 200:
                    print(f"✅ Webhook endpoint is accessible")
                    print(f"   URL: {webhook_url}")
                    print(f"   Status: {status}")
                    print(f"   Response: {text[:100]}...")
                    return True
                else:
                    print(f"❌ Webhook endpoint returned status {status}")
                    return False
                    
    except Exception as e:
        print(f"❌ Cannot reach webhook endpoint: {e}")
        print("💡 Make sure backend server is running: python main.py")
        return False

async def main():
    """Main function"""
    
    print("🚀 PayPal Webhook Monitor & Tester")
    print("This tool helps verify PayPal webhook configuration")
    print("")
    
    # Test webhook availability first
    print("1️⃣ Testing webhook endpoint accessibility...")
    webhook_available = await test_webhook_availability()
    print("")
    
    if not webhook_available:
        print("❌ Cannot proceed - webhook endpoint not accessible")
        print("🔧 Start your backend server first: python main.py")
        return
    
    print("2️⃣ Starting real-time webhook monitoring...")
    print("🌐 Now go to PayPal webhook simulator and send a test webhook!")
    print("")
    
    await monitor_webhook_logs()

if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\n👋 Webhook monitoring stopped by user")
    except Exception as e:
        print(f"\n❌ Error: {e}")
        import traceback
        traceback.print_exc()