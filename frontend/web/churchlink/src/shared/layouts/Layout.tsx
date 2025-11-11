import { AppSidebar } from "../components/AppSidebar";
import NavBar from "../components/NavBar";
import { SidebarProvider } from "../components/ui/sidebar";
import Footer from "../components/Footer";

/**
 * Application layout component that provides sidebar state and wraps page content with navigation and footer.
 *
 * @param children - Content rendered inside the main content area.
 * @returns A React element containing the NavBar, a responsive AppSidebar (hidden on large screens), the main content area, and Footer, all wrapped in a SidebarProvider configured with sidebar width CSS variables.
 */
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
          "--sidebar-width-mobile": "min(320px, 85vw)",
          "--sidebar-width": "min(320px, 85vw)",
        } as React.CSSProperties
      }
    >
      <div className="flex flex-col min-h-screen w-full bg-background relative">
        <NavBar />
        <div className="flex flex-col flex-grow w-full">
          <div className="lg:hidden!">
            <AppSidebar/>
          </div>
          <NavBar />
          <main className="flex-grow bg-background overflow-x-hidden">{children}</main>
        </div>
        <Footer />
      </div>
    </SidebarProvider>
  );
}

export default Layout;