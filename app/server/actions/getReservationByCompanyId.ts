import getCurrentUser from "./getCurrentUser";
import { db } from "@/lib/firebaseAdmin";

interface IParams {
  companyName?: string;
}

export default async function getReservationByCompanyId(params: IParams) {
  try {
    const { companyName } = params;
    if (!companyName) {
      return null;
    }
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return;
    }
    // Firestore: skip join, not used later
    const userWithCompany = { id: currentUser.id } as any;

    if (!userWithCompany) {
      return null;
    }
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
          .map((word) => (word.toUpperCase() === "AS" ? "AS" : word.charAt(0).toUpperCase() + word.slice(1)))
          .join(" ");
        companyQs = await db.collection('companies').where('firmanavn', '==', legacyName).limit(1).get();
      }
    }

    const companyId = companyQs.empty ? null : ({ id: companyQs.docs[0].id, ...companyQs.docs[0].data() } as any);
    if (!companyId) {
      throw new Error("companyId is required");
    }
    const qs = await db.collection('reservations').where('companyId', '==', companyId?.id).get();
    const reservation = qs.docs.map((d) => ({ id: d.id, ...d.data() })) as any[];

    if (!reservation) {
      return null;
    }

    return reservation;
  } catch (error: any) {
    throw new Error(error);
  }
}
