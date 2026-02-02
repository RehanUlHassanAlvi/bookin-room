"use client";
import React, { ReactNode, useState, useEffect } from "react";
import Button from "@/components/Button";
import Input from "@/components/Inputs/Input";

import Width from "@/components/Width";
import axios from "axios";
import { FieldValues, SubmitHandler, useForm } from "react-hook-form";
import { z } from "zod";
import { toast } from "react-hot-toast";
import { useParams, useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
//import { safeUser } from "@/types";

interface SlugClientProps {
  currentUser?: any | null;
  userById?: any | null;
  realCompanyName: string;
}

const SlugClinet = ({ currentUser, userById, realCompanyName }: SlugClientProps) => {
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();
  const schema = z.object({
    name: z.string()
      .min(3, { message: "Navn må være minst 3 tegn" })
      .max(50, { message: "Navn kan ikke være lengre enn 50 tegn" })
      .transform((name) => {
        // Auto-sanitize: convert special characters instead of blocking
        return name
          .trim()
          .replace(/[<>]/g, '') // Remove angle brackets
          .replace(/["']/g, '') // Remove quotes
          .replace(/[&]/g, 'and') // Replace & with 'and'
          .replace(/[\/\\]/g, ' ') // Replace slashes with spaces
          .replace(/[^a-zA-Z0-9\s-]/g, ' ') // Replace other special chars
          .replace(/\s+/g, ' ') // Multiple spaces to single
          .trim();
      }),
  });
  const companyNameParams = useParams<{ companyName: string; item: string }>();
  const companyName = companyNameParams ? companyNameParams.companyName : null;

  /* 
   * SMART RELOAD FAILSAFE: Detect soft-nav vs hard-reload
   * If the user arrives at the Add Room page from a different company unit
   * via soft navigation, we force a refresh to ensure fresh data.
   */
  useEffect(() => {
    if (typeof window !== "undefined") {
      const lastCompany = (window as any)._LAST_ADMIN_COMPANY;
      if (companyName && lastCompany && companyName !== lastCompany) {
        console.log("🔄 Room Creator context switch detected! Forcing hard refresh...");
        (window as any)._LAST_ADMIN_COMPANY = companyName;
        window.location.reload();
        return;
      }
      (window as any)._LAST_ADMIN_COMPANY = companyName;
    }
  }, [companyName]);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FieldValues>({
    defaultValues: {
      name: "",
    },
    resolver: async (data) => {
      try {
        const result = await schema.parseAsync(data);
        return {
          values: result,
          errors: {},
        };
      } catch (error: any) {
        return {
          values: {},
          errors: error.errors.reduce((acc: any, curr: any) => {
            const fieldName = curr.path.join(".");
            acc[fieldName] = curr.message;
            return acc;
          }, {}),
        };
      }
    },
  });
  const queryClient = useQueryClient();

  const onSubmit: SubmitHandler<FieldValues> = async (data: any) => {
    if (isLoading) return; // Prevent multiple submissions
    setIsLoading(true);
    try {
      const roomName = data?.name;
      if (typeof roomName === "string") {
        const response = await axios.post(`/api/rooms/create-room`, {
          name: roomName, // Already sanitized by zod transform
          companyName: realCompanyName,
        });

        console.log(`[SlugClient] Room created! Name: ${roomName}, Company: ${companyName}`);

        const newRoom = response.data;

        // Optimistic update: Add the new room to the cache immediately
        queryClient.setQueryData(["roomsForCompany", companyName], (oldData: any) => {
          if (!oldData) return [newRoom];
          // Check if room already exists to avoid duplicates
          const exists = oldData.some((room: any) => room.id === newRoom.id);
          if (exists) return oldData;
          return [...oldData, newRoom];
        });

        // Force a hard refresh of the rooms query to ensure fresh data
        await queryClient.invalidateQueries({ queryKey: ["roomsForCompany", companyName] });
        await queryClient.refetchQueries({ queryKey: ["roomsForCompany", companyName] });

        // Also invalidate any cached room data
        queryClient.removeQueries({ queryKey: ["roomsForCompany"] });

        toast.success("Møterom Opprettet");

        // Navigate to rooms page using proper slug utility
        const { companyNameToSlug } = await import("@/utils/slugUtils");
        window.location.href = `/admin/${companyNameToSlug(companyName || "")}/${currentUser?.id}/rooms`;
      } else {
        toast.error("Ugyldig navn");
      }
    } catch (error: any) {
      console.log(error);
      // Revert optimistic update on error by invalidating and refetching
      queryClient.invalidateQueries({ queryKey: ["roomsForCompany", companyName] });
      queryClient.refetchQueries({ queryKey: ["roomsForCompany", companyName] });
      if (error.response) {
        // Check the status code and customize the error message accordingly
        if (error.response.status === 400) {
          toast.error("Bruker eksisterer ikke");
        }
        toast.error("Det har oppstått en feil");
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <Width>
        <div className="mb-3">
          <Input
            id="name"
            label="Møterom navn"
            type="text"
            disabled={isLoading}
            register={register}
            errors={errors}
            required
          />
          <span className="text-rose-500 text-[12px] font-semibold">
            {errors?.name as ReactNode}
          </span>
        </div>
        <p className="text-[12px] font-semibold "></p>
        <Width medium>
          <Button
            label={isLoading ? "Oppretter..." : "Legg til"}
            type
            disabled={isLoading}
            loading={isLoading}
          />
        </Width>
      </Width>
    </form>
  );
};

export default SlugClinet;
