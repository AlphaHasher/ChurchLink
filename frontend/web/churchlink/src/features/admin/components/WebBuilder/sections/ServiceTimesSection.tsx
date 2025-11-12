import React from "react";

// Keep the interfaces for compatibility, but the component now renders a fixed layout.
export interface ServiceTimesContent {
  title?: string;
  times?: { label: string; time: string }[];
}

interface Props {
  data?: ServiceTimesContent;
  isEditing?: boolean;
  onChange?: (newData: ServiceTimesContent) => void;
}

const ServiceTimesSection: React.FC<Props> = () => {
  return (
    <section className="w-full">
      <div className="w-full" style={{ backgroundColor: "#92a2c4" }}>
        <div className="mx-auto max-w-6xl px-4 py-10">
          <div className="relative h-full w-full">
            <h2 className="text-[2rem] font-bold text-[#0f172a]" style={{ marginLeft: "24rem", marginTop: "0.5rem" }}>
              Service Times
            </h2>
            <p className="text-[#475569]" style={{ marginLeft: "23rem", marginTop: "1rem" }}>
              We'd love to see you this Sunday!
            </p>
          </div>

          <div className="relative w-full h-full">
            <div
              className="card p-6 shadow-sm ring-1 ring-slate-200 rounded-[16px] bg-white"
              style={{ position: "absolute", left: "1rem", top: "3rem", width: "17rem", height: "9rem" }}
            >
              <h3 className="font-bold text-[#0f172a]">Location</h3>
              <p className="text-[#334155] mt-2">6601 Watt Ave, North Highlands, CA 95660</p>
            </div>

            <div
              className="card p-6 shadow-sm ring-1 ring-slate-200 rounded-[16px] bg-white"
              style={{ position: "absolute", left: "23rem", top: "3rem", width: "18rem", height: "9rem" }}
            >
              <h3 className="font-bold text-[#0f172a]">Kids & Students</h3>
              <p className="text-[#334155] mt-2">Age-appropriate programs during both services</p>
            </div>

            <div
              className="card p-6 shadow-sm ring-1 ring-slate-200 rounded-[16px] bg-white"
              style={{ position: "absolute", left: "44rem", top: "3rem", width: "18rem", height: "9rem" }}
            >
              <h3 className="font-bold text-[#0f172a]">Sunday Gatherings</h3>
              <p className="text-[#334155] mt-2">9:00 AM & 11:00 AM • Main Auditorium</p>
            </div>

            <div style={{ position: "absolute", left: "27rem", top: "18rem" }}>
              <a
                href="#"
                className="mt-6 inline-block px-6 py-3 rounded-full bg-slate-900 text-white hover:bg-slate-800 transition"
              >
                Plan Your Visit
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default ServiceTimesSection;