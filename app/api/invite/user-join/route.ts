import { db } from "@/lib/firebaseAdmin";
import { NextResponse } from "next/server";
export async function POST(request: Request): Promise<void | Response> {
  try {
    const body = await request.json();
    const { token, companyName, userId, adminId } = body;
    if (!token || !companyName || !userId || !adminId) {
      throw new Error("Ugyldig data");
    }

    const tokenSnap = await db.collection('invitations').doc(token).get();
    const invitedToken = tokenSnap.exists ? ({ id: tokenSnap.id, ...tokenSnap.data() } as any) : null;
    if (!invitedToken) {
      return new NextResponse("Ugyldig token", { status: 400 });
    }

    // check if company exists - prioritize dedicated slug field
    const normalizedSlug = decodeURIComponent(companyName ?? "")
      .trim()
      .replace(/\s+/g, "-")
      .toLowerCase();

    // 1. Primary lookup Strategy: match by dedicated 'slug' field
    let companyQs = await db.collection('companies').where('slug', '==', normalizedSlug).limit(1).get();

    // 2. Secondary Strategy: fallback for firmanavn (legacy support)
    if (companyQs.empty && normalizedSlug) {
      // Try exact match against firmanavn
      companyQs = await db.collection('companies').where('firmanavn', '==', normalizedSlug).limit(1).get();

      if (companyQs.empty) {
        const legacyName = normalizedSlug
          .split("-")
          .map((word: string) => (word.toUpperCase() === "AS" ? "AS" : word.charAt(0).toUpperCase() + word.slice(1)))
          .join(" ");
        companyQs = await db.collection('companies').where('firmanavn', '==', legacyName).limit(1).get();
      }
    }

    const companyId = companyQs.empty ? null : ({ id: companyQs.docs[0].id, ...companyQs.docs[0].data() } as any);
    if (!companyId) {
      throw new Error("FirmaID er påkrevd");
    }
    if (!token) {
      throw new Error("token er påkrevd");
    }

    // check if the user exists based on params
    const userSnap = await db.collection('users').doc(userId).get();
    const userByToken = userSnap.exists ? ({ id: userSnap.id, ...userSnap.data() } as any) : null;

    if (!userByToken) {
      throw new Error("Ugyldig data");
    }

    const invitedRef = await db.collection('invitedUsers').add({
      companyId: companyId?.id,
      userId: userByToken?.id,
      firstname: userByToken?.firstname,
      lastname: userByToken?.lastname,
      email: userByToken?.email,
      adminId: adminId,
    });
    const insertedInvitedUser = { id: invitedRef.id } as any;
    await db.collection('invitations').doc(token).delete();
    await db.collection('users').doc(userId).update({ _id: userId, accessToken: null, updatedAt: new Date() });

    return NextResponse.json(insertedInvitedUser);

    // // Insert the user data into the InvitedUsers table
  } catch (error) {
    console.error(error);
    return NextResponse.error();
  }
}
