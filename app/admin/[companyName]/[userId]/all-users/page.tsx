"use client";

import React, { useEffect, useState } from "react";
import Heading from "@/components/Heading";
import Container from "@/components/Container";
type UserRow = {
  fullName: string | null;
  email: string | null;
  role: string | null;
  companyName: string | null;
  createdBy: string | null;
  userId: string | null;
  createdAt: string | null;
};

const AllUsersPage = () => {
  const [users, setUsers] = useState<UserRow[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [editingUser, setEditingUser] = useState<UserRow | null>(null);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  const [editFirstName, setEditFirstName] = useState("");
  const [editLastName, setEditLastName] = useState("");
  const [isUpdating, setIsUpdating] = useState(false);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/all-users", { cache: "no-store" });
      if (!res.ok) {
        setUsers([]);
        return;
      }
      const data = (await res.json()) as UserRow[];
      setUsers(Array.isArray(data) ? data : []);
    } catch {
      setUsers([]);
    } finally {
      setLoading(false);
    }
  };


  useEffect(() => {
    fetchUsers();
  }, []);

  const handleEditClick = (user: UserRow) => {
    setEditingUser(user);
    const names = (user.fullName || "").split(" ");
    setEditFirstName(names[0] || "");
    setEditLastName(names.slice(1).join(" ") || "");
  };

  const handleUpdate = async () => {
    if (!editingUser?.userId) return;
    try {
      setIsUpdating(true);
      const res = await fetch(`/api/users/${editingUser.userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ firstname: editFirstName, lastname: editLastName }),
      });
      if (res.ok) {
        setEditingUser(null);
        fetchUsers();
      } else {
        alert("Feil ved oppdatering av bruker");
      }
    } catch (error) {
      console.error(error);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleDelete = async (userId: string) => {
    if (!confirm("Er du sikker på at du vil slette denne brukeren? Alle deres reservasjoner vil også bli slettet.")) {
      return;
    }

    try {
      setIsDeleting(userId);
      const res = await fetch(`/api/users/${userId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        fetchUsers();
      } else {
        alert("Feil ved sletting av bruker");
      }
    } catch (error) {
      console.error(error);
    } finally {
      setIsDeleting(null);
    }
  };


  // No language toggle: rely on Google Translate/browser translation

  if (loading) {
    return (
      <Container>
        <div className="p-6">
          <div className="flex items-center justify-center min-h-[300px]">
            <div className="flex flex-col items-center space-y-2">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
              <p className="text-gray-600">Laster brukere...</p>
            </div>
          </div>
        </div>
      </Container>
    );
  }

  if (!users || users.length === 0) {
    return (
      <Container>
        <div className="p-6">
          <Heading title="Alle Brukere" subTitle="Se og administrer alle registrerte brukere fra denne delen." />
          <div className="flex items-center justify-center min-h-[200px]">
            <p className="text-gray-600 text-center">
              Ingen brukere funnet.
            </p>
          </div>
        </div>
      </Container>
    );
  }

  return (
    <Container>
      <div className="p-6">
        <Heading title="Alle Brukere" subTitle="Se og administrer alle registrerte brukere fra denne delen." />
        <div className="overflow-x-auto ">
          <table className="min-w-full divide-y divide-gray-200 border rounded-lg">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Fullt Navn</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">E-post</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Rolle</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Firmanavn</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Handlinger</th>

              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {users.map((u, idx) => (
                <tr key={`${u.userId}-${idx}`} className={idx % 2 === 0 ? "bg-white hover:bg-gray-50" : "bg-gray-50 hover:bg-gray-100"}>
                  <td className="px-4 py-3 text-sm text-gray-900">{u.fullName || "-"}</td>
                  <td className="px-4 py-3 text-sm text-gray-700">{u.email || "-"}</td>
                  <td className="px-4 py-3 text-sm text-gray-700">{u.role || "-"}</td>
                  <td className="px-4 py-3 text-sm text-gray-700">{u.companyName || "-"}</td>
                  <td className="px-4 py-3 text-sm text-right space-x-2 whitespace-nowrap">
                    <button
                      onClick={() => handleEditClick(u)}
                      className="text-blue-600 hover:text-blue-900 font-medium"
                    >
                      Rediger
                    </button>
                    <button
                      disabled={!!isDeleting && isDeleting === u.userId}
                      onClick={() => u.userId && handleDelete(u.userId)}
                      className="text-red-600 hover:text-red-900 font-medium disabled:opacity-50"
                    >
                      {isDeleting === u.userId ? "Sletter..." : "Slett"}
                    </button>
                  </td>

                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Edit Modal */}
        {editingUser && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg p-6 w-full max-w-md">
              <h3 className="text-lg font-bold mb-4">Rediger Bruker</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Fornavn</label>
                  <input
                    type="text"
                    value={editFirstName}
                    onChange={(e) => setEditFirstName(e.target.value)}
                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Etternavn</label>
                  <input
                    type="text"
                    value={editLastName}
                    onChange={(e) => setEditLastName(e.target.value)}
                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
                  />
                </div>
              </div>
              <div className="mt-6 flex justify-end space-x-3">
                <button
                  onClick={() => setEditingUser(null)}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
                >
                  Avbryt
                </button>
                <button
                  onClick={handleUpdate}
                  disabled={isUpdating}
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50"
                >
                  {isUpdating ? "Oppdaterer..." : "Lagre endringer"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </Container>


  );
};

export default AllUsersPage;


