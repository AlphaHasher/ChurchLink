import { useState } from "react";
import { PayPalScriptProvider, PayPalButtons } from "@paypal/react-paypal-js";

interface MessageProps {
  content: string;
}

// Renders errors or successful transactions on the screen.
function Message({ content }: MessageProps) {
  return <p>{content}</p>;
}

function Payment() {
  const initialOptions = {
    "clientId": import.meta.env.VITE_PAYPAL_CLIENT_ID,
    "enable-funding": "venmo",
    "disable-funding": "",
    "buyer-country": "US",
    currency: "USD",
    "data-page-type": "product-details",
    components: "buttons",
    "data-sdk-integration-source": "developer-studio",
};

  const [message, setMessage] = useState<string>("");

  return (
    <div className="paypal-button-container">
      <PayPalScriptProvider options={initialOptions}>
        <PayPalButtons
          style={{
            shape: "rect",
            layout: "vertical",
            color: "gold",
            label: "paypal",
          }}
          createOrder={async () => {
            try {
              const response = await fetch(`${import.meta.env.VITE_API_HOST}/api/v1/paypal/orders`, {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                },
                // use the "body" param to optionally pass additional order information
                // like product ids and quantities
                body: JSON.stringify({
                  cart: [
                    {
                      id: "21",
                      quantity: "1",
                    },
                  ],
                }),
              });

              const orderData = await response.json();
              console.log("PayPal order data:", orderData);

              // Handle case where response is a string instead of a JSON object
              let parsedData = orderData;
              if (typeof orderData === 'string') {
                try {
                  parsedData = JSON.parse(orderData);
                  console.log("Parsed order data:", parsedData);
                } catch (parseError) {
                  console.error("Failed to parse response as JSON:", parseError);
                }
              }
              
              const orderId = parsedData.id || orderData.id;
              console.log("ID value:", orderId);
              
              if (orderId) {
                console.log("Returning order ID:", orderId);
                return orderId;
              } else {
                const errorDetail = parsedData?.details?.[0] || orderData?.details?.[0];
                const errorMessage = errorDetail
                  ? `${errorDetail.issue} ${errorDetail.description} (${parsedData.debug_id || orderData.debug_id})`
                  : JSON.stringify(orderData);

                throw new Error(errorMessage);
              }
            } catch (error) {
              console.error(error);
              setMessage(`Could not initiate PayPal Checkout...${error}`);
              return "";
            }
          }}
          onApprove={async (data, actions) => {
            try {
              const response = await fetch(
                `${import.meta.env.VITE_API_HOST}/api/v1/paypal/orders/${data.orderID}/capture`,
                {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/json",
                  },
                }
              );

              const orderData = await response.json();
              // Three cases to handle:
              //   (1) Recoverable INSTRUMENT_DECLINED -> call actions.restart()
              //   (2) Other non-recoverable errors -> Show a failure message
              //   (3) Successful transaction -> Show confirmation or thank you message

              const errorDetail = orderData?.details?.[0];

              if (errorDetail?.issue === "INSTRUMENT_DECLINED") {
                // (1) Recoverable INSTRUMENT_DECLINED -> call actions.restart()
                // recoverable state, per https://developer.paypal.com/docs/checkout/standard/customize/handle-funding-failures/
                return actions.restart();
              } else if (errorDetail) {
                // (2) Other non-recoverable errors -> Show a failure message
                throw new Error(
                  `${errorDetail.description} (${orderData.debug_id})`
                );
              } else {
                // (3) Successful transaction -> Show confirmation or thank you message
                // Or go to another URL:  actions.redirect('thank_you.html');
                const transaction =
                  orderData.purchase_units?.[0].payments.captures[0];
                setMessage(
                  `Transaction ${transaction?.status}: ${transaction?.id}. See console for all available details`
                );
                console.log(
                  "Capture result",
                  orderData,
                  JSON.stringify(orderData, null, 2)
                );
              }
            } catch (error) {
              console.error(error);
              setMessage(
                `Sorry, your transaction could not be processed...${error}`
              );
            }
          }}
        />
      </PayPalScriptProvider>
      <Message content={message} />
    </div>
  );
}

export default Payment;
