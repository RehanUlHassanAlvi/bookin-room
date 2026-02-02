import React, { Suspense } from "react";
import Rooms from "@/app/admin/(routes)/[companyName]/[userId]/(admin)/rooms/Rooms";
import RoomsFallback from "@/app/admin/(routes)/[companyName]/[userId]/(admin)/rooms/RoomsFallback";

interface IParams {
    companyName: string;
}

const RoomsPage = async ({ params }: { params: Promise<IParams> }) => {
    const resolvedParams = await params;

    return (
        <Suspense fallback={<RoomsFallback />}>
            {/* 
        We pass the params to the existing Rooms component. 
        It expects { userId?, companyName? }, so this works even without userId.
      */}
            <Rooms params={resolvedParams as any} />
        </Suspense>
    );
};

export default RoomsPage;
