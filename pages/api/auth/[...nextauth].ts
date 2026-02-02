import { AuthOptions } from "next-auth";
import { FirestoreAdapter } from "@next-auth/firebase-adapter";
import { db } from "@/lib/firebaseAdmin";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcrypt";
import GoogleProvider from "next-auth/providers/google";
import NextAuth from "next-auth/next";

export const config = {
  runtime: 'nodejs'
};

export const authOptions: AuthOptions = {
  adapter: FirestoreAdapter(db as any),
  ...({ trustHost: true } as any),
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID as string,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET as string,
    }),
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "email", type: "text" },
        password: { label: "password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error("Invalid credentials");
        }
        const q = await (db as any)
          .collection('users')
          .where('email', '==', credentials.email)
          .limit(1)
          .get();
        const user = q.empty ? null : ({ id: q.docs[0].id, ...q.docs[0].data() } as any);
        if (!user || !user.hashedPassword) {
          throw new Error("Invalid credentials");
        }
        const isCorrectedPassword = await bcrypt.compare(
          credentials?.password,
          user.hashedPassword
        );
        if (!isCorrectedPassword) {
          throw new Error("Incorrect Password");
        }

        return user;
      },
    }),
  ],
  pages: {
    signIn: "/",
  },

  debug: process.env.NODE_ENV === "development",
  session: {
    strategy: "jwt",
    // maxAge: 3600,
  },

  callbacks: {
    async jwt({ token, user, trigger, session }) {
      if (trigger == "update") {
        return { ...token, ...session.user };
      }

      return { ...token, ...user };
    },

    async session({ session, token }) {
      session.user = token as any;
      return session;
    },
  },

  events: {
    async createUser({ user }) {
      if (user.email) {
        console.log("🆕 New user created via OAuth, checking for invitations:", user.email);

        try {
          // Look up if user has a pending invitation
          const invQs = await db.collection('invitations').where('userEmail', '==', user.email).limit(1).get();

          if (!invQs.empty) {
            const invitation = { id: invQs.docs[0].id, ...invQs.docs[0].data() } as any;
            console.log("✅ Auto-detecting invitation for OAuth user:", user.email);

            // 1. Update user record with role and companyId
            await db.collection('users').doc(user.id).update({
              role: 'user',
              companyId: invitation.companyId,
              emailVerified: new Date()
            });

            // 2. Create invitedUser association
            await db.collection('invitedUsers').add({
              companyId: invitation.companyId,
              userId: user.id,
              firstname: (user as any).firstname || user.name?.split(' ')[0] || "",
              lastname: (user as any).lastname || user.name?.split(' ').slice(1).join(' ') || "",
              email: user.email,
              adminId: invitation.adminId,
            });

            // 3. Clean up invitation
            await db.collection('invitations').doc(invitation.id).delete();

            console.log("🎉 OAuth user successfully associated with company:", invitation.companyName);
          }
        } catch (error) {
          console.error("❌ Error during OAuth user auto-association:", error);
        }
      }
    }
  },

  secret: process.env.NEXTAUTH_SECRET,
};

export default NextAuth(authOptions);
