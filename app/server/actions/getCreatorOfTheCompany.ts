import getCurrentUser from "@/app/server/actions/getCurrentUser";
import { db } from "@/lib/firebaseAdmin";

interface IParams {
  companyName?: string;
}

export async function getCreatorByCompanyName(params: IParams) {
  try {
    const { companyName } = params;
    const currentUser = await getCurrentUser();

    if (!currentUser) {
      return null;
    }

    if (!companyName) {
      return null;
    }

    console.log(`[getCreatorByCompanyName] Looking for company: "${companyName}"`);

    // 1. Primary lookup Strategy: match by dedicated 'slug' field (robust and consistent)
    const slugQs = await db.collection('companies').where('slug', '==', companyName.toLowerCase()).limit(1).get();

    if (!slugQs.empty) {
      console.log(`[getCreatorByCompanyName] Found match by slug: ${slugQs.docs[0].data().firmanavn}`);
      return { id: slugQs.docs[0].id, ...slugQs.docs[0].data() } as any;
    }

    // 2. Secondary Strategy: fetch and match (legacy support)
    const companiesQs = await db.collection('companies').limit(200).get();

    if (companiesQs.empty) {
      return null;
    }

    const companies = companiesQs.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));
    const { companyNameToSlug } = await import("@/utils/slugUtils");

    const matchedCompany = companies.find(company => {
      const dbName = company.firmanavn || "";
      const dbStoredSlug = company.slug || "";
      const dbGeneratedSlug = companyNameToSlug(dbName);

      return dbStoredSlug === companyName.toLowerCase() ||
        dbGeneratedSlug === companyName.toLowerCase() ||
        dbName.toLowerCase() === companyName.toLowerCase();
    });

    if (matchedCompany) {
      console.log(`[getCreatorByCompanyName] Found match: ${matchedCompany.firmanavn}`);
      return matchedCompany;
    }

    // fallback for backwards compatibility if companies list is too large to fetch all
    const convertedCompanyName = companyName
      ?.split('-')
      .map((word: string) => word.toUpperCase() === 'AS' ? 'AS' : word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');

    const qs = await db.collection('companies').where('firmanavn', '==', convertedCompanyName).limit(1).get();
    let creator: any = qs.empty ? null : ({ id: qs.docs[0].id, ...qs.docs[0].data() } as any);

    return creator;
  } catch (error) {
    console.error("[getCreatorByCompanyName] Error:", error);
    return null;
  }
}
