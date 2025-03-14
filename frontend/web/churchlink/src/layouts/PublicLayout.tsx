import Navbar from "@/components/navbar";

function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
    className="flex flex-col w-screen"
    >
      <Navbar />
      {children}
    </div>
  );
}

export default PublicLayout;
