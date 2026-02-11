"use client";
import Card from "@/components/Card";
import Width from "@/components/Width";
import React, { useEffect, useState } from "react";
import { LuDoorOpen } from "react-icons/lu";
import { AiOutlinePlus } from "react-icons/ai";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { SafeRoom, safeUser } from "@/types";
import axios from "axios";
import Heading from "@/components/Heading";
import { useQuery } from "@tanstack/react-query";
import EmptyState from "@/components/EmptyState";
import ContentLoader from "@/components/ContentLoader";
import { formatRoomNameForDisplay, roomNameToSlug, companyNameToSlug } from "@/utils/slugUtils";
import { AiOutlineEdit, AiOutlineDelete } from "react-icons/ai";
import { toast } from "react-hot-toast";
import { useQueryClient } from "@tanstack/react-query";


interface RoomsClientProps {
  currentUser?: any | null;
  roomsOfTheCurrentCompany?: SafeRoom[] | null;
  authorizedUsers: any | null;
  companyName?: string | null;
  company: any;
}

const RoomsClient = ({
  companyName,
  currentUser,
  company: companyInit,
  authorizedUsers: authorizedUsersInit,
  roomsOfTheCurrentCompany: roomsOfTheCurrentCompanyInit,
}: RoomsClientProps) => {
  const router = useRouter();
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);
  const queryClient = useQueryClient();

  const [editingRoom, setEditingRoom] = useState<any | null>(null);
  const [newRoomName, setNewRoomName] = useState("");
  const [isUpdating, setIsUpdating] = useState(false);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);


  /* 
   * SMART RELOAD FAILSAFE: Detect soft-nav vs hard-reload
   * If the user navigates between companies via client-side routing,
   * we force a hard refresh to purge stale context from memory.
   */
  useEffect(() => {
    if (typeof window !== "undefined") {
      const lastCompany = (window as any)._LAST_ADMIN_COMPANY;
      if (companyName && lastCompany && companyName !== lastCompany) {
        console.log("🔄 Admin company change detected! Forcing hard refresh to purge stale context...");
        (window as any)._LAST_ADMIN_COMPANY = companyName;
        window.location.reload();
        return;
      }
      (window as any)._LAST_ADMIN_COMPANY = companyName;
    }
  }, [companyName]);

  const { data: authorizedUsers } = useQuery({
    queryKey: ["authorizedUsers", companyName],
    queryFn: async () => {
      const res = await axios.get(`/api/authorized-users/${companyName}?userId=${currentUser?.id}`);
      return res.data;
    },
    initialData: authorizedUsersInit,
    refetchOnMount: false, // Prevent immediate refetch to avoid hydration issues
    staleTime: 30000, // Consider data fresh for 30 seconds
  });

  const { data: roomsOfTheCurrentCompany, isLoading: roomsLoading } = useQuery({
    queryKey: ["roomsForCompany", companyName],
    queryFn: async () => {
      const res = await axios.get(`/api/rooms/company/${companyName}`);
      return res.data;
    },
    initialData: roomsOfTheCurrentCompanyInit,
    refetchOnMount: true, // Enable refetch to get fresh data
    staleTime: 0, // Always consider data stale to ensure fresh fetches
  });
  const { data: company, isLoading: companyLoading } = useQuery({
    queryKey: ["company", companyName],
    queryFn: async () => {
      const res = await axios.get(`/api/company/${companyName}`);
      return res.data;
    },
    initialData: companyInit,
    refetchOnMount: false, // Prevent immediate refetch
    staleTime: 30000, // Consider data fresh for 30 seconds
  });

  useEffect(() => {
    if (typeof authorizedUsers === 'undefined') return;

    // Always allow access if user is logged in - simplified for production
    if (currentUser) {
      setIsAuthorized(true);
    } else {
      setIsAuthorized(false);
    }
    setAuthChecked(true);
  }, [authorizedUsers, currentUser, companyName]);

  const handleEditClick = (e: React.MouseEvent, room: any) => {
    e.stopPropagation();
    setEditingRoom(room);
    setNewRoomName(room.name || "");
  };

  const handleUpdate = async () => {
    if (!editingRoom?.id || !newRoomName.trim()) return;
    try {
      setIsUpdating(true);
      await axios.patch(`/api/rooms/${editingRoom.id}`, { name: newRoomName });
      toast.success("Møterom oppdatert!");
      setEditingRoom(null);
      queryClient.invalidateQueries({ queryKey: ["roomsForCompany", companyName] });
      queryClient.invalidateQueries({ queryKey: ["reservationByCompany", companyName] });
      router.refresh();
    } catch (error) {
      toast.error("Kunne ikke oppdatere møterom");
      console.error(error);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleDelete = async (e: React.MouseEvent, roomId: string) => {
    e.stopPropagation();
    if (!confirm("Er du sikker på at du vil slette dette møterommet? Alle reservasjoner for dette rommet vil bli slettet, og brukere vil bli varslet.")) {
      return;
    }

    try {
      setIsDeleting(roomId);
      await axios.delete(`/api/rooms/${roomId}`);
      toast.success("Møterom slettet!");
      queryClient.invalidateQueries({ queryKey: ["roomsForCompany", companyName] });
      queryClient.invalidateQueries({ queryKey: ["reservationByCompany", companyName] });
      router.refresh();
    } catch (error) {
      toast.error("Kunne ikke slette møterom");
      console.error(error);
    } finally {
      setIsDeleting(null);
    }
  };


  if (!authChecked) {
    return <ContentLoader message=" møterom…" />;
  }

  if (!isAuthorized) {
    return (
      <EmptyState
        title="Uautorisert"
        subTitle="Uautorisert, du har ikke tilgang til dette firmaet"
      />
    );
  }
  // Show loading spinner while company data is being fetched
  if (companyLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
          {/* <p className="text-gray-600">Laster firma data...</p> */}
        </div>
      </div>
    );
  }

  // Only show "company does not exist" if loading is complete and no company found
  if (!company && !companyLoading) {
    return <EmptyState title="Firmaet eksisterer ikke" subTitle="" />;
  }

  if (
    company &&
    currentUser?.role == "admin" &&
    currentUser.id !== company?.userId
  ) {
    return (
      <EmptyState
        title="Uautorisert"
        subTitle="Uautorisert, du har ikke tilgang til dette firmaet"
      />
    );
  }

  // Show loading state while fetching fresh data to prevent flashing of deleted rooms
  if (roomsLoading) {
    return (
      <div>
        <Heading title="Møterom" subTitle="Her kan du se møterom dere har" />
        <Width>
          <ContentLoader />
        </Width>
      </div>
    );
  }

  return (
    <div>
      <Heading title="Møterom" subTitle="Her kan du se møterom dere har" />
      <Width>
        {roomsOfTheCurrentCompany && roomsOfTheCurrentCompany.length > 0 ? (
          <div>
            {roomsOfTheCurrentCompany.map((room: any) => {
              const companySlug = company?.slug || companyNameToSlug(companyName ?? "");
              const roomSlug = room.slug || roomNameToSlug(room?.name ?? "");
              const targetPath = `/${companySlug}/${roomSlug}`;
              return (
                <div
                  key={room?.id}
                  onClick={() => router.push(targetPath)}
                  className="mb-2 cursor-pointer transition hover:opacity-90 relative group"
                >
                  <span className="absolute inset-0 z-[1] pointer-events-none" />
                  <div className="mb-3 relative z-[2]">
                    <Card outline label={formatRoomNameForDisplay(room?.name)} flex icon={LuDoorOpen} />

                    {currentUser?.role === "admin" && (
                      <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center space-x-2 z-[2]">
                        <button
                          onClick={(e) => handleEditClick(e, room)}
                          className="p-2 text-gray-500 hover:text-blue-600 transition"
                          title="Rediger"
                        >
                          <AiOutlineEdit size={20} />
                        </button>
                        <button
                          disabled={isDeleting === room.id}
                          onClick={(e) => handleDelete(e, room.id)}
                          className="p-2 text-gray-500 hover:text-red-600 transition disabled:opacity-50"
                          title="Slett"
                        >
                          <AiOutlineDelete size={20} />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
            {currentUser?.role === "admin" && (
              <div
                onClick={() => {
                  router.push(`/admin/${companyNameToSlug(companyName ?? "")}/${currentUser?.id}/rooms/slug`);
                }}
                className="mb-2 cursor-pointer transition hover:opacity-90 relative"
              >
                <span className="absolute inset-0 z-[1]" />
                <Card
                  outline
                  label="Legg til møterom"
                  flex
                  icon={AiOutlinePlus}
                />
              </div>
            )}
          </div>
        ) : (
          <div className="flex items-center justify-start py-20">
            {currentUser?.role === "admin" && (
              <div
                onClick={() => {
                  router.push(`/admin/${companyNameToSlug(companyName ?? "")}/${currentUser?.id}/rooms/slug`);
                }}
                className="w-full max-w-sm cursor-pointer transition hover:opacity-90 relative"
              >
                <span className="absolute inset-0 z-[1]" />
                <Card
                  outline
                  label="Legg til møterom"
                  flex
                  icon={AiOutlinePlus}
                />
              </div>
            )}
          </div>
        )}
      </Width>

      {/* Edit Room Modal */}
      {editingRoom && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-[50]">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-bold mb-4">Rediger Møterom</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Navn på møterom</label>
                <input
                  type="text"
                  value={newRoomName}
                  onChange={(e) => setNewRoomName(e.target.value)}
                  className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
                  placeholder="Eks: Møterom A"
                />
              </div>
            </div>
            <div className="mt-6 flex justify-end space-x-3">
              <button
                onClick={() => setEditingRoom(null)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
              >
                Avbryt
              </button>
              <button
                onClick={handleUpdate}
                disabled={isUpdating || !newRoomName.trim()}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50"
              >
                {isUpdating ? "Oppdaterer..." : "Lagre endringer"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>

  );
};

export default RoomsClient;
