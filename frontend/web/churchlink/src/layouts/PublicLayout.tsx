import { AppSidebar } from "@/components/AppSidebar";
import PubNavBar from "@/components/PubNavBar";
import { SidebarProvider } from "@/components/ui/sidebar";

function PublicLayout({ children }: { children: React.ReactNode }) {
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
      <div className="flex w-full">
        <div className="flex flex-col w-full">
          <div className="lg:hidden!">
            <AppSidebar
            />
          </div>
          <PubNavBar />
          {children}
        </div>
      </div>
    </SidebarProvider>
  );
}

export default PublicLayout;
