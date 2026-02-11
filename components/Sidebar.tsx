"use client";

import { logo } from "@/assets";
import Image from "next/image";
import React, { useEffect, useState } from "react";
import Link from "next/link";
// Using system font stack to avoid network fetch during build
import {
  MdHome,
  MdBookmarkAdd,
  MdScreenshotMonitor,
  MdMeetingRoom,
  MdAccountTree,
  MdPeople,
  MdOutlineLogout,
} from "react-icons/md";
import { FaBuildingShield } from "react-icons/fa6";
import { FaUsers, FaUser, FaPlus } from "react-icons/fa";
import { IoCloseOutline } from "react-icons/io5";
import { CiMenuFries } from "react-icons/ci";

import { useParams, usePathname } from "next/navigation";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { signOut, useSession } from "next-auth/react";
//import { safeUser } from "@/types";
import axios from "axios";
import { companyNameToSlug } from "@/utils/slugUtils";

interface SidebarProps {
  currentUser?: any | null;
  getByUserId?: any | null;
}
const useRoutes = (currentUser: any) => {
  return [
    ...(currentUser?.role === "admin"
      ? [
        {
          label: "Hjem",
          icon: MdHome,
          href: "/",
          color: "text-light",
        },
      ]
      : []),
    {
      label: "Møterom",
      icon: MdMeetingRoom,
      color: "text-light",
      href: "/rooms",
    },
    {
      label: "Reservasjoner",
      icon: MdBookmarkAdd,
      href: "/reservasjoner",
      color: "text-light",
    },

    ...(currentUser?.role === "admin"
      ? [
        {
          label: "Opprett",
          icon: FaUsers,
          color: "text-light",
          href: "/brukere",
        },
        {
          label: "Inviter",
          icon: FaPlus,
          href: "/invite",
          color: "text-light",
        },
        {
          label: "Infoskjerm",
          icon: MdScreenshotMonitor,
          color: "text-light",
          href: "/infoskjerm",
        },
        {
          label: "Alle Brukere",
          icon: MdPeople,
          color: "text-light",
          href: "/all-users",
        },
      ]
      : []),
  ];
};

export const Constants = ({ currentUser }: SidebarProps) => {
  const routes = useRoutes(currentUser);

  return;
};
const Sidebar = ({ currentUser, getByUserId }: SidebarProps) => {
  //console.log("🚀 ~ Sidebar ~ currentUser:", currentUser);
  const routes = useRoutes(currentUser);
  const companyNameParams = useParams<{ companyName: string; item: string }>();
  const params = useParams<{ userId: string; item: string }>();
  const userId = params ? params.userId : null;
  const companyName = companyNameParams ? companyNameParams.companyName : null;
  const pathname = usePathname();
  const logout = async () => {
    await signOut({ callbackUrl: "/login" });
  };
  {
  }
  const [navOpen, setNavOpen] = useState(false);
  const [fetchedCompany, setFetchedCompany] = useState<any>(null);

  // Sync with prop or fetch if missing
  useEffect(() => {
    if (!companyName) return;

    // Check if getByUserId is correct for this slug
    if (getByUserId?.slug === companyName ||
      getByUserId?.firmanavn?.trim().replace(/\s+/g, '-').toLowerCase() === companyName) {
      setFetchedCompany(null); // Reset since prop is good
      return;
    }

    const fetchCompany = async () => {
      try {
        const res = await axios.get(`/api/company/${companyName}`);
        if (res.data) setFetchedCompany(res.data);
      } catch (e) {
        console.warn("Sidebar failed to fetch company context", e);
      }
    };
    fetchCompany();
  }, [companyName, getByUserId]);

  const displayCompany = fetchedCompany || getByUserId;

  const handleNav = () => {
    setNavOpen(true);
  };
  const handleCloseNav = () => {
    setNavOpen(false);
  };

  return (
    <div
      className="relative flex flex-col w-full h-full"
      suppressHydrationWarning
    >
      {/* Mobile header - always rendered to avoid hydration mismatch */}
      <div className={`${navOpen ? "hidden" : "flex"} items-center justify-between w-full px-4 py-2 md:hidden bg-secondary`}>
        <div className="relative w-24 h-10 ">
          <Image fill alt="HOLD AV - Logo" src={logo} className="" />
        </div>

        <div className="py-2 text-white cursor-pointer" onClick={handleNav}>
          <CiMenuFries size={25} />
        </div>
      </div>

      <div
        className={`${navOpen ? "fixed inset-0 z-50" : "hidden md:flex"
          } flex flex-col w-full h-full py-4 space-y-4 text-white bg-secondary md:w-[250px] overflow-hidden`}
      >
        <div className="flex-1 px-3 py-2 overflow-y-auto">
          <div className="flex justify-between w-full">
            <Link
              href={`/admin/${companyName}/${currentUser?.id}/`}
              className="flex items-center pl-3 mb-10"
            >
              <div>
                <div className="relative w-24 h-10">
                  <Image fill alt="HOLD AV - Logo" src={logo} className="" />
                </div>
                {/* 
                  Note: companyName comes from useParams (URL slug).
                  We use the raw firmanavn for display from the company data if available.
                */}
                <h6 className="text-[16px]">
                  {displayCompany?.firmanavn || companyName?.replace(/-/g, ' ')}
                </h6>
              </div>
            </Link>
            <div
              className="px-4 text-white cursor-pointer md:hidden"
              onClick={handleCloseNav}
            >
              <IoCloseOutline size={25} />
            </div>
          </div>
          <div className="space-y-1">
            {routes.map((route) => {
              const fullHref = `/admin/${companyName}/${currentUser?.id}${route.href}`;
              return (
                <Link
                  key={route.href}
                  href={fullHref}
                  className={cn(
                    "text-sm group border-b border-light flex p-3 w-full justify-start font-medium cursor-pointer hover:text-white hover:bg-white/10 rounded-lg transition",
                    pathname === route.href
                      ? "text-white bg-white/15"
                      : "text-zinc-300"
                  )}
                  onClick={handleCloseNav}
                >
                  <div className="flex items-center flex-1">
                    <route.icon className={cn("h-5 w-5 mr-3", route.color)} />
                    {route.label}
                  </div>
                </Link>
              );
            })}
          </div>
          <div className="pt-4 space-y-1">
            <button
              onClick={logout}
              className={cn(
                "text-sm group flex p-3 w-full justify-start font-medium cursor-pointer hover:text-white hover:bg-white/10 rounded-lg transition"
              )}
            >
              <div className="flex items-center flex-1">
                <MdOutlineLogout className={cn("h-5 w-5 mr-3")} />
                Logg ut
              </div>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Sidebar;
