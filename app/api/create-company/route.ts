import getCurrentUser from "@/app/server/actions/getCurrentUser";
import { db } from "@/lib/firebaseAdmin";
import { NextResponse } from "next/server";
import { companyNameToSlug } from "@/utils/slugUtils";
import { revalidateTag } from "next/cache";

// Auto-sanitize company name function - preserves Norwegian characters (ÆØÅæøå)
const autoSanitizeCompanyName = (companyName: string): string => {
  if (!companyName) return "";

  return companyName
    .trim()
    .replace(/[<>]/g, '')
    .replace(/["']/g, '')
    .replace(/[&]/g, 'and')
    .replace(/[\/\\]/g, ' ')
    .replace(/[^a-zA-Z0-9æøåÆØÅ\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
};

const formatCompanyNameForStorage = (companyName: string): string => {
  if (!companyName) return "";

  const sanitized = autoSanitizeCompanyName(companyName);

  // Preserve Norwegian characters in title case conversion
  return sanitized
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
};

export async function POST(request: Request) {
  try {
    const currentUser = await getCurrentUser();

    if (!currentUser) {
      return;
    }

    const body = await request.json();
    const {
      organisasjonsnummer,
      firmanavn,
      adresse,
      postnummer,
      poststed,
      fornavn,
      etternavn,
      epost,
    } = body;

    // Auto-sanitize company name instead of blocking
    const originalName = firmanavn;
    const sanitizedCompanyName = formatCompanyNameForStorage(firmanavn);

    // Show what was changed if sanitization occurred
    if (originalName !== sanitizedCompanyName) {
      console.log(`Company name auto-sanitized: "${originalName}" -> "${sanitizedCompanyName}"`);
    }

    const companyRef = db.collection('companies').doc();
    const companyDetails = {
      id: companyRef.id,
      organisasjonsnummer,
      firmanavn: sanitizedCompanyName, // Raw name with Norwegian characters
      slug: companyNameToSlug(sanitizedCompanyName), // Standardized URL slug
      adresse,
      postnummer,
      poststed,
      fornavn,
      etternavn,
      epost,
      userId: currentUser?.id,
    } as any;
    await companyRef.set({ ...companyDetails });

    // Resilient user update: Use set with merge instead of update to avoid "doc not found" errors
    // Also add logging for debugging
    const userDocRef = db.collection('users').doc(currentUser?.id as string);
    console.log(`[api/create-company] Updating user ${currentUser?.id} to admin role...`);

    await userDocRef.set({
      role: "admin",
      updatedAt: new Date(),
      // Ensure basic user info persists if it's a new setup
      lastKnownEmail: currentUser?.email
    }, { merge: true });

    console.log(`[api/create-company] User ${currentUser?.id} updated successfully.`);

    try {
      revalidateTag('user');
    } catch (e) {
      console.warn("Failed to revalidate user tag in create-company:", e);
    }

    return NextResponse.json(companyDetails);
  } catch (error: any) {
    console.error("Error in POST endpoint:", error);
    // Return a more descriptive error if possible
    return NextResponse.json(
      { error: "Kunne ikke opprette firma", details: error?.message || String(error) },
      { status: 500 }
    );
  }
}
