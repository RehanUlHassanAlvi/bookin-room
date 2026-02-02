import Container from "@/components/Container";
import Heading from "@/components/Heading";
import React from "react";
import SlugClient from "./SlugClinet";
import getCurrentUser from "@/app/server/actions/getCurrentUser";
import getUserById from "@/app/server/actions/getUserById";
import { getCreatorByCompanyName } from "@/app/server/actions/getCreatorOfTheCompany";

interface IParams {
  userId?: string;
  companyName?: string;
}

const Slug = async ({ params }: { params: Promise<IParams> }) => {
  const currentUser = await getCurrentUser();
  const { userId, companyName } = await params;

  const [userById, creatorByCompanyName] = await Promise.all([
    getUserById({ userId: userId }),
    getCreatorByCompanyName({ companyName: companyName })
  ]);

  const realCompanyName = creatorByCompanyName?.firmanavn || companyName || "";

  return (
    <Container>
      <div>
        <Heading title="Legg til møterom" />
      </div>
      <div>
        <SlugClient
          currentUser={currentUser}
          userById={userById}
          realCompanyName={realCompanyName}
        />
      </div>
    </Container>
  );
};

export default Slug;
