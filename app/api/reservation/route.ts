import getCurrentUser from "@/app/server/actions/getCurrentUser";
import { NextResponse } from "next/server";
import { db } from "@/lib/firebaseAdmin";
import { slugToCompanyName } from "@/utils/slugUtils";
import { cache, generateCacheKey, CACHE_KEYS } from "@/lib/cache";

/**
 * Helper function to check for reservation conflicts
 * Handles both overlapping reservations and exact same time conflicts
 * IMPORTANT: This prevents double-booking of the same room + time slot
 */
async function checkReservationConflict(
  roomId: string,
  startDate: string | Date,
  endDate: string | Date,
  excludeId?: string
): Promise<{ conflict: boolean; message?: string }> {
  try {
    const newStart = new Date(startDate);
    const newEnd = new Date(endDate);

    if (isNaN(newStart.getTime()) || isNaN(newEnd.getTime())) {
      return { conflict: true, message: "Invalid date format" };
    }

    if (newStart >= newEnd) {
      return { conflict: true, message: "Start time must be before end time" };
    }

    console.log(`[ConflictCheck] Room: ${roomId}, Range: ${newStart.toISOString()} - ${newEnd.toISOString()}`);

    // Query for all reservations for this room. 
    // We filter by roomId (simple index) and check overlaps in memory to avoid complex index requirements.
    const conflictingQs = await db.collection('reservations')
      .where('roomId', '==', roomId)
      .limit(500) // Increase limit to be safe
      .get();

    const conflicts = conflictingQs.docs.filter(doc => {
      const data = doc.data();
      if (excludeId && doc.id === excludeId) return false;

      // Handle both Timestamp and string/Date objects
      const existStart = data.start_date?.toDate ? data.start_date.toDate() : new Date(data.start_date);
      const existEnd = data.end_date?.toDate ? data.end_date.toDate() : new Date(data.end_date);

      if (isNaN(existStart.getTime()) || isNaN(existEnd.getTime())) return false;

      // Standard overlap formula: (StartA < EndB) and (EndA > StartB)
      return newStart < existEnd && newEnd > existStart;
    });

    if (conflicts.length > 0) {
      const first = conflicts[0].data();
      const firstStart = first.start_date?.toDate ? first.start_date.toDate() : new Date(first.start_date);
      const firstEnd = first.end_date?.toDate ? first.end_date.toDate() : new Date(first.end_date);

      const msg = `Slot is already booked from ${firstStart.toLocaleTimeString()} to ${firstEnd.toLocaleTimeString()}`;
      return { conflict: true, message: msg };
    }

    return { conflict: false };
  } catch (error) {
    console.error('[ConflictCheck] Critical Error:', error);
    return { conflict: true, message: "Error validating reservation availability" };
  }
}

export async function POST(request: Request) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser || !currentUser.email) {
      return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
    }

    const body = await request.json();
    const {
      roomId,
      start_date,
      end_date,
      duration,
      text,
      roomName,
      companyName,
    } = body;

    console.log(`[ReservationAPI] POST Request for room ${roomName} (${roomId}) in company ${companyName}`);

    if (!roomId || !start_date || !end_date || text === undefined || text === null || !roomName) {
      return NextResponse.json({ error: "Missing required fields (roomId, dates, text, and roomName are required)" }, { status: 400 });
    }

    // NORMALIZE: Always use the canonical company name for ID lookup
    const convertedCompanyName = companyName ? slugToCompanyName(companyName) : "";
    const decodedCompanyName = (() => { try { return decodeURIComponent(companyName || ""); } catch { return companyName || ""; } })();

    let company: any = null;
    const searchTerms = [convertedCompanyName, decodedCompanyName, companyName].filter((v, i, a) => !!v && a.indexOf(v) === i);

    for (const term of searchTerms) {
      const q = await db.collection('companies').where('firmanavn', '==', term).limit(1).get();
      if (!q.empty) {
        company = { id: q.docs[0].id, ...q.docs[0].data() };
        break;
      }
    }

    if (!company) {
      console.error(`[ReservationAPI] Company NOT FOUND for terms: ${searchTerms.join(', ')}`);
      return NextResponse.json({ error: `Company '${companyName}' not found in our records.` }, { status: 404 });
    }

    // CONFLICT CHECK
    const { conflict, message } = await checkReservationConflict(roomId, start_date, end_date);
    if (conflict) {
      return NextResponse.json({ error: message || "This time slot is already taken." }, { status: 400 });
    }

    // PERSIST
    const newStart = new Date(start_date);
    const newEnd = new Date(end_date);
    const docRef = db.collection('reservations').doc();

    const reservationData = {
      _id: docRef.id,
      roomId: roomId,
      roomName: roomName,
      companyId: company.id,
      companyName: company.firmanavn,
      userId: currentUser.id,
      userEmail: currentUser.email,
      start_date: newStart,
      end_date: newEnd,
      duration: String(duration),
      text: text,
      createdAt: new Date(),
    };

    await docRef.set(reservationData);

    console.log(`[ReservationAPI] ✅ Success! Saved reservation ${docRef.id}`);

    // Invalidate caches
    const keys = [
      generateCacheKey(CACHE_KEYS.USER_RESERVATIONS, currentUser.id),
      generateCacheKey(CACHE_KEYS.COMPANY_RESERVATIONS, company.firmanavn),
      generateCacheKey(CACHE_KEYS.ROOM_RESERVATIONS, roomId)
    ];
    keys.forEach(k => cache.delete(k));

    return NextResponse.json({
      reservations: [{ id: docRef.id, ...reservationData }],
      id: docRef.id
    });
  } catch (err) {
    console.error("Error creating reservation:", err);
    return NextResponse.json({ error: "Failed to create reservation" }, { status: 500 });
  }
}
