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

    // 1. Fetch companies to find a match
    // We try to find a company where the slug of its firmanavn matches our input slug
    const companiesQs = await db.collection('companies').limit(100).get(); // Limit for safety

    if (companiesQs.empty) {
      return null;
    }

    const companies = companiesQs.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));

    // Use the same slugging logic to find the match
    const { companyNameToSlug } = await import("@/utils/slugUtils");

    const matchedCompany = companies.find(company => {
      const dbName = company.firmanavn || "";
      const dbSlug = companyNameToSlug(dbName);

      return dbSlug === companyName.toLowerCase() ||
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
