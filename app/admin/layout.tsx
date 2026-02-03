import Navbar from "@/components/Navbar";
import Sidebar from "@/components/Sidebar";
import getCurrentUser from "../server/actions/getCurrentUser";
import { getRoutesByCurrentUser } from "../server/actions/getRoutesByCurrentUser";
import EmptyState from "@/components/EmptyState";
import { getServerSession } from "next-auth";
import { authOptions } from "@/pages/api/auth/[...nextauth]";
import { redirect } from "next/navigation";

const DashboardLayout = async ({ children }: { children: React.ReactNode }) => {
  const session: any = await getServerSession(authOptions);
  if (!session) {
    redirect("/login");
  }
  const currentUser = session.user;

  if (!currentUser) {
    return (
      <EmptyState
        title="Uautorisert"
        subTitle="Uautorisert, vennligst logg inn "
      />
    );
  }

  // Fetch routes to get the company/creator data for the sidebar
  const routes = await getRoutesByCurrentUser({ userId: currentUser.id });
  const companyData = routes?.creator || routes?.company;

  return (
    <div className="flex flex-col md:flex-row h-screen overflow-hidden">
      <div className="w-full md:w-[250px] md:relative md:flex md:flex-col shrink-0">
        <Sidebar currentUser={currentUser} getByUserId={companyData} />
      </div>
      <main className="flex-1 overflow-auto px-3 py-6 md:py-10">
        {children}
      </main>
    </div>
  );
};

export default DashboardLayout;
