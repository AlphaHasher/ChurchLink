import React, { useEffect, useState } from "react";
import {
  Card,
  Table,
  Badge,
  Button,
  Modal,
  Input,
  Select,
  DatePicker,
  Row,
  Col,
  Tabs,
} from "antd";
import { DownloadOutlined, BarChartOutlined, SettingOutlined } from "@ant-design/icons";
import type { ColumnsType } from "antd/es/table";
import dayjs from "dayjs";
import api from "@/api/api";
import { Chart, CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend } from 'chart.js';
import PayPalSettingsComponent from "../components/Finance/PayPalSettings";
Chart.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend);
import { App, ConfigProvider, theme } from "antd";

// Types
interface Transaction {
  id: string;
  user_email: string;
  name?: string; // Donor name
  amount: number;
  date: string;
  type: string;
  status: string;
  payment_method: string;
  subscription_id?: string;
  order_id?: string;
  transaction_id?: string;
  plan_id?: string;
  next_billing_time?: string;
  currency?: string;
  event_type?: string;
  note?: string;
  metadata?: {
    shipping_address?: any;
    shipping_line_1?: string;
    shipping_line_2?: string;
    shipping_city?: string;
    shipping_state?: string;
    shipping_postal_code?: string;
    shipping_country_code?: string;
    [key: string]: any;
  };
}

// Add this interface for subscriptions
export interface DonationSubscription {
  id?: string;
  user_email: string;
  name?: string; // Donor name
  amount: number;
  status: string;
  time?: string;
  date?: string; // Added date property to match Transaction interface
  payment_method?: string;
  type?: string;
  subscription_id: string;
  plan_id?: string;
  start_time?: string;
  next_billing_time?: string;
  note?: string;
  currency?: string;
  event_type?: string;
  created_on?: string;
  recurrence?: string;
  cycles?: number;
  start_date?: string;
}

const statusColors: Record<string, string> = {
  completed: "green",
  refunded: "red",
  pending: "orange",
  cancelled: "gray",
};

const FinancePage: React.FC = () => {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [filtered, setFiltered] = useState<Transaction[]>([]);
  const [selected, setSelected] = useState<Transaction | null>(null);
  const [filter, setFilter] = useState({
    type: "",
    status: "",
    donor: "",
    dateRange: [null, null] as [string | null, string | null],
  });
  const [showModal, setShowModal] = useState(false);
  const [activeTab, setActiveTab] = useState<string>("transactions");
  // Use DonationSubscription type for subscriptions state
  const [subscriptions, setSubscriptions] = useState<DonationSubscription[]>([]);

  useEffect(() => {
    const fetchDonations = async () => {
      try {
        const response = await api.get("/v1/paypal_admin/admin/transactions");
        let txs = response.data.transactions || [];
        // Map created_on to date for frontend display
        txs = txs.map((t: any) => ({ ...t, date: t.date || t.created_on || t.time || "" }));
        setTransactions(txs);
        setFiltered(txs);
      } catch (err: any) {
        console.error("Fetch error:", err);
      }
    };
    fetchDonations();
  }, []);

  useEffect(() => {
    const fetchSubscriptions = async () => {
      try {
        const response = await api.get("/v1/paypal_admin/admin/subscriptions");
        let subs: DonationSubscription[] = response.data.subscriptions || [];
        subs = subs.map((s: any) => ({ ...s, date: s.date || s.created_on || s.start_date || "" }));
        setSubscriptions(subs);
      } catch (err: any) {
        console.error("Fetch subscriptions error:", err);
      }
    };
    fetchSubscriptions();
  }, []);

  useEffect(() => {
    let data = [...transactions];
    if (filter.type) data = data.filter((t) => t.type === filter.type);
    if (filter.status) data = data.filter((t) => t.status === filter.status);
    if (filter.donor) {
      const search = filter.donor.toLowerCase();
      data = data.filter((t) => {
        return Object.values(t).some(v => {
          if (v == null) return false;
          if (typeof v === "string") return v.toLowerCase().includes(search);
          if (typeof v === "number" || typeof v === "boolean") return v.toString().toLowerCase().includes(search);
          return false;
        });
      });
    }
    if (filter.dateRange[0] && filter.dateRange[1]) {
      data = data.filter(
        (t) =>
          dayjs(t.date).isAfter(dayjs(filter.dateRange[0])) &&
          dayjs(t.date).isBefore(dayjs(filter.dateRange[1]))
      );
    }
    setFiltered(data);
  }, [transactions, filter]);

  // Summary stats
  const totalDonations = transactions.reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
  const totalSubscriptions = transactions.filter((t) => t.type === "subscription").reduce((sum, t) => sum + t.amount, 0);
  const totalRefunds = transactions.filter((t) => t.status === "refunded").reduce((sum, t) => sum + t.amount, 0);
  const netIncome = totalDonations - totalRefunds;

  // Table columns
  const columns: ColumnsType<Transaction> = [
    { 
      title: "Donor", 
      dataIndex: "name", 
      key: "donor", 
      sorter: (a, b) => ((a.name || a.user_email) || "").localeCompare((b.name || b.user_email) || ""),
      render: (name, record) => name || record.user_email || "Anonymous"
    },
    { title: "Amount", dataIndex: "amount", key: "amount", sorter: (a, b) => a.amount - b.amount, render: (v, r) => `${r.currency || "USD"} ${v}` },
    { title: "Date", dataIndex: "date", key: "date", sorter: (a, b) => dayjs(a.date).unix() - dayjs(b.date).unix() },
    { 
      title: "Type", 
      dataIndex: "type", 
      key: "type", 
      filters: [
        { text: "One-time", value: "one-time" },
        { text: "Subscription", value: "subscription" }
      ],
      onFilter: (value, record) => record.type === value,
    },
    { 
      title: "Status", 
      dataIndex: "status", 
      key: "status", 
      render: (text) => <Badge color={statusColors[text] || "blue"} text={text} />,
      filters: [
        { text: "Completed", value: "completed" },
        { text: "Pending", value: "pending" },
        { text: "Refunded", value: "refunded" },
        { text: "Cancelled", value: "cancelled" },
      ],
      onFilter: (value, record) => record.status === value,
    },
    { 
      title: "Actions", 
      key: "actions",
      render: (_, record) => (
        <Button type="link" onClick={() => {setSelected(record); setShowModal(true);}}>
          View
        </Button>
      )
    }
  ];

  // Subscription columns
  const subscriptionColumns: ColumnsType<DonationSubscription> = [
    { 
      title: "Donor", 
      dataIndex: "name", 
      key: "donor", 
      render: (name, record) => name || record.user_email || "Anonymous"
    },
    { title: "Amount", dataIndex: "amount", key: "amount", render: (v, r) => `${r.currency || "USD"} ${v}` },
    { title: "Status", dataIndex: "status", key: "status", render: (text) => <Badge color={statusColors[text] || "blue"} text={text} /> },
    { title: "Start Date", dataIndex: "date", key: "date" },
    { title: "Frequency", dataIndex: "recurrence", key: "recurrence" },
    { title: "Next Billing", dataIndex: "next_billing_time", key: "next_billing_time" },
    { 
      title: "Actions", 
      key: "actions",
      render: (_, record) => (
        <Button 
          type="link" 
          onClick={() => {
            // Convert subscription to Transaction type for display
            const transactionLike: Transaction = {
              id: record.id || record.subscription_id,
              user_email: record.user_email,
              name: record.name, // Include name field
              amount: record.amount,
              date: record.date || record.start_date || record.created_on || "",
              type: "subscription",
              status: record.status,
              payment_method: record.payment_method || "PayPal",
              subscription_id: record.subscription_id,
              plan_id: record.plan_id,
              next_billing_time: record.next_billing_time,
              currency: record.currency,
              event_type: record.event_type,
              note: record.note,
            };
            setSelected(transactionLike);
            setShowModal(true);
          }}
        >
          View
        </Button>
      )
    }
  ];

  return (
    <div>
      <Row gutter={[16, 16]}>
        <Col span={6}>
          <Card>
            <h3>Total Donations</h3>
            <h2>${totalDonations.toFixed(2)}</h2>
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <h3>Recurring Subscriptions</h3>
            <h2>${totalSubscriptions.toFixed(2)}</h2>
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <h3>Refunds</h3>
            <h2>${totalRefunds.toFixed(2)}</h2>
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <h3>Net Income</h3>
            <h2>${netIncome.toFixed(2)}</h2>
          </Card>
        </Col>
      </Row>

      <Tabs 
        defaultActiveKey="transactions" 
        activeKey={activeTab}
        onChange={setActiveTab}
        style={{ marginBottom: '20px' }}
        items={[
          {
            key: 'transactions',
            label: 'Transactions',
            children: (
              <Card title="Transaction List">
                <div style={{ marginBottom: "16px" }}>
                  <Row gutter={16}>
                    <Col span={6}>
                      <Input
                        placeholder="Search donor..."
                        value={filter.donor}
                        onChange={(e) => setFilter({ ...filter, donor: e.target.value })}
                      />
                    </Col>
                    <Col span={6}>
                      <Select
                        placeholder="Filter by type"
                        style={{ width: "100%" }}
                        value={filter.type}
                        onChange={(value) => setFilter({ ...filter, type: value })}
                        allowClear
                      >
                        <Select.Option value="">All</Select.Option>
                        <Select.Option value="one-time">One-time</Select.Option>
                        <Select.Option value="subscription">Subscription</Select.Option>
                      </Select>
                    </Col>
                    <Col span={6}>
                      <Select
                        placeholder="Filter by status"
                        style={{ width: "100%" }}
                        value={filter.status}
                        onChange={(value) => setFilter({ ...filter, status: value })}
                        allowClear
                      >
                        <Select.Option value="">All</Select.Option>
                        <Select.Option value="completed">Completed</Select.Option>
                        <Select.Option value="pending">Pending</Select.Option>
                        <Select.Option value="refunded">Refunded</Select.Option>
                        <Select.Option value="cancelled">Cancelled</Select.Option>
                      </Select>
                    </Col>
                    <Col span={6}>
                      <DatePicker.RangePicker
                        style={{ width: "100%" }}
                        onChange={(values) => {
                          if (values) {
                            setFilter({
                              ...filter,
                              dateRange: [values[0]?.toISOString() || null, values[1]?.toISOString() || null],
                            });
                          } else {
                            setFilter({ ...filter, dateRange: [null, null] });
                          }
                        }}
                      />
                    </Col>
                  </Row>
                  <div style={{ marginTop: "16px", display: "flex", justifyContent: "flex-end" }}>
                    <Button
                      icon={<DownloadOutlined />}
                      style={{ marginRight: "8px" }}
                    >
                      Export to CSV
                    </Button>
                    <Button icon={<BarChartOutlined />}>View Reports</Button>
                  </div>
                </div>
                <Table<Transaction> 
                  columns={columns} 
                  dataSource={filtered.map(item => ({ ...item, key: item.id }))} 
                  pagination={{ pageSize: 10 }} 
                />
              </Card>
            )
          },
          {
            key: 'subscriptions',
            label: 'Subscriptions',
            children: (
              <Card title="Subscription List">
                <div style={{ marginBottom: "16px" }}>
                  <Row gutter={16}>
                    <Col span={6}>
                      <Input
                        placeholder="Search donor..."
                        value={filter.donor}
                        onChange={(e) => setFilter({ ...filter, donor: e.target.value })}
                      />
                    </Col>
                    <Col span={6}>
                      <Select
                        placeholder="Filter by status"
                        style={{ width: "100%" }}
                        value={filter.status}
                        onChange={(value) => setFilter({ ...filter, status: value })}
                        allowClear
                      >
                        <Select.Option value="">All</Select.Option>
                        <Select.Option value="active">Active</Select.Option>
                        <Select.Option value="cancelled">Cancelled</Select.Option>
                        <Select.Option value="suspended">Suspended</Select.Option>
                      </Select>
                    </Col>
                    <Col span={6}>
                      <DatePicker.RangePicker
                        style={{ width: "100%" }}
                        onChange={(values) => {
                          if (values) {
                            setFilter({
                              ...filter,
                              dateRange: [values[0]?.toISOString() || null, values[1]?.toISOString() || null],
                            });
                          } else {
                            setFilter({ ...filter, dateRange: [null, null] });
                          }
                        }}
                      />
                    </Col>
                    <Col span={6}>
                      <Button icon={<DownloadOutlined />} style={{ marginRight: "8px" }}>
                        Export to CSV
                      </Button>
                    </Col>
                  </Row>
                </div>
                <Table<DonationSubscription>
                  columns={subscriptionColumns}
                  dataSource={subscriptions.map(item => ({ 
                    ...item, 
                    key: item.id || item.subscription_id
                  }))}
                  pagination={{ pageSize: 10 }}
                />
              </Card>
            )
          },
          {
            key: 'settings',
            label: (
              <span>
                <SettingOutlined /> Settings
              </span>
            ),
            children: <PayPalSettingsComponent />
          }
        ]}
      />
      
      <Modal
        open={showModal}
        title={selected?.type === "subscription" ? "Subscription Details" : "Transaction Details"}
        onCancel={() => setShowModal(false)}
        footer={null}
      >
        {selected && (
          <div>
            {selected.name && <p><b>Donor Name:</b> {selected.name}</p>}
            <p><b>User Email:</b> {selected.user_email}</p>
            <p><b>Amount:</b> {selected.amount}</p>
            <p><b>Date:</b> {selected.date}</p>
            <p><b>Type:</b> {selected.type}</p>
            <p><b>Status:</b> <Badge color={statusColors[selected.status] || "blue"} text={selected.status} /></p>
            <p><b>Payment Method:</b> {selected.payment_method}</p>
            {selected.order_id && <p><b>Order ID:</b> {selected.order_id}</p>}
            {selected.subscription_id && <p><b>Subscription ID:</b> {selected.subscription_id}</p>}
            {selected.transaction_id && <p><b>Transaction ID:</b> {selected.transaction_id}</p>}
            {selected.plan_id && <p><b>Plan ID:</b> {selected.plan_id}</p>}
            {selected.next_billing_time && <p><b>Next Billing Time:</b> {selected.next_billing_time}</p>}
            {selected.event_type && <p><b>Event Type:</b> {selected.event_type}</p>}
            {selected.note && <p><b>Note:</b> {selected.note}</p>}
            
            {/* Display address information if available */}
            {selected.metadata && (
              <>
                {(selected.metadata.shipping_line_1 || selected.metadata.shipping_city || selected.metadata.shipping_state) && (
                  <div style={{ marginTop: '16px', padding: '12px', backgroundColor: '#f5f5f5', borderRadius: '4px' }}>
                    <p><b>Shipping Address:</b></p>
                    {selected.metadata.shipping_line_1 && <p>{selected.metadata.shipping_line_1}</p>}
                    {selected.metadata.shipping_line_2 && <p>{selected.metadata.shipping_line_2}</p>}
                    {(selected.metadata.shipping_city || selected.metadata.shipping_state || selected.metadata.shipping_postal_code) && (
                      <p>
                        {selected.metadata.shipping_city}{selected.metadata.shipping_city && selected.metadata.shipping_state ? ', ' : ''}{selected.metadata.shipping_state} {selected.metadata.shipping_postal_code}
                      </p>
                    )}
                    {selected.metadata.shipping_country_code && <p>{selected.metadata.shipping_country_code}</p>}
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
};

const FinanceRoute: React.FC = () => {
  const [isDark, setIsDark] = React.useState(
    typeof document !== "undefined" &&
      document.documentElement.classList.contains("dark")
  );

  React.useEffect(() => {
    const element = document.documentElement;
    const observer = new MutationObserver(() => {
      setIsDark(element.classList.contains("dark"));
    });
    observer.observe(element, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);

  return (
    <ConfigProvider
      theme={{
        algorithm: isDark ? theme.darkAlgorithm : theme.defaultAlgorithm,
        cssVar: true,
        token: isDark
          ? {
              colorBgContainer: "#12171f",
              colorBgElevated: "#12171f",
              colorBorder: "#2a3340",
              colorSplit: "#202734",
              colorText: "#e6edf3",
              colorTextSecondary: "#9aa7b3",
              colorPrimary: "#2e7cf6",
              borderRadius: 10,
            }
          : { borderRadius: 10 },
      }}
    >
      <App>
        <FinancePage />
      </App>
    </ConfigProvider>
  );
};
export default FinanceRoute;