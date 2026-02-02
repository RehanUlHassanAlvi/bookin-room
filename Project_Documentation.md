# Project Documentation: Hold AV

## 1. Project Overview
"Hold AV" is a web-based **Meeting Room Booking System** designed for companies to manage their physical meeting spaces.
The platform allows:
- **Companies** to register and configure their meeting rooms.
- **Administrators** to invite users (employees).
- **Users** to view room availability in a visual calendar and book meetings.
- **Room Persistence**: Seamless navigation between different room calendars.

**Goal**: Provide a robust, real-time updated scheduling interface with role-based access control (Admin vs User).

## 2. Technology Stack

### Core Framework
- **Framework**: [Next.js 14](https://nextjs.org/) (App Router & Pages Router hybrid)
- **Language**: TypeScript
- **Styling**: Tailwind CSS + `tailwindcss-animate`
- **Linker/Bundler**: Webpack (custom config in `next.config.js` for alias resolution)

### Frontend
- **Calendar Library**: `dhtmlx-scheduler` (free standard edition with Material skin)
- **UI Components**: 
  - `@radix-ui` (Dialog, Select, Label, Slot) for accessible primitives.
  - `react-hot-toast` for notifications.
  - `react-icons` & `lucide-react` for iconography.
  - `@headlessui/react` for accessible UI logic.
- **State/Data Fetching**: `axios` for client-side API requests. React `useState`/`useEffect` for local state.
- **Date Handling**: `date-fns` for robust date manipulation.
- **Optimization**: `next/image` and `next/dynamic` for code splitting.

### Backend (Serverless)
- **Runtime**: Node.js (Vercel / Next.js API Routes).
- **Authentication**: `next-auth` (v4) using **Google Provider** and **Credentials Provider**.
- **Database**: **Firebase Firestore** (NoSQL).
- **DB Driver**: `firebase-admin` (Server-side Admin SDK with Service Account).

## 3. Architecture & Data Model

### Data Flow
1.  **Client**: User interacts with `RoomClient` components.
2.  **Server Actions**: `app/server/actions/*` fetch initial data (Rooms, Current User) for Server Components (`page.tsx`).
3.  **API Routes**: `app/api/*` handle CRUD operations (Create Reservation, Invite User) via `axios` from Client Components.
4.  **Database**: All data persists in Firestore.

### Firestore Schema (NoSQL)
The application uses the following Collections:

#### `users`
Represents registered system users.
- `id` (string): Auto-generated or Auth ID.
- `email` (string): User email.
- `firstname` (string)
- `lastname` (string)
- `role` (string): "admin" | "user"
- `company` (string): ID of the company they belong to.
- `companyName` (string): Slug of the company.
- `emailVerified` (date/string)

#### `rooms`
Meeting rooms belonging to a company.
- `id` (string): Auto-generated.
- `name` (string): Display name (e.g., "Meeting Room A").
- `companyId` (string): Reference to owning company.
- `userId` (string): Creator ID.
- `createdAt` (timestamp)

#### `reservations`
Booking events.
- `id` (string)
- `roomId` (string)
- `userId` (string): Booker.
- `start_date` (timestamp/string)
- `end_date` (timestamp/string)
- `text` (string): Description of meeting.
- `companyId` (string)

#### `companies` (Implied)
Organization entity.
- `id` (string)
- `name` (string)
- `ownerId` (string)

## 4. Key Configurations

### Environment Variables (`.env.local`)
| Variable | Purpose |
| :--- | :--- |
| `FIREBASE_PROJECT_ID` | Firestore Project ID |
| `FIREBASE_CLIENT_EMAIL` | Service Account Email |
| `FIREBASE_PRIVATE_KEY` | Service Account Key (PEM format) |
| `NEXTAUTH_URL` | App URL (e.g., http://localhost:3000) |
| `NEXTAUTH_SECRET` | Encryption key for sessions |
| `GOOGLE_CLIENT_ID` | Google OAuth ID |
| `GOOGLE_CLIENT_SECRET` | Google OAuth Secret |
| `EMAIL_SERVER_*` | SMTP config for sending invites |

### Authentication (`pages/api/auth/[...nextauth].ts`)
- Configures `next-auth` with `FirestoreAdapter`.
- **Providers**:
    - `GoogleProvider`: For easy login.
    - `CredentialsProvider`: For email/password login (custom logic verifying bcrypt passwords).
- **Callbacks**:
    - `session`: Enriches session with `userId`, `role`, and `company` info from Firestore.

## 5. Frontend Details

### Directory Structure (`app/`)
-   `(auth)/`: Login/Register pages.
-   `(rooms)/[companyName]/[roomName]/`: **Core Feature**.
    -   `page.tsx`: Server Component. Fetches Room & Reservations.
    -   `RoomClient.tsx`: Client Component. Wraps the Scheduler.
-   `create/`: Page to create new rooms/companies.
-   `admin/`: Dashboard for managing users and settings.

### Key Components

#### `Scheduler.tsx` (`components/ui/Scheduler.tsx`)
**The Heart of the Application.**
-   Wraps the legacy `dhtmlx-scheduler` library in a React component.
-   **Global Dispatcher Pattern**: Uses a singleton `GLOBAL_DISPATCHER` to bridge the gap between `dhtmlx` (global) and React (component) lifecycles. This logic prevents "Ghost Listeners" and ensures the active room always receives events.
-   **Features**:
    -   Drag-and-drop booking.
    -   Conflict detection (Client-side & Server-side).
    -   Custom "Lightbox" (modal) for event details.

#### `Sidebar.tsx`
-   Lists all rooms for the company.
-   Uses `window.location.href` (or `router.push`) to navigate between rooms.
-   Includes logic to force hard refresh (optional workaround) vs soft navigation.

#### `RoomClient.tsx`
-   Receives `initialRoomByName` (Server Data) as props.
-   Passes data to `Scheduler`.
-   Handles `onCreateReservation` via API call (`POST /api/reservation`).

## 6. Backend API Endpoints (`app/api/`)

### `/api/reservation`
-   **POST**: Creates a new reservation.
    -   **Validation**: Checks for time overlaps in Firestore before confirming.
    -   **Payload**: `{ start_date, end_date, roomId, text }`.
-   **GET**: (If implemented) Fetches reservations.

### `/api/company/[companyId]`
-   Manage company details.

### `/api/invite`
-   Sends email invitations to users via `nodemailer`.
-   Generates secure tokens.

## 7. Development & Deployment

### Run Locally
```bash
npm install
npm run dev
# Server starts at http://localhost:3000
```

### Build
```bash
npm run build
npm start
```

### Database Setup
1.  Create Firebase Project.
2.  Generate Service Account Private Key.
3.  Add credentials to `.env.local`.
4.  Enable Firestore Database.

### Deployment (Vercel)
1.  Connect GitHub Repo to Vercel.
2.  Add Environment Variables in Vercel Dashboard.
3.  (Optional) Configure `vercel.json` if custom headers/routing are needed.

## 8. Miscellaneous

### Debugging Features
-   **Yellow Debug Banner**: Currently active in `RoomClient.tsx` to visualize the Room ID being rendered by the client.
-   **Server Logs**: Extensive logging in `Scheduler.tsx` (Global Dispatcher) to trace event flows.

### Known patterns
-   **Global Singleton Scheduler**: The `dhtmlx` library demands a singleton approach. The codebase strictly manages this via `GLOBAL_DISPATCHER` in `Scheduler.tsx` to handle React mounting/unmounting correctly.

---

## 9. Appendix A: Critical Source Code (Business Logic Blueprint)
*The following source code represents the core logic of the application.*

### 9.1 Global Types (`types/index.ts`)
```typescript
export type SafeRoom = {
  id: string;
  userId?: string | null;
  companyId?: string | null;
  firmanavn?: string | null;
  name?: string | null;
  createdAt: string;
  companyName: string;
};

export type safeUser = {
  id: string;
  email?: string | null;
  firstname?: string | null;
  lastname?: string | null;
  createdAt?: string;
  updatedAt?: string;
  emailVerified?: string | null;
  companyName?: string | null;
  company?: string | null;
  role?: string | null;
};

export type SafeReservations = {
  id: string;
  roomId: string;
  roomName?: string | null;
  companyId?: string | null;
  companyName?: string | null;
  userId: string;
  createdAt?: string;
  start_date?: string;
  end_date?: string;
  text?: string;
  room?: SafeRoom;
};
```

### 9.2 Database Connection (`lib/firebaseAdmin.ts`)
```typescript
import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore, Firestore } from 'firebase-admin/firestore';

let dbInstance: Firestore | null = null;
let appInstance: ReturnType<typeof initializeApp> | null = null;

function initializeFirebase() {
  if (appInstance && dbInstance) {
    return dbInstance;
  }
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  let privateKey = process.env.FIREBASE_PRIVATE_KEY;

  if (!privateKey && process.env.FIREBASE_PRIVATE_KEY_BASE64) {
    try {
      privateKey = Buffer.from(process.env.FIREBASE_PRIVATE_KEY_BASE64, 'base64').toString('utf8');
    } catch {}
  }
  if (privateKey) {
    if ((privateKey.startsWith('"') && privateKey.endsWith('"')) || (privateKey.startsWith("'") && privateKey.endsWith("'"))) {
      privateKey = privateKey.slice(1, -1);
    }
    privateKey = privateKey.replace(/\\n/g, '\n');
  }

  if (!projectId || !clientEmail || !privateKey) {
    throw new Error(`Missing Firebase credentials.`);
  }

  appInstance = getApps()[0] ?? initializeApp({
    credential: cert({ projectId, clientEmail, privateKey }),
  });

  dbInstance = getFirestore(appInstance);
  return dbInstance;
}

export const db = new Proxy({} as Firestore, {
  get(_target, prop) {
    const db = initializeFirebase();
    const value = (db as any)[prop];
    if (typeof value === 'function') {
      return value.bind(db);
    }
    return value;
  },
});
```

### 9.3 Middleware (`middleware.ts`)
```typescript
export { default } from "next-auth/middleware";

export const config = {
  matcher: [],
};
```

### 9.4 Authentication (`pages/api/auth/[...nextauth].ts`)
**Note**: Handles Google + Credentials Login.
```typescript
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
  ...( { trustHost: true } as any ),
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
  pages: { signIn: "/" },
  debug: process.env.NODE_ENV === "development",
  session: { strategy: "jwt" },
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
  secret: process.env.NEXTAUTH_SECRET,
};

export default NextAuth(authOptions);
```

### 9.5 Current User Action (`app/server/actions/getCurrentUser.ts`)
```typescript
import { getServerSession } from "next-auth/next";
import { unstable_cache } from "next/cache";
import { authOptions } from "@/pages/api/auth/[...nextauth]";
import { db } from "@/lib/firebaseAdmin";

export async function getSession() {
  if (typeof window === "undefined") {
    return await getServerSession(authOptions);
  }
  return null;
}

const getCachedUser = unstable_cache(
  async (email: string) => {
    const qs = await db.collection('users').where('email', '==', email).limit(1).get();
    if (qs.empty) return null;
    const doc = qs.docs[0];
    const data = doc.data() as any;
    const createdAt = data.createdAt instanceof Date ? data.createdAt : (data.createdAt?.toDate ? data.createdAt.toDate() : undefined);
    const updatedAt = data.updatedAt instanceof Date ? data.updatedAt : (data.updatedAt?.toDate ? data.updatedAt.toDate() : undefined);
    return {
      id: doc.id,
      email: data.email ?? null,
      firstname: data.firstname ?? null,
      lastname: data.lastname ?? null,
      role: data.role ?? 'user',
      createdAt: createdAt ? createdAt.toISOString() : undefined,
      updatedAt: updatedAt ? updatedAt.toISOString() : undefined,
      emailVerified: data.emailVerified ?? null,
    } as any;
  },
  ['current-user'],
  { revalidate: 60, tags: ['user'] }
);

export default async function getCurrentUser() {
  try {
    const session = await getSession();
    if (!session?.user?.email) return null;
    return await getCachedUser(session.user.email as string);
  } catch (error: any) {
    return null;
  }
}
```

### 9.6 Get Room By Name (`app/server/actions/getByRoomName.ts`)
```typescript
import getCurrentUser from "./getCurrentUser";
import { slugToRoomName } from "@/utils/slugUtils";
import { db } from "@/lib/firebaseAdmin";

interface IParams { roomName?: string; roomId?: string; }

export default async function getRoomByName(params: IParams) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) return;

    if (!currentUser.id) throw new Error("User not found");
    const { roomName } = params;
    
    const convertedRoomName = roomName ? slugToRoomName(roomName) : undefined;
    
    // Strategy: Converted Case -> Exact Match -> Lowercase Match
    const qs1 = convertedRoomName ? await db.collection('rooms').where('name', '==', convertedRoomName).limit(1).get() : { empty: true } as any;
    let room: any = !qs1.empty ? ({ id: qs1.docs[0].id, ...qs1.docs[0].data() }) : null;

    if (!room && roomName) {
      const qs2 = await db.collection('rooms').where('name', '==', roomName).limit(1).get();
      room = !qs2.empty ? ({ id: qs2.docs[0].id, ...qs2.docs[0].data() }) : null;
    }

    if (!room && roomName) {
      const qs3 = await db.collection('rooms').where('name', '==', roomName.toLowerCase()).limit(1).get();
      room = !qs3.empty ? ({ id: qs3.docs[0].id, ...qs3.docs[0].data() }) : null;
    }

    if (!room) return null;

    return {
      ...room,
      createdAt: room.createdAt?.toDate ? room.createdAt.toDate().toISOString() : room.createdAt,
    } as any;
  } catch (error: any) {
    throw new Error(error);
  }
}
```

### 9.7 Get Reservations (`app/server/actions/getReservationByRoomName.ts`)
```typescript
import { db } from "@/lib/firebaseAdmin";
import getCurrentUser from "./getCurrentUser";
import { slugToRoomName } from "@/utils/slugUtils";

interface IParams { roomName?: string; }

export default async function getReservationsByRoomName(params: IParams) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) return [];

    const { roomName } = params;
    if (!roomName) throw new Error("roomName is required");

    const convertedRoomName = roomName ? slugToRoomName(roomName) : undefined;
    const roomNameVariations = [
      convertedRoomName,
      roomName,
      roomName.toLowerCase(),
      roomName.toUpperCase(),
      roomName.charAt(0).toUpperCase() + roomName.slice(1).toLowerCase(),
    ].filter((v, i, arr) => v && arr.indexOf(v) === i);

    const queryPromises = roomNameVariations.map((name) =>
      db.collection('reservations').where('roomName', '==', name).orderBy('createdAt', 'desc').limit(100).get()
    );
    
    const queryResults = await Promise.all(queryPromises);
    const map = new Map<string, any>();
    
    for (const qs of queryResults) {
      qs.docs.forEach((d) => map.set(d.id, { id: d.id, ...d.data() }));
    }
    
    const reservations = Array.from(map.values());
    return reservations.map((reservation: any) => {
      const start = reservation.start_date?.toDate ? reservation.start_date.toDate() : (reservation.start_date ? new Date(reservation.start_date) : undefined);
      const end = reservation.end_date?.toDate ? reservation.end_date.toDate() : (reservation.end_date ? new Date(reservation.end_date) : undefined);
      return {
        ...reservation,
        start_date: start ? start.toISOString() : undefined,
        end_date: end ? end.toISOString() : undefined,
      };
    });
  } catch (error) {
    console.error("Error fetching reservations:", error);
    return [];
  }
}
```

### 9.8 Create Reservation API (`app/api/reservation/route.ts`)
```typescript
import getCurrentUser from "@/app/server/actions/getCurrentUser";
import { NextResponse } from "next/server";
import { db } from "@/lib/firebaseAdmin";
import { slugToCompanyName } from "@/utils/slugUtils";
import { cache, generateCacheKey, CACHE_KEYS } from "@/lib/cache";

async function checkReservationConflict(roomId: string, startDate: string | Date, endDate: string | Date): Promise<boolean> {
  const newStart = new Date(startDate);
  const newEnd = new Date(endDate);
  // ... (conflict logic omitted for brevity, verifyOverlap logic)
  const conflictingQs = await db.collection('reservations')
      .where('roomId', '==', roomId)
      .where('start_date', '<', newEnd)
      .limit(100)
      .get();
  // ... (in-memory filtering)
  return false; // Result
}

export async function POST(request: Request) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser || !currentUser.email) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
    // ... (Validation & Field Extraction)
    
    const docRef = db.collection('reservations').doc();
    const reservationData = {
      _id: docRef.id,
      roomId: roomId,
      // ...
      createdAt: new Date(),
    } as any;
    await docRef.set(reservationData);
    
    // Invalidate Caches
    cache.delete(generateCacheKey(CACHE_KEYS.ROOM_RESERVATIONS, roomName));
    
    return NextResponse.json({ reservations: [ { id: docRef.id, ...reservationData } ], id: docRef.id });
  } catch (err) {
    return NextResponse.json({ error: "Failed to create reservation" }, { status: 500 });
  }
}
```

### 9.9 Key Frontend: Room Client (`app/(rooms)/[companyName]/[roomName]/RoomClient.tsx`)
**Crucial**: Handles State, Props, and API calls.
*Refer to actual file for full React Logic.*
```typescript
"use client";
import React, { useCallback, useEffect, useRef, useState } from "react";
// ... imports

const Reservation = ({
  currentUser,
  roomByName: initialRoomByName,
  reservationsByRomName = [],
  authorizedUsers = [],
}: RoomClientProps) => {
  // ... Hooks & State
  const [reservationsState, setReservationsState] = useState<any[]>(
    Array.isArray(reservationsByRomName) ? reservationsByRomName : []
  );
  
  // onCreateReservation logic...
  const onCreateReservation = useCallback(async (payload) => {
     // API Call to /api/reservation
     // Optimistic Update
  }, [selectedDates, initialRoomByName]);

  return (
    <div className="w-full min-h-[600px] md:h-full md:min-h-screen">
       {/* Yellow Debug Banner */}
       <div className="bg-yellow-100 p-2 text-xs font-mono text-center mb-2">
         DEBUG: Client Room ID: {initialRoomByName?.id} ({initialRoomByName?.name})
       </div>
       <DynamicScheduler
          roomId={initialRoomByName?.id} 
          dates={dates}
          onSubmit={onCreateReservation}
       />
    </div>
  );
};
export default Reservation;
```

### 9.10 Key Frontend: Scheduler (`components/ui/Scheduler.tsx`)
**Crucial**: Wrapper for events and Global Dispatcher.
```typescript
// Uses GLOBAL_DISPATCHER pattern to handle dhtmlx singleton events.
const GLOBAL_DISPATCHER: any = { onEventAdded: null, /*...*/ };

const Scheduler = ({ roomId, onSubmit, dates, ...props }: SchedulerProps) => {
  // ...
  useEffect(() => {
     // Attach Global Listeners ONCE
     if (!GLOBAL_LISTENERS_ATTACHED) {
        scheduler.attachEvent("onEventAdded", (...args) => GLOBAL_DISPATCHER.onEventAdded?.(...args));
        GLOBAL_LISTENERS_ATTACHED = true;
     }

     // Update Dispatcher Methods
     GLOBAL_DISPATCHER.onEventAdded = (id, ev) => {
        // Validate Room Integrity (Ghost Event Protection)
        if (GLOBAL_ACTIVE_ROOM_ID !== roomIdRef.current) return;
        
        // Trigger onSubmit prop
     };
  }, [onSubmit, roomId]);

  // Render dhtmlx
  scheduler.init("scheduler_here", new Date(), "week");
};
```

---

## 10. Appendix B: UI Design & Theme (Visual Blueprint)
*The following configurations ensure the cloned application looks 100% identical to the original.*

### 10.1 Tailwind Configuration (`tailwind.config.js`)
Use this configuration to match the exact color palette and animations.
```javascript
/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ["class"],
  content: [
    "./pages/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./app/**/*.{ts,tsx}",
    "./src/**/*.{ts,tsx}",
  ],
  prefix: "",
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: { "2xl": "1400px" },
    },
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "#907AD6", // Hold AV Purple
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "#4F518C", // Darker Purple/Blue
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        dark: "#2C2A4A",
        light: "#DABFFF",
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};
```

### 10.2 Global CSS & Variables (`app/globals.css`)
This file defines the HSL values for the theme and overrides the Scheduler's default styles.
```css
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  :root {
    @apply bg-gray-50;
    --background: 0 0% 100%;
    --foreground: 222.2 84% 4.9%;
    --card: 0 0% 100%;
    --card-foreground: 222.2 84% 4.9%;
    --popover: 0 0% 100%;
    --popover-foreground: 222.2 84% 4.9%;
    --primary: 222.2 47.4% 11.2%;
    --primary-foreground: 210 40% 98%;
    --secondary: 210 40% 96.1%;
    --secondary-foreground: 222.2 47.4% 11.2%;
    --muted: 210 40% 96.1%;
    --muted-foreground: 215.4 16.3% 46.9%;
    --accent: 210 40% 96.1%;
    --accent-foreground: 222.2 47.4% 11.2%;
    --destructive: 0 84.2% 60.2%;
    --destructive-foreground: 210 40% 98%;
    --border: 214.3 31.8% 91.4%;
    --input: 214.3 31.8% 91.4%;
    --ring: 222.2 84% 4.9%;
    --radius: 0.5rem;
  }
}

/* Scheduler Overrides */
.fc-header-toolbar { @apply space-x-8; }
.fc-view { @apply w-full h-full bg-white lg:h-3/4 xl:h-2/3; }
.fc-h-event, .fc-v-event { @apply border bg-violet-500 border-violet-600; }
.fc .fc-daygrid-day.fc-day-today { @apply bg-violet-100; }
.fc .fc-button { @apply bg-violet-800 hover:bg-violet-900; }

body { font-family: 'Inter', sans-serif; }
.sidebar { font-family: 'Montserrat', sans-serif; }

.dhx_cal_event.employee_event div {
  background-color: #907ad6 !important;
  color: #ffffff !important;
}
.dhx_cal_event:hover {
  border-style: solid !important;
}
```

### 10.3 Fonts (`app/layout.tsx`)
The app uses **Google Fonts**:
- **Inter**: Main body text.
- **Montserrat**: Sidebar and Headings.

Loaded via:
```html
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Montserrat:wght@400;500;600;700&display=swap" rel="stylesheet" />
```

---

## 11. Appendix C: Utilities & Components (Missing Dependencies)
*This section provides source code for utilities and components referenced in the main documentation.*

### 11.1 Slug Utilities (`utils/slugUtils.ts`)
```typescript
/**
 * Utility functions for consistent slug handling
 */

export const roomNameToSlug = (roomName: string): string => {
  return roomName
    .trim()
    .replace(/[<>"'&\/\\]/g, '')
    .replace(/[^a-zA-Z0-9\s-]/g, '-')
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, '')
    .toLowerCase();
};

export const slugToRoomName = (slug: string): string => {
  return slug
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
};

export const companyNameToSlug = (companyName: string): string => {
  return companyName
    .trim()
    .replace(/[<>"'&\/\\]/g, '')
    .replace(/[^a-zA-Z0-9\s-]/g, '-')
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, '')
    .toLowerCase();
};

export const slugToCompanyName = (slug: string): string => {
  return slug
    .split('-')
    .map(word => word.toUpperCase() === 'AS' ? 'AS' : word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
};

export const formatRoomNameForDisplay = (roomName: string): string => {
  if (!roomName) return "";
  if (roomName.includes('-')) {
    return slugToRoomName(roomName);
  }
  return roomName
    .toLowerCase()
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
};

export const sanitizeRoomName = (roomName: string): string => {
  if (!roomName) return "";
  return roomName
    .trim()
    .replace(/[<>"'&\/\\]/g, '')
    .replace(/[^a-zA-Z0-9\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
};

export const formatRoomNameForStorage = (roomName: string): string => {
  if (!roomName) return "";
  const sanitized = sanitizeRoomName(roomName);
  return sanitized
    .toLowerCase()
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
};
```

### 11.2 In-Memory Cache (`lib/cache.ts`)
```typescript
/**
 * Simple in-memory cache for API responses
 */

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number; // Time to live in milliseconds
}

class SimpleCache {
  private cache = new Map<string, CacheEntry<any>>();
  private maxSize = 1000;

  set<T>(key: string, data: T, ttlMinutes: number = 5): void {
    if (this.cache.size >= this.maxSize) {
      this.cleanup();
    }
    const ttl = ttlMinutes * 60 * 1000;
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl,
    });
  }

  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;
    if (Date.now() - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      return null;
    }
    return entry.data;
  }

  delete(key: string): void {
    this.cache.delete(key);
  }

  clear(): void {
    this.cache.clear();
  }

  private cleanup(): void {
    const now = Date.now();
    const keysToDelete: string[] = [];
    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > entry.ttl) {
        keysToDelete.push(key);
      }
    }
    keysToDelete.forEach(key => this.cache.delete(key));
    if (this.cache.size >= this.maxSize) {
      const entries = Array.from(this.cache.entries());
      entries.sort((a, b) => a[1].timestamp - b[1].timestamp);
      const toRemove = entries.slice(0, Math.floor(this.maxSize * 0.2));
      toRemove.forEach(([key]) => this.cache.delete(key));
    }
  }

  getStats() {
    return { size: this.cache.size, maxSize: this.maxSize };
  }
}

export const cache = new SimpleCache();

export const generateCacheKey = (prefix: string, ...params: (string | number)[]): string => {
  return `${prefix}:${params.join(':')}`;
};

export const CACHE_KEYS = {
  USER_RESERVATIONS: 'user_reservations',
  COMPANY_RESERVATIONS: 'company_reservations',
  ROOM_RESERVATIONS: 'room_reservations',
  COMPANY_DATA: 'company_data',
  ROOM_DATA: 'room_data',
} as const;
```

### 11.3 Sidebar Component (`components/Sidebar.tsx`)
```typescript
"use client";
import { logo } from "@/assets";
import Image from "next/image";
import React, { useEffect, useState } from "react";
import Link from "next/link";
import {
  MdHome, MdBookmarkAdd, MdScreenshotMonitor, MdMeetingRoom, MdAccountTree, MdPeople, MdOutlineLogout
} from "react-icons/md";
import { FaBuildingShield, FaUsers, FaPlus } from "react-icons/fa";
import { IoCloseOutline } from "react-icons/io5";
import { CiMenuFries } from "react-icons/ci";
import { useParams, usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { signOut } from "next-auth/react";

interface SidebarProps {
  currentUser?: any | null;
  getByUserId?: any | null;
}

const useRoutes = (currentUser: any) => {
  return [
    ...(currentUser?.role === "admin"
      ? [{ label: "Hjem", icon: MdHome, href: "/", color: "text-light" }]
      : []),
    { label: "Møterom", icon: MdMeetingRoom, color: "text-light", href: "/rooms" },
    { label: "Reservasjoner", icon: MdBookmarkAdd, href: "/reservasjoner", color: "text-light" },
    ...(currentUser?.role === "admin"
      ? [
        { label: "Opprett", icon: FaUsers, color: "text-light", href: "/brukere" },
        { label: "Inviter", icon: FaPlus, href: "/invite", color: "text-light" },
        { label: "Infoskjerm", icon: MdScreenshotMonitor, color: "text-light", href: "/infoskjerm" },
        { label: "All Users", icon: MdPeople, color: "text-light", href: "/all-users" },
      ]
      : []),
  ];
};

const Sidebar = ({ currentUser }: SidebarProps) => {
  const routes = useRoutes(currentUser);
  const companyNameParams = useParams<{ companyName: string; item: string }>();
  const companyName = companyNameParams ? companyNameParams.companyName : null;
  const pathname = usePathname();
  // ... (Standard Sidebar Logic: navOpen state, logout handler)
  return (
    // ... (Standard JSX structure with mobile menu toggle and desktop sidebar)
    // See full implementation in source
  );
};
export default Sidebar;
```
