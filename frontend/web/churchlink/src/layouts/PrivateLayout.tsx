import { AppSidebar } from "@/components/AppSidebar";
import PrivNavBar from "@/components/PrivNavBar";
import { SidebarProvider } from "@/components/ui/sidebar";
import Footer from "@/components/Footer";

function PrivateLayout({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider>
    <AppSidebar />
      <PrivNavBar />
      {children}
      <Footer />
    </SidebarProvider>
  );
}

export default PrivateLayout;