import { NextResponse } from "next/server";
import { db } from "@/lib/firebaseAdmin";
import bcrypt from "bcrypt";

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { token, password } = body;

        if (!token || !password) {
            return NextResponse.json({ error: "Mangler token eller passord" }, { status: 400 });
        }

        if (password.length < 8) {
            return NextResponse.json({ error: "Passordet må være minst 8 karakterer langt" }, { status: 400 });
        }

        // 1. Validate token
        const tokenDoc = await db.collection("passwordResetTokens").doc(token).get();

        if (!tokenDoc.exists) {
            return NextResponse.json({ error: "Ugyldig eller utløpt lenke" }, { status: 400 });
        }

        const tokenData = tokenDoc.data();
        const expires = tokenData?.expires?.toDate ? tokenData.expires.toDate() : new Date(tokenData?.expires);

        if (expires < new Date()) {
            await db.collection("passwordResetTokens").doc(token).delete();
            return NextResponse.json({ error: "Lenken har utløpt" }, { status: 400 });
        }

        // 2. Update user password
        const hashedPassword = await bcrypt.hash(password, 12);

        await db.collection("users").doc(tokenData?.userId).update({
            hashedPassword
        });

        // 3. Delete the used token
        await db.collection("passwordResetTokens").doc(token).delete();

        return NextResponse.json({
            success: true,
            message: "Passordet ditt har blitt oppdatert!"
        });
    } catch (error: any) {
        console.error("Reset password error:", error);
        return NextResponse.json({ error: "Noe gikk galt under oppdatering av passordet." }, { status: 500 });
    }
}
