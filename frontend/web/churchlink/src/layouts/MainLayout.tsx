import { AppSidebar } from "@/components/Main/AppSidebar";
import PubNavBar from "@/components/PubNavBar";
import PrivNavBar from "@/components/PrivNavBar";
import { SidebarProvider } from "@/components/ui/sidebar";
import Footer from "@/components/Main/Footer";
import { useAuth } from "@/lib/auth-context";

function PublicLayout({
  children
}: {
  children: React.ReactNode;
}) {
  const { user } = useAuth();

  return (
    <SidebarProvider
      defaultOpen={false}
      style={
        {
          "--sidebar-width-mobile": "100%",
          "--sidebar-width": "100%",
        } as React.CSSProperties
      }
    >
      <div className="flex flex-col min-h-screen w-full">
        <div className="flex flex-col flex-grow w-full">
          <div className="lg:hidden!">
            <AppSidebar/>
          </div>
          {user ? <PrivNavBar /> : <PubNavBar />}
          <main className="flex-grow">{children}</main>
        </div>
        <Footer />
      </div>
    </SidebarProvider>
  );
}

export default PublicLayout;
