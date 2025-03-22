import { AppSidebar } from "@/components/AppSidebar";
import PrivNavBar from "@/components/PrivNavBar";
import { SidebarProvider } from "@/components/ui/sidebar";

function PrivateLayout({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider>
    <AppSidebar />
      <PrivNavBar />
      {children}
    </SidebarProvider>
  );
}

export default PrivateLayout;