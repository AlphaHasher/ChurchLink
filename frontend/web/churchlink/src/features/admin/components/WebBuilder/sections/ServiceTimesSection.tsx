import React from "react";

export interface ServiceTimesContent {
  title?: string;
  subtitle?: string;
  location?: string;
  kidsText?: string;
  servicesText?: string;
  buttonText?: string;
  buttonLink?: string;
  times?: { label: string; time: string }[];
}

interface Props {
  data?: ServiceTimesContent;
  isEditing?: boolean;
  onChange?: (newData: ServiceTimesContent) => void;
}

const ServiceTimesSection: React.FC<Props> = ({ data, isEditing, onChange }) => {
  const [localData, setLocalData] = React.useState<ServiceTimesContent>({
    title: data?.title || 'Service Times',
    subtitle: data?.subtitle || "We'd love to see you this Sunday!",
    location: data?.location || '6601 Watt Ave, North Highlands, CA 95660',
    kidsText: data?.kidsText || 'Age-appropriate programs during both services',
    servicesText: data?.servicesText || '9:00 AM & 11:00 AM • Main Auditorium',
    buttonText: data?.buttonText || 'Plan Your Visit',
    buttonLink: data?.buttonLink || '#',
    times: data?.times || [],
  });

  const handleChange = <K extends keyof ServiceTimesContent>(
    field: K,
    value: ServiceTimesContent[K]
  ) => {
    const newData = { ...localData, [field]: value } as ServiceTimesContent;
    setLocalData(newData);
    onChange?.(newData);
  };

  const handleTimeChange = (index: number, field: 'label' | 'time', value: string) => {
    const newTimes = [...(localData.times || [])];
    if (index >= newTimes.length) {
      newTimes[index] = { label: '', time: '' };
    } else {
      newTimes[index] = { ...newTimes[index], [field]: value };
    }
    handleChange('times' as keyof ServiceTimesContent, newTimes);
  };

  if (isEditing) {
    return (
      <div className="p-4 space-y-4">
        <input
          type="text"
          value={localData.title || ''}
          onChange={(e) => handleChange('title', e.target.value)}
          placeholder="Section Title"
          className="w-full p-2 border rounded"
        />
        <input
          type="text"
          value={localData.subtitle || ''}
          onChange={(e) => handleChange('subtitle', e.target.value)}
          placeholder="Subtitle"
          className="w-full p-2 border rounded"
        />
        <input
          type="text"
          value={localData.location || ''}
          onChange={(e) => handleChange('location', e.target.value)}
          placeholder="Location"
          className="w-full p-2 border rounded"
        />
        <input
          type="text"
          value={localData.kidsText || ''}
          onChange={(e) => handleChange('kidsText', e.target.value)}
          placeholder="Kids & Students Text"
          className="w-full p-2 border rounded"
        />
        <input
          type="text"
          value={localData.servicesText || ''}
          onChange={(e) => handleChange('servicesText', e.target.value)}
          placeholder="Service Times Text"
          className="w-full p-2 border rounded"
        />
        <input
          type="text"
          value={localData.buttonText || ''}
          onChange={(e) => handleChange('buttonText', e.target.value)}
          placeholder="Button Text"
          className="w-full p-2 border rounded"
        />
        <input
          type="text"
          value={localData.buttonLink || ''}
          onChange={(e) => handleChange('buttonLink', e.target.value)}
          placeholder="Button Link"
          className="w-full p-2 border rounded"
        />
        {/* For times array, add a list of inputs if needed */}
        <div>
          <h4>Service Times</h4>
          {(localData.times || []).map((time, index) => (
            <div key={index} className="flex space-x-2">
              <input
                type="text"
                value={time.label || ''}
                onChange={(e) => handleTimeChange(index, 'label', e.target.value)}
                placeholder="Label"
                className="flex-1 p-2 border rounded"
              />
              <input
                type="text"
                value={time.time || ''}
                onChange={(e) => handleTimeChange(index, 'time', e.target.value)}
                placeholder="Time"
                className="flex-1 p-2 border rounded"
              />
            </div>
          ))}
          <button 
            onClick={() => {
              const newTimes = [...(localData.times || []), { label: '', time: '' }];
              handleChange('times' as keyof ServiceTimesContent, newTimes);
            }} 
            className="mt-2 p-2 bg-blue-500 text-white rounded"
          >
            Add Time
          </button>
        </div>
      </div>
    );
  }

  return (
    <section className="w-full">
      <div className="w-full" style={{ backgroundColor: "#92a2c4" }}>
        <div className="mx-auto max-w-6xl px-4 py-10">
          <div className="relative h-full w-full">
            <h2 className="text-[2rem] font-bold text-[#0f172a]" style={{ marginLeft: "24rem", marginTop: "0.5rem" }}>
              {localData.title}
            </h2>
            <p className="text-[#475569]" style={{ marginLeft: "23rem", marginTop: "1rem" }}>
              {localData.subtitle}
            </p>
          </div>

          <div className="relative w-full h-full">
            <div
              className="card p-6 shadow-sm ring-1 ring-slate-200 rounded-[16px] bg-white"
              style={{ position: "absolute", left: "1rem", top: "3rem", width: "17rem", height: "9rem" }}
            >
              <h3 className="font-bold text-[#0f172a]">Location</h3>
              <p className="text-[#334155] mt-2">{localData.location}</p>
            </div>

            <div
              className="card p-6 shadow-sm ring-1 ring-slate-200 rounded-[16px] bg-white"
              style={{ position: "absolute", left: "23rem", top: "3rem", width: "18rem", height: "9rem" }}
            >
              <h3 className="font-bold text-[#0f172a]">Kids & Students</h3>
              <p className="text-[#334155] mt-2">{localData.kidsText}</p>
            </div>

            <div
              className="card p-6 shadow-sm ring-1 ring-slate-200 rounded-[16px] bg-white"
              style={{ position: "absolute", left: "44rem", top: "3rem", width: "18rem", height: "9rem" }}
            >
              <h3 className="font-bold text-[#0f172a]">Sunday Gatherings</h3>
              <p className="text-[#334155] mt-2">{localData.servicesText}</p>
            </div>

            <div style={{ position: "absolute", left: "27rem", top: "18rem" }}>
              <a
                href={localData.buttonLink}
                className="mt-6 inline-block px-6 py-3 rounded-full bg-slate-900 text-white hover:bg-slate-800 transition"
              >
                {localData.buttonText}
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default ServiceTimesSection;