from models.transaction import Transaction
import logging

async def save_paypal_transaction(transaction_data: dict):
    """
    Save a PayPal transaction (one-time or subscription) to MongoDB using Transaction model.
    """
    logging.info(f"Attempting to save PayPal transaction: {transaction_data}")
    try:
        transaction = Transaction(**transaction_data)
        result = await Transaction.create_transaction(transaction)
        logging.info(f"Transaction saved successfully: {result}")
        return result
    except Exception as e:
        logging.error(f"Error saving PayPal transaction: {e}")
        raise
