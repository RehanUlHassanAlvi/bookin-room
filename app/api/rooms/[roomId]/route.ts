import { NextResponse } from "next/server";
import { db } from "@/lib/firebaseAdmin";
import getCurrentUser from "@/app/server/actions/getCurrentUser";
import { roomNameToSlug, companyNameToSlug } from "@/utils/slugUtils";
import { revalidateTag } from "next/cache";
import { cache, generateCacheKey, CACHE_KEYS } from "@/lib/cache";

interface IParams {
    roomId?: string;
}

export async function PATCH(
    request: Request,
    { params }: { params: Promise<IParams> }
) {
    try {
        const currentUser = await getCurrentUser();
        if (!currentUser || currentUser.role !== 'admin') {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { roomId } = await params;
        const body = await request.json();
        const { name } = body;

        if (!roomId) {
            return NextResponse.json({ error: "Missing roomId" }, { status: 400 });
        }

        const roomSnap = await db.collection("rooms").doc(roomId).get();
        if (!roomSnap.exists) {
            return NextResponse.json({ error: "Room not found" }, { status: 404 });
        }
        const roomData = roomSnap.data();

        const updateData: any = {};
        if (name) {
            updateData.name = name;
            updateData.slug = roomNameToSlug(name);
        }

        if (Object.keys(updateData).length === 0) {
            return NextResponse.json({ error: "No data to update" }, { status: 400 });
        }

        const batch = db.batch();
        const roomRef = db.collection("rooms").doc(roomId);
        batch.update(roomRef, updateData);

        // Cascading name update for reservations
        if (name) {
            const reservationsQs = await db.collection("reservations").where("roomId", "==", roomId).get();
            reservationsQs.docs.forEach((doc) => {
                batch.update(doc.ref, { roomName: name });
            });
        }

        await batch.commit();

        // Server-side cache invalidation
        try {
            // 1. Invalidate Next.js cache for rooms
            revalidateTag('rooms');

            // 2. Invalidate SimpleCache for company reservations
            // Invalidate BOTH slug format and database ID format to be safe
            if (roomData?.companyName) {
                const slug = companyNameToSlug(roomData.companyName);
                cache.delete(generateCacheKey(CACHE_KEYS.COMPANY_RESERVATIONS, slug));
            }
            if (roomData?.companyId) {
                cache.delete(generateCacheKey(CACHE_KEYS.COMPANY_RESERVATIONS, roomData.companyId));
            }
        } catch (e) {
            console.error("Cache invalidation failed (PATCH room):", e);
        }

        return NextResponse.json({
            success: true,
            message: "Room and associated reservations updated successfully"
        });
    } catch (error: any) {
        console.error("Error updating room:", error);
        return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 });
    }
}

export async function DELETE(
    request: Request,
    { params }: { params: Promise<IParams> }
) {
    try {
        const currentUser = await getCurrentUser();
        if (!currentUser || currentUser.role !== 'admin') {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { roomId } = await params;
        if (!roomId) {
            return NextResponse.json({ error: "Missing roomId" }, { status: 400 });
        }

        const batch = db.batch();

        // 1. Mark room for deletion
        const roomSnap = await db.collection("rooms").doc(roomId).get();
        if (!roomSnap.exists) {
            return NextResponse.json({ error: "Room not found" }, { status: 404 });
        }
        const roomData = roomSnap.data();
        batch.delete(roomSnap.ref);

        // 2. Cascade delete reservations and send notifications
        const reservationsQs = await db.collection("reservations").where("roomId", "==", roomId).get();

        if (reservationsQs.size > 0) {
            const { sendCancellationMail } = await import("@/lib/sendMail");

            for (const doc of reservationsQs.docs) {
                const resData = doc.data();
                const userEmail = resData.userEmail;

                if (userEmail) {
                    // Only notify for future reservations
                    const rawStart = resData.start_date;
                    const startDate = rawStart?.toDate ? rawStart.toDate() : new Date(rawStart);

                    if (startDate && !isNaN(startDate.getTime()) && startDate > new Date()) {
                        const timeStr = startDate.toLocaleString('no-NO', {
                            weekday: 'long',
                            day: 'numeric',
                            month: 'long',
                            hour: '2-digit',
                            minute: '2-digit'
                        });

                        await sendCancellationMail(
                            userEmail,
                            resData.text || "Reservasjon",
                            timeStr,
                            resData.companyName || "vår tjeneste"
                        );
                    }
                }
                batch.delete(doc.ref);
            }
        }

        await batch.commit();

        // Server-side cache invalidation
        try {
            // 1. Invalidate Next.js cache for rooms
            revalidateTag('rooms');

            // 2. Invalidate SimpleCache for company reservations
            if (roomData?.companyName) {
                const slug = companyNameToSlug(roomData.companyName);
                cache.delete(generateCacheKey(CACHE_KEYS.COMPANY_RESERVATIONS, slug));
            }
            if (roomData?.companyId) {
                cache.delete(generateCacheKey(CACHE_KEYS.COMPANY_RESERVATIONS, roomData.companyId));
            }
        } catch (e) {
            console.error("Cache invalidation failed (DELETE room):", e);
        }

        return NextResponse.json({
            success: true,
            message: "Room and all associated reservations deleted successfully",
            deletedReservationsCount: reservationsQs.size
        });
    } catch (error: any) {
        console.error("Error deleting room:", error);
        return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 });
    }
}
