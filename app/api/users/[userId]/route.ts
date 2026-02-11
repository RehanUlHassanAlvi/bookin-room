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

        // 0. Get user and company details for email notifications
        const userSnap = await db.collection("users").doc(userId).get();
        const userData = userSnap.data();
        const userEmail = userData?.email;

        let companyName = "vår tjeneste";
        if (userData?.companyId) {
            const companySnap = await db.collection("companies").doc(String(userData.companyId)).get();
            const companyData = companySnap.data();
            companyName = companyData?.firmanavn || companyData?.name || companyName;
        }

        // 1. Mark user for deletion
        const userRef = db.collection("users").doc(userId);
        batch.delete(userRef);

        // 2. Cascade delete reservations and send emails
        const reservationsQs = await db.collection("reservations").where("userId", "==", userId).get();

        if (userEmail && reservationsQs.size > 0) {
            const { sendCancellationMail } = await import("@/lib/sendMail");

            for (const doc of reservationsQs.docs) {
                const resData = doc.data();

                // Only notify for future reservations to avoid spamming about past ones
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
                        companyName
                    );
                }
                batch.delete(doc.ref);
            }
        } else {
            reservationsQs.docs.forEach((doc) => {
                batch.delete(doc.ref);
            });
        }

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
