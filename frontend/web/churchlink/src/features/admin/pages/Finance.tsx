import { useState, useEffect } from "react";
import api from "@/api/api";
// import { useAuth } from "@/lib/auth-context";

interface Donation {
  id: string;
  donor: string;
  amount: number;
  date: string;
}

const Finance = () => {
  // const { role } = useAuth();
//   if (role !== "admin" && role !== "finance") return <p>Access Denied</p>; // Restrict access

  const [paypalId, setPaypalId] = useState("");
  const [donations, setDonations] = useState<Donation[]>([]);
  const [totalDonations, setTotalDonations] = useState(0);

  useEffect(() => {
    const fetchDonations = async () => {
      try {
        const response = await api.get("/admin/donations");
        setDonations(response.data);
        setTotalDonations(response.data.reduce((sum: number, d: Donation) => sum + d.amount, 0));
      } catch (error) {
        console.error("Error fetching donations:", error);
      }
    };

    fetchDonations();
  }, []);

  const handleSavePaypal = () => {
    console.log("Saving PayPal ID:", paypalId);
    // Add API call to save PayPal ID
  };

  const exportCSV = () => {
    const csvContent =
      "Donor,Amount,Date\n" +
      donations.map((d) => `${d.donor},${d.amount},${d.date}`).join("\n");

    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "donation_report.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Finance & Donations</h1>

      {/* PayPal Setup */}
      <div className="mb-6">
        <h2 className="text-xl font-semibold mb-2">PayPal API Setup</h2>
        <input
          type="text"
          placeholder="Enter PayPal ID"
          value={paypalId}
          onChange={(e) => setPaypalId(e.target.value)}
          className="border p-2 w-full"
        />
        <button
          className="mt-2 bg-blue-500 text-white px-4 py-2 rounded"
          onClick={handleSavePaypal}
        >
          Save PayPal ID
        </button>
      </div>

      {/* Donation Statistics */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-white p-4 shadow rounded">Total Donations: ${totalDonations.toFixed(2)}</div>
        <div className="bg-white p-4 shadow rounded">Most Recent: ${donations[0]?.amount || 0}</div>
        <div className="bg-white p-4 shadow rounded">Highest Donation: ${Math.max(...donations.map(d => d.amount), 0)}</div>
      </div>

      {/* Top Donors */}
      <h2 className="text-xl font-semibold mb-2">Top Donors</h2>
      <ul className="mb-6">
        {donations
          .sort((a, b) => b.amount - a.amount)
          .slice(0, 5)
          .map((d, index) => (
            <li key={index} className="border-b py-2">
              {d.donor} - ${d.amount}
            </li>
          ))}
      </ul>

      {/* Donation History */}
      <h2 className="text-xl font-semibold mb-2">Donation History</h2>
      <button className="bg-green-500 text-white px-4 py-2 rounded mb-4" onClick={exportCSV}>
        Export CSV
      </button>
      <table className="w-full border-collapse border border-gray-300">
        <thead>
          <tr className="bg-gray-100">
            <th className="border p-2">Donor</th>
            <th className="border p-2">Amount</th>
            <th className="border p-2">Date</th>
          </tr>
        </thead>
        <tbody>
          {donations.map((donation) => (
            <tr key={donation.id} className="border">
              <td className="p-2 border">{donation.donor}</td>
              <td className="p-2 border">${donation.amount}</td>
              <td className="p-2 border">{donation.date}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default Finance;