import Navbar from "@/components/navbar";
import Footer from "@/components/Footer";

function PrivateLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Navbar />
      {children}
      <Footer />
    </>
  );
}

export default PrivateLayout;