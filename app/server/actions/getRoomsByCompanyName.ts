import { db } from "@/lib/firebaseAdmin";
import getCurrentUser from "./getCurrentUser";
import { getServerSession } from "next-auth";
import { authOptions } from "@/pages/api/auth/[...nextauth]";
import { unstable_cache } from "next/cache";
import { slugToCompanyName } from "@/utils/slugUtils";

interface IParams {
  //userId?: string;
  companyName?: string;
  requestedUserId?: string;
}

const getCachedRooms = unstable_cache(
  async (companyName: string) => {
    // 1. Resolve company by its slug first
    const normalizedSlug = companyName.trim().replace(/\s+/g, "-").toLowerCase();
    const companyQs = await db.collection('companies').where('slug', '==', normalizedSlug).limit(1).get();

    let canonicalCompanyName = "";
    let companyId = "";

    if (!companyQs.empty) {
      const companyData = companyQs.docs[0].data();
      canonicalCompanyName = companyData.firmanavn;
      companyId = companyQs.docs[0].id;
    } else {
      // Fallback: try to find by variations of the name
      const properCompanyName = slugToCompanyName(companyName);
      const variations = [properCompanyName, companyName, decodeURIComponent(companyName)];
      for (const v of variations) {
        if (!v) continue;
        const cqs = await db.collection('companies').where('firmanavn', '==', v).limit(1).get();
        if (!cqs.empty) {
          canonicalCompanyName = cqs.docs[0].data().firmanavn;
          companyId = cqs.docs[0].id;
          break;
        }
      }
    }

    if (!canonicalCompanyName && !companyId) {
      console.log(`[getCachedRooms] Company not found for slug/name: ${companyName}`);
      return [];
    }

    // 2. Fetch rooms for this company
    // Fetch by companyId and companyName in parallel to ensure we get all rooms
    // (handles inconsistent indexing where some rooms might only have one of them)
    const [roomsByIdQs, roomsByNameQs] = await Promise.all([
      companyId ? db.collection('rooms').where('companyId', '==', companyId).get() : Promise.resolve({ docs: [] }),
      canonicalCompanyName ? db.collection('rooms').where('companyName', '==', canonicalCompanyName).get() : Promise.resolve({ docs: [] })
    ]);

    // Merge and deduplicate by ID
    const mergedDocs = [...(roomsByIdQs?.docs || []), ...(roomsByNameQs?.docs || [])];
    const uniqueRoomsMap = new Map();

    mergedDocs.forEach(doc => {
      uniqueRoomsMap.set(doc.id, { id: doc.id, ...doc.data() });
    });

    const rooms = Array.from(uniqueRoomsMap.values());

    // In-memory sort by createdAt descending
    rooms.sort((a: any, b: any) => {
      const timeA = a.createdAt?.toDate ? a.createdAt.toDate().getTime() : (a.createdAt ? new Date(a.createdAt).getTime() : 0);
      const timeB = b.createdAt?.toDate ? b.createdAt.toDate().getTime() : (b.createdAt ? new Date(b.createdAt).getTime() : 0);
      return timeB - timeA;
    });

    return rooms;
  },
  ['rooms-by-company'],
  {
    revalidate: 1, // Cache for only 1 second for near-real-time updates
    tags: ['rooms']
  }
);

export default async function getRoomsByCompanyName(params: IParams) {
  try {
    const { companyName, requestedUserId } = params;
    if (!companyName) {
      return;
    }

    let rooms = await getCachedRooms(companyName);

    const safeRooms = rooms.map((room: any) => ({
      ...room,
      createdAt: room.createdAt?.toDate ? room.createdAt.toDate().toISOString() : room.createdAt,
      companyName: companyName,
    }));

    return safeRooms;
  } catch (error: any) {
    console.error('Error in getRoomsByCompanyName:', error);
    throw new Error(error.message || error);
  }
}
