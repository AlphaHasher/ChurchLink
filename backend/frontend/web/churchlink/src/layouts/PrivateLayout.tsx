import Navbar from "@/components/navbar";

function PrivateLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Navbar />
      {children}
    </>
  );
}

export default PrivateLayout;