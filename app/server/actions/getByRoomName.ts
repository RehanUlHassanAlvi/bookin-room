import getCurrentUser from "./getCurrentUser";
import { slugToRoomName, roomNameToSlug } from "@/utils/slugUtils";
import { db } from "@/lib/firebaseAdmin";

interface IParams {
  roomName?: string;
  roomId?: string;
  companyName?: string;
}

export default async function getRoomByName(params: IParams) {
  try {
    const { roomName, companyName } = params;

    if (!roomName || !companyName) {
      return null;
    }

    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return null;
    }

    console.log(`[getRoomByName] Looking for room: "${roomName}" in company: "${companyName}"`);

    // 1. Primary lookup Strategy: match by dedicated 'slug' field (robust and consistent)
    const slugQs = await db.collection('rooms')
      .where('companyName', '==', companyName)
      .where('slug', '==', roomName.toLowerCase())
      .limit(1)
      .get();

    if (!slugQs.empty) {
      const matchedRoom = { id: slugQs.docs[0].id, ...slugQs.docs[0].data() } as any;
      console.log(`[getRoomByName] Found match by slug: ${matchedRoom.name}`);
      return {
        ...matchedRoom,
        createdAt: matchedRoom.createdAt?.toDate ? matchedRoom.createdAt.toDate().toISOString() : matchedRoom.createdAt,
      };
    }

    // 2. Secondary Strategy: fetch and match (legacy support)
    const roomsQs = await db.collection('rooms')
      .where('companyName', '==', companyName)
      .get();

    if (roomsQs.empty) {
      console.log(`[getRoomByName] No rooms found for company: ${companyName}`);
      return null;
    }

    const rooms = roomsQs.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));

    const matchedRoom = rooms.find(room => {
      const dbRoomName = room.name || "";
      const dbRoomSlug = room.slug || roomNameToSlug(dbRoomName);

      // Compare both as absolute slugs
      if (dbRoomSlug === roomName.toLowerCase()) {
        return true;
      }

      // Fallback: Check if the raw names match
      if (dbRoomName.toLowerCase() === roomName.toLowerCase()) {
        return true;
      }

      // Final Fallback: URL Decoded match
      try {
        if (dbRoomName.toLowerCase() === decodeURIComponent(roomName).toLowerCase()) {
          return true;
        }
      } catch (e) { }

      return false;
    });

    if (!matchedRoom) {
      console.log(`[getRoomByName] Room "${roomName}" not found in ${rooms.length} company rooms.`);
      return null;
    }

    return {
      ...matchedRoom,
      createdAt: matchedRoom.createdAt?.toDate ? matchedRoom.createdAt.toDate().toISOString() : matchedRoom.createdAt,
    };
  } catch (error: any) {
    console.error("[getRoomByName] Error:", error);
    return null;
  }
}
