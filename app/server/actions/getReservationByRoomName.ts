import { db } from "@/lib/firebaseAdmin";
import getCurrentUser from "./getCurrentUser";
import { slugToRoomName, roomNameToSlug } from "@/utils/slugUtils";

interface IParams {
  roomName?: string;
  companyName?: string;
}

export default async function getReservationsByRoomName(params: IParams) {
  try {
    const { roomName, companyName } = params;

    if (!roomName || !companyName) {
      return [];
    }

    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return [];
    }

    // 1. Find the actual room first to get its canonical name and ID
    // Logic: Look for company by slug first, then fallback to name variations
    const roomsQs = await db.collection('rooms')
      .where('slug', '==', roomName)
      .where('companyName', '==', companyName)
      .get();

    let matchedRoom = roomsQs.empty ? null : { id: roomsQs.docs[0].id, ...roomsQs.docs[0].data() } as any;

    if (!matchedRoom) {
      // Fallback: search all rooms for this company and match by slugified name
      const allRoomsQs = await db.collection('rooms')
        .where('companyName', '==', companyName)
        .get();

      const allRooms = allRoomsQs.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));
      matchedRoom = allRooms.find(room => {
        const dbRoomName = room.name || "";
        return roomNameToSlug(dbRoomName) === roomName.toLowerCase() ||
          dbRoomName.toLowerCase() === roomName.toLowerCase();
      });
    }

    // 2. Determine search criteria
    // Priority: roomId is the most robust way to find reservations
    const queryPromises: any[] = [];

    if (matchedRoom) {
      queryPromises.push(
        db.collection('reservations')
          .where('roomId', '==', matchedRoom.id)
          .limit(100)
          .get()
      );
    }

    // Fallback: names (for legacy records missing roomId)
    const searchNames = matchedRoom ? [matchedRoom.name] : [
      slugToRoomName(roomName),
      roomName,
      roomName.toLowerCase()
    ];

    searchNames.forEach((name) => {
      queryPromises.push(
        db.collection('reservations')
          .where('roomName', '==', name)
          .where('companyName', '==', companyName)
          .limit(100)
          .get()
      );
    });

    const queryResults = await Promise.all(queryPromises);
    const map = new Map<string, any>();

    for (const qs of queryResults) {
      qs.docs.forEach((d: any) => map.set(d.id, { id: d.id, ...d.data() }));
    }

    let reservations = Array.from(map.values());
    console.log("🔍 getReservationsByRoomName - Found reservations:", reservations.length);

    // Sort in-memory instead of database-side
    reservations.sort((a, b) => {
      const timeA = a.createdAt?.toDate ? a.createdAt.toDate().getTime() : (a.createdAt ? new Date(a.createdAt).getTime() : 0);
      const timeB = b.createdAt?.toDate ? b.createdAt.toDate().getTime() : (b.createdAt ? new Date(b.createdAt).getTime() : 0);
      return timeB - timeA; // Descending
    });

    // Normalize Firestore Timestamps to ISO strings for client safety
    return reservations.map((reservation: any) => {
      const start = reservation.start_date?.toDate ? reservation.start_date.toDate() : (reservation.start_date ? new Date(reservation.start_date) : undefined);
      const end = reservation.end_date?.toDate ? reservation.end_date.toDate() : (reservation.end_date ? new Date(reservation.end_date) : undefined);
      const created = reservation.createdAt?.toDate ? reservation.createdAt.toDate() : (reservation.createdAt ? new Date(reservation.createdAt) : undefined);
      return {
        ...reservation,
        start_date: start ? start.toISOString() : undefined,
        end_date: end ? end.toISOString() : undefined,
        createdAt: created ? created.toISOString() : undefined,
        startDate: start ? start.toISOString() : undefined,
        endDate: end ? end.toISOString() : undefined,
      };
    });
  } catch (error) {
    console.error("Error fetching reservations:", error);
    return []; // Return empty array instead of throwing to prevent cascade failures
  }
}
