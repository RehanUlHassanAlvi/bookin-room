import { NextResponse } from "next/server";
import { db } from "@/lib/firebaseAdmin";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ companyId: string }> }
) {
  try {
    const { companyId } = await params;
    const { searchParams } = new URL(request.url);
    const requestedUserId = searchParams.get("userId");

    const normalizedSlug = decodeURIComponent(companyId ?? "")
      .trim()
      .replace(/\s+/g, "-")
      .toLowerCase();

    // 1. Primary lookup Strategy: match by dedicated 'slug' field (robust and consistent)
    let qs = await db.collection('companies').where('slug', '==', normalizedSlug).get();

    // 2. Secondary Strategy: fallback for firmanavn (legacy support)
    if (qs.empty && normalizedSlug) {
      // Try exact match against firmanavn
      qs = await db.collection('companies').where('firmanavn', '==', normalizedSlug).get();

      if (qs.empty) {
        // Legacy title-case conversion
        const legacyName = normalizedSlug
          .split("-")
          .map((word) => (word.toUpperCase() === "AS" ? "AS" : word.charAt(0).toUpperCase() + word.slice(1)))
          .join(" ");
        qs = await db.collection('companies').where('firmanavn', '==', legacyName).get();
      }
    }

    let company = null as any;
    if (!qs.empty) {
      const docs = qs.docs;
      if (requestedUserId) {
        const matchByUser = docs.find((d) => (d.data() as any)?.userId === requestedUserId);
        company = matchByUser
          ? ({ id: matchByUser.id, ...matchByUser.data() } as any)
          : ({ id: docs[0].id, ...docs[0].data() } as any);
      } else {
        company = ({ id: docs[0].id, ...docs[0].data() } as any);
      }
    }

    const response = NextResponse.json(company);

    // Add caching headers for better performance
    response.headers.set('Cache-Control', 'public, s-maxage=600, stale-while-revalidate=1200');
    response.headers.set('CDN-Cache-Control', 'public, s-maxage=600');

    return response;
  } catch (error) {
    console.error(error);
    throw new Error("Failed getting users by company");
  }
}
