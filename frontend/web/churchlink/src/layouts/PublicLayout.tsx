import Navbar from "@/components/navbar";
import Footer from "@/components/Footer";

function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
    className="flex flex-col w-screen"
    >
      <Navbar />
      {children}
      <Footer />
    </div>
  );
}

export default PublicLayout;
