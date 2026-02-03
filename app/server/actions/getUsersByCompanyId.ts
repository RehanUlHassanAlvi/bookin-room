import { db } from "@/lib/firebaseAdmin";

interface IParams {
  companyName?: string;
}
export async function getUsersByCompanyId(params: IParams) {
  try {
    const { companyName } = params;

    if (!companyName) {
      return [];
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
          .map((word: string) => (word.toUpperCase() === "AS" ? "AS" : word.charAt(0).toUpperCase() + word.slice(1)))
          .join(" ");
        companyQs = await db.collection('companies').where('firmanavn', '==', legacyName).limit(1).get();
      }
    }

    const getCompanyId = companyQs.empty ? null : ({ id: companyQs.docs[0].id, ...companyQs.docs[0].data() } as any);

    if (!getCompanyId) {
      return [];
    }

    const usersQs = await db.collection('invitedUsers').where('companyId', '==', getCompanyId.id).get();
    const users = usersQs.docs.map((d) => ({ id: d.id, ...d.data() }));

    const safeUser = users.map((user: any) => ({
      ...user,
      createdAt: user.createdAt?.toDate ? user.createdAt.toDate().toISOString() : user.createdAt,
    }));

    return safeUser;
  } catch (error) {
    console.error('Error in getUsersByCompanyId:', error);
    throw error;
  }
}
