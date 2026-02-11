import { NextResponse } from "next/server";
import { db } from "@/lib/firebaseAdmin";
import getCurrentUser from "@/app/server/actions/getCurrentUser";

interface IParams {
    userId?: string;
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

        const { userId } = await params;
        const body = await request.json();
        const { firstname, lastname } = body;

        if (!userId) {
            return NextResponse.json({ error: "Missing userId" }, { status: 400 });
        }

        const updateData: any = {};
        if (firstname) updateData.firstname = firstname;
        if (lastname) updateData.lastname = lastname;

        if (Object.keys(updateData).length === 0) {
            return NextResponse.json({ error: "No data to update" }, { status: 400 });
        }

        await db.collection("users").doc(userId).update(updateData);

        return NextResponse.json({ success: true, message: "User updated successfully" });
    } catch (error: any) {
        console.error("Error updating user:", error);
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

        const { userId } = await params;
        if (!userId) {
            return NextResponse.json({ error: "Missing userId" }, { status: 400 });
        }

        const batch = db.batch();

        // 1. Mark user for deletion
        const userRef = db.collection("users").doc(userId);
        batch.delete(userRef);

        // 2. Cascade delete reservations
        const reservationsQs = await db.collection("reservations").where("userId", "==", userId).get();
        reservationsQs.docs.forEach((doc) => {
            batch.delete(doc.ref);
        });

        // 3. Cleanup invitedUsers records
        const invitedQs = await db.collection("invitedUsers").where("userId", "==", userId).get();
        invitedQs.docs.forEach((doc) => {
            batch.delete(doc.ref);
        });

        await batch.commit();

        return NextResponse.json({
            success: true,
            message: "User and all associated reservations deleted successfully",
            deletedReservationsCount: reservationsQs.size
        });
    } catch (error: any) {
        console.error("Error deleting user:", error);
        return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 });
    }
}
