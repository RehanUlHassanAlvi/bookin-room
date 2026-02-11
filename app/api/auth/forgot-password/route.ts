import { NextResponse } from "next/server";
import { db } from "@/lib/firebaseAdmin";
import crypto from "crypto";
import { sendResetPasswordMail } from "@/lib/sendMail";

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { email } = body;

        if (!email) {
            return NextResponse.json({ error: "E-post er påkrevd" }, { status: 400 });
        }

        // 1. Check if user exists
        const userQs = await db.collection("users").where("email", "==", email).limit(1).get();

        if (userQs.empty) {
            // Security: Don't reveal if email exists, just say "if it exists, we sent it"
            return NextResponse.json({ success: true, message: "Hvis en konto eksisterer for denne e-posten, har vi sendt en tilbakestillingslenke." });
        }

        const user = userQs.docs[0].data();

        // 2. Generate secure token
        const token = crypto.randomBytes(32).toString("hex");
        const expires = new Date(Date.now() + 3600000); // 1 hour from now

        // 3. Store token in Firestore
        // We use a dedicated collection for security and easy cleanup
        await db.collection("passwordResetTokens").doc(token).set({
            email,
            expires,
            userId: userQs.docs[0].id,
            createdAt: new Date()
        });

        // 4. Send email
        const resetLink = `${process.env.NEXT_PUBLIC_URL || 'http://localhost:3000'}/reset-password?token=${token}`;

        await sendResetPasswordMail(email, resetLink);

        return NextResponse.json({
            success: true,
            message: "Hvis en konto eksisterer for denne e-posten, har vi sendt en tilbakestillingslenke."
        });
    } catch (error: any) {
        console.error("Forgot password error:", error);
        return NextResponse.json({ error: "Noe gikk galt. Vennligst prøv igjen senere." }, { status: 500 });
    }
}
