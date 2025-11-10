import React, { useEffect, useState } from "react";
import { Card, Form, Input, Button, message, Tabs, Space, Tag } from "antd";
import api from "@/api/api";
import { PlusOutlined } from "@ant-design/icons";

interface PayPalSettings {
  PAYPAL_PLAN_NAME?: string;
  PAYPAL_PLAN_DESCRIPTION?: string;
  PAYPAL_MODE?: string;
  ALLOWED_FUNDS?: string[];
}

const PayPalSettingsComponent: React.FC = () => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [settings, setSettings] = useState<PayPalSettings | null>(null);
  const [newFund, setNewFund] = useState<string>("");
  const [funds, setFunds] = useState<string[]>([]);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    setLoading(true);
    try {
      const response = await api.get("/v1/finance/paypal/settings");
      const paypalSettings: PayPalSettings = response.data.settings || {};
      setSettings(paypalSettings);

      if (paypalSettings.ALLOWED_FUNDS) setFunds(paypalSettings.ALLOWED_FUNDS as string[]);

      form.setFieldsValue({
        PAYPAL_PLAN_NAME: paypalSettings.PAYPAL_PLAN_NAME || "",
        PAYPAL_PLAN_DESCRIPTION: paypalSettings.PAYPAL_PLAN_DESCRIPTION || "",
      });
    } catch (error) {
      console.error("Error fetching PayPal settings:", error);
      message.error("Failed to load PayPal settings");
    } finally {
      setLoading(false);
    }
  };

  const onFinish = async (values: any) => {
    setLoading(true);
    try {
      const dbSettings = {
        PAYPAL_PLAN_NAME: values.PAYPAL_PLAN_NAME,
        PAYPAL_PLAN_DESCRIPTION: values.PAYPAL_PLAN_DESCRIPTION,
        ALLOWED_FUNDS: funds,
      };

      const response = await api.post("/v1/finance/paypal/settings", dbSettings);
      if (response.data.success) {
        message.success("PayPal settings updated successfully");
        fetchSettings();
      } else {
        message.error("Failed to update PayPal settings");
      }
    } catch (error) {
      console.error("Error updating PayPal settings:", error);
      message.error("Failed to update PayPal settings");
    } finally {
      setLoading(false);
    }
  };

  const addFund = () => {
    if (newFund && !funds.includes(newFund)) {
      setFunds([...funds, newFund]);
      setNewFund("");
    }
  };

  const removeFund = (fund: string) => setFunds(funds.filter((f) => f !== fund));

  const tabItems = [
    {
      key: "subscription",
      label: "Subscription Settings",
      children: (
        <>
          {settings?.PAYPAL_MODE && (
            <div style={{ marginBottom: "16px" }}>
              <div style={{ fontWeight: "bold" }}>PayPal Mode:</div>
              <div>{settings.PAYPAL_MODE === "sandbox" ? "Sandbox (Testing)" : "Live (Production)"}</div>
            </div>
          )}
          
          <Form.Item name="PAYPAL_PLAN_NAME" label="Plan Name" rules={[{ required: true, message: "Please enter the subscription plan name" }]}>
            <Input placeholder="e.g., Church Donation Subscription" />
          </Form.Item>

          <Form.Item name="PAYPAL_PLAN_DESCRIPTION" label="Plan Description" rules={[{ required: true, message: "Please enter the subscription plan description" }]}>
            <Input placeholder="e.g., Recurring donation to Church" />
          </Form.Item>
        </>
      ),
    },
    {
      key: "funds",
      label: "Fund Options",
      children: (
        <Form.Item label="Available Funds (E.g., General, Building, Missions)">
          <Space direction="vertical" style={{ width: "100%" }}>
            <Space style={{ marginBottom: "10px" }}>
              <Input placeholder="Add new fund type" value={newFund} onChange={(e) => setNewFund(e.target.value)} onPressEnter={addFund} />
              <Button type="primary" icon={<PlusOutlined />} onClick={addFund}>Add Fund</Button>
            </Space>

            <div style={{ marginTop: "10px" }}>
              {funds.map((fund) => (
                <Tag key={fund} closable onClose={() => removeFund(fund)} style={{ margin: "5px" }}>{fund}</Tag>
              ))}
            </div>
          </Space>
        </Form.Item>
      ),
    },
  ];

  return (
    <Card title="PayPal Donation Settings" style={{ marginBottom: "20px" }}>
      <Form form={form} layout="vertical" onFinish={onFinish} initialValues={settings || {}}>
        <Tabs defaultActiveKey="subscription" items={tabItems} />

        <Form.Item>
          <Button type="primary" htmlType="submit" loading={loading}>Save Settings</Button>
        </Form.Item>
      </Form>
    </Card>
  );
};

export default PayPalSettingsComponent;