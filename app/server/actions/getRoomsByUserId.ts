import { db } from "@/lib/firebaseAdmin";
import getCurrentUser from "./getCurrentUser";

interface IParams {
  userId?: string;
}

export default async function getRoomsByUserId(params: IParams) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return;
    }
    const { userId } = params;
    if (!userId) {
      return;
    }
    const qs = await db.collection('rooms').where('userId', '==', userId).get();
    let rooms = qs.docs.map((d) => ({ id: d.id, ...d.data() })) as any[];

    // In-memory sort
    rooms.sort((a, b) => {
      const timeA = a.createdAt?.toDate ? a.createdAt.toDate().getTime() : (a.createdAt ? new Date(a.createdAt).getTime() : 0);
      const timeB = b.createdAt?.toDate ? b.createdAt.toDate().getTime() : (b.createdAt ? new Date(b.createdAt).getTime() : 0);
      return timeB - timeA;
    });
    const safeRooms = rooms.map((room: any) => ({
      ...room,
      createdAt: room.createdAt?.toDate ? room.createdAt.toDate().toISOString() : room.createdAt,
      companyName: room.companyName,
    }));

    return safeRooms;
  } catch (error: any) {
    throw new Error(error);
  }
}
