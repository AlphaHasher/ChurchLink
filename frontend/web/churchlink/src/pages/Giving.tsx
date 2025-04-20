import { Button } from "@/components/ui/button";
import { ArrowRight, Mail, Home, CreditCard } from "lucide-react";

export default function Giving() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-white to-gray-50">
      {/* Section 1: Hero Section with improved overlay and typography */}
      <section
        className="bg-cover bg-center bg-no-repeat bg-fixed relative"
        style={{
          backgroundImage:
            "url('https://storage2.snappages.site/FQQ6MW/assets/images/13922059_2414x1620_2500.png')",
        }}
      >
        <div className="bg-gradient-to-r from-black/70 to-black/60 py-32 px-4 flex flex-col items-center justify-center text-center">
          <h1 className="text-white text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight">
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-amber-200 to-yellow-400">
              Supporting Our Ministry
            </span>
          </h1>
          <p className="text-white/90 max-w-2xl mt-6 text-lg md:text-xl font-light leading-relaxed px-4">
            “Each one must give as he has decided in his heart, not
            reluctantly or under compulsion, for God loves a cheerful giver.”
            <span className="block mt-2 text-amber-200 font-medium">2 Corinthians 9:7</span>
          </p>
        </div>
      </section>

      {/* Introduction text */}
      <section className="py-16 px-4 max-w-6xl mx-auto text-center">
        <h2 className="text-3xl md:text-4xl font-bold text-gray-800 mb-6">Ways to Give</h2>
        <p className="text-gray-600 max-w-3xl mx-auto mb-12 text-lg">
          Your generosity helps us continue our mission and serve our community.
          Choose the giving method that works best for you.
        </p>

        {/* Section 2: Giving Options */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 px-2">
          {/* In-Person Donation */}
          <div className="bg-white rounded-xl shadow-lg overflow-hidden hover:shadow-xl transition duration-300 transform hover:-translate-y-1 flex flex-col h-full">
            <div className="h-40 bg-gradient-to-r from-blue-400 to-indigo-500 flex items-center justify-center p-6">
              <Home className="w-20 h-20 text-white" />
            </div>
            <div className="p-6 flex flex-col flex-grow">
              <h3 className="text-xl font-bold text-gray-800 mb-3">In-Person</h3>
              <p className="text-gray-600 mb-6 flex-grow">
                Bring your donation to the next service at:
                <span className="font-medium block mt-2">Second Slavic Baptist Church</span>
                <span className="block mt-1">6601 Watt Ave,</span>
                <span className="block">North Highlands, CA 95660</span>
              </p>
            </div>
          </div>

          {/* PayPal/Zelle Option */}
          <div className="bg-white rounded-xl shadow-lg overflow-hidden hover:shadow-xl transition duration-300 transform hover:-translate-y-1 flex flex-col h-full">
            <div className="h-40 bg-gradient-to-r from-amber-400 to-yellow-500 flex items-center justify-center p-6">
              <CreditCard className="w-20 h-20 text-white" />
            </div>
            <div className="p-6 flex flex-col flex-grow">
              <h3 className="text-xl font-bold text-gray-800 mb-3">Online Donation</h3>
              <p className="text-gray-600 mb-6 flex-grow">
                Make your donation digitally through PayPal or Zelle. Send Zelle donations to
                <span className="font-medium block mt-1">ssbc97@comcast.net</span>
              </p>
              <Button asChild className="bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-600 hover:to-yellow-600 text-white font-medium py-6 rounded-lg shadow-md transition-all duration-300 mt-auto">
                <a
                  href="https://www.paypal.com/donate/?hosted_button_id=V56HEDVRHUVGW"
                  target="_blank"
                  className="flex items-center justify-center gap-2 text-white"
                  rel="noopener noreferrer"
                >
                  Donate with PayPal
                  <ArrowRight size={16} />
                </a>
              </Button>
            </div>
          </div>

          {/* Mail-in Donation */}
          <div className="bg-white rounded-xl shadow-lg overflow-hidden hover:shadow-xl transition duration-300 transform hover:-translate-y-1 flex flex-col h-full">
            <div className="h-40 bg-gradient-to-r from-emerald-400 to-teal-500 flex items-center justify-center p-6">
              <Mail className="w-20 h-20 text-white" />
            </div>
            <div className="p-6 flex flex-col flex-grow">
              <h3 className="text-xl font-bold text-gray-800 mb-3">Mail a Check</h3>
              <p className="text-gray-600 mb-6 flex-grow">
                Write a check payable to <strong>Second Slavic Baptist Church</strong>, and mail to:
                <span className="font-medium block mt-2">6601 Watt Avenue</span>
                <span className="block">North Highlands, CA 95660</span>
              </p>
              <div className="mt-auto py-6"></div>
            </div>
          </div>
        </div>
      </section>

      {/* Additional information section */}
      <section className="py-16 bg-gradient-to-b from-gray-50 to-gray-100">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <h3 className="text-2xl font-bold text-gray-800 mb-4">Thank You For Your Support</h3>
          <p className="text-gray-600">
            Your donations help us continue our mission, maintain our facilities, and support our community outreach programs.
            For questions about donations, please contact our church office.
          </p>
        </div>
      </section>
    </main>
  );
}
