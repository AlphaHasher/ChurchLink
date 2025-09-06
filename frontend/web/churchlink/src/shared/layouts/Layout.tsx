import { AppSidebar } from "../components/AppSidebar";
import NavBar from "../components/NavBar";
import { SidebarProvider } from "../components/ui/sidebar";
import Footer from "../components/Footer";

function Layout({
  children
}: {
  children: React.ReactNode;
}) {
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
          <NavBar />
          <main className="flex-grow">{children}</main>
        </div>
        <Footer />
      </div>
    </SidebarProvider>
  );
}

export default Layout;
