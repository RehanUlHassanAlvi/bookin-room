"use client";
import { FieldValues, SubmitHandler, useForm } from "react-hook-form";
import { z } from "zod";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { toast } from "react-hot-toast";
import { ReactNode, useEffect, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { logo } from "../../../assets";
import { FaGoogle } from "react-icons/fa";
import { signIn } from "next-auth/react";
import axios from "axios";
import Input from "@/components/Inputs/Input";
import Button from "@/components/Button";
// Force refresh for Vercel deployment

const Authentification = () => {
  const [isLoading, setIsLoading] = useState(false);
  const hasSubmittedRef = useRef(false);
  const hasToastedRef = useRef(false);
  const [message, setMessage] = useState("");
  const router = useRouter();
  const schema = z.object({
    email: z
      .string()
      .min(1, { message: "Epostadresse er påkrevd" })
      .email({ message: "Ugyldig epostadresse" }),

    password: z
      .string()
      .min(8, { message: "Passordet må være minst 8 karakterer langt" }),
  });

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FieldValues>({
    defaultValues: {
      email: "",
      password: "",
    },
    resolver: async (data) => {
      try {
        await schema.parseAsync(data);
        return {
          values: data,
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

  const onSubmit: SubmitHandler<FieldValues> = (data, e) => {
    e?.preventDefault();
    if (hasSubmittedRef.current) return;
    hasSubmittedRef.current = true;
    setIsLoading(true);

    signIn("credentials", {
      ...data,
      redirect: false,
      callbackUrl: "/",
    })
      .then((callback) => {
        if (callback?.ok) {
          if (!hasToastedRef.current) {
            toast.success("Logget inn");
            hasToastedRef.current = true;
          }
          // Force page refresh after successful login to update session state
          setTimeout(() => {
            window.location.href = "/";
          }, 1000); // 1 second delay
        }

        if (callback?.error) {
          toast.error(callback.error);
        }
      })
      .finally(() => {
        setIsLoading(false);
        hasSubmittedRef.current = false;
      });
  };

  const handleGoogleLogin = async () => {
    const result = await signIn("google", {
      callbackUrl: "/",
      redirect: false
    });
    if (result?.ok) {
      setTimeout(() => {
        window.location.href = "/";
      }, 1000);
    }
  };
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [isSendingReset, setIsSendingReset] = useState(false);

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!forgotEmail) {
      toast.error("Vennligst skriv inn din e-post");
      return;
    }

    try {
      setIsSendingReset(true);
      const res = await axios.post("/api/auth/forgot-password", { email: forgotEmail });
      toast.success(res.data.message || "Tilbakestillingslenke sendt!");
      setIsForgotPassword(false);
    } catch (err: any) {
      toast.error(err.response?.data?.error || "Noe gikk galt");
    } finally {
      setIsSendingReset(false);
    }
  };

  if (isForgotPassword) {
    return (
      <div className="relative w-full mx-auto bg-gradient-to-b from-[#F5F5F5] to-[#fff] min-h-[100vh] ">
        <div>
          <div className="h-auto bg-secondary w-full p-8 mb-[30px]">
            <div className="flex flex-col items-center justify-center w-full">
              <Link href="/" className="flex w-full mx-auto">
                <Image src={logo} width={200} height={100} alt="logo" />
              </Link>
            </div>
          </div>
        </div>
        <div className="w-full mx-auto max-w-[500px] px-10 rounded-[7px]">
          <div className="flex flex-col justify-center w-full">
            <div className="pt-10 mx-auto text-center max-w-[400px] border-b border-black mb-10">
              <h5 className="text-[2rem] uppercase italic font-[700] text-black pb-8">
                Tilbakestill Passord
              </h5>
            </div>
            <p className="mb-6 text-center text-gray-600">
              Skriv inn din e-postadresse, så sender vi deg en lenke for å tilbakestille passordet ditt.
            </p>
            <form onSubmit={handleForgotPassword}>
              <div className="mb-6">
                <label className="block mb-2 text-sm font-semibold text-gray-700">E-post</label>
                <input
                  type="email"
                  className="w-full p-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                  value={forgotEmail}
                  onChange={(e) => setForgotEmail(e.target.value)}
                  placeholder="din@epost.no"
                  disabled={isSendingReset}
                  required
                />
              </div>
              <div className="mb-4">
                <Button label={isSendingReset ? "Sender..." : "Send tilbakestillingslenke"} type disabled={isSendingReset} />
              </div>
              <div className="text-center">
                <span
                  onClick={() => setIsForgotPassword(false)}
                  className="text-sm font-semibold cursor-pointer text-primary hover:underline"
                >
                  Tilbake til innlogging
                </span>
              </div>
            </form>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative w-full mx-auto bg-gradient-to-b from-[#F5F5F5] to-[#fff] min-h-[100vh] ">
      <div>
        <div className="h-auto bg-secondary w-full p-8 mb-[30px]">
          <div className="flex flex-col items-center justify-center w-full">
            <Link href="/" className="flex w-full mx-auto">
              <Image src={logo} width={200} height={100} alt="logo" />
            </Link>
          </div>
        </div>
      </div>
      <div className="w-full mx-auto   max-w-[900px] lg:max-w-[730px] min-h-[80vh] md:max-w-[500px] sm:max-w-[100%] px-10 rounded-[7px]">
        <div className="flex flex-col justify-center w-full">
          <div className="pt-10  mx-auto text-center max-w-[400px] border-b border-black mb-10">
            <h5 className="xl:text-[2.1rem] lg:text-[2.1rem] text-[2rem]  uppercase italic font-[700] text-black pb-8">
              Logg inn
            </h5>
          </div>
          <div>
            <form onSubmit={handleSubmit(onSubmit)}>
              <div className="mb-3">
                <Input
                  id="email"
                  label="E-post"
                  type="text"
                  disabled={isLoading}
                  register={register}
                  errors={errors}
                  required
                />
                <span className="text-rose-500">
                  {errors?.email as ReactNode}
                </span>
              </div>

              <div className="mb-1">
                <Input
                  id="password"
                  label="Passord"
                  type="password"
                  disabled={isLoading}
                  register={register}
                  errors={errors}
                  required
                />
                <span className="text-rose-500">
                  {errors?.password as ReactNode}
                </span>
              </div>

              <div className="flex justify-end mb-4">
                <span
                  onClick={() => setIsForgotPassword(true)}
                  className="text-sm font-semibold cursor-pointer text-primary hover:underline"
                >
                  Glemt passord?
                </span>
              </div>

              <div className="mb-3">
                {message && <span className="text-rose-700">{message}</span>}
              </div>
              <div className="mb-3">
                <Button label={isLoading ? "Logger inn..." : "Logg inn"} type disabled={isLoading} />
              </div>
            </form>

            <div className="mb-3">
              <Button
                label="Fortsett med Google "
                icon={FaGoogle}
                onClick={handleGoogleLogin}
              />
            </div>
            <div className="flex items-center justify-center my-4 text-lg font-semibold text-black ">
              <p className="text-[15px]">
                Har du ikke bruker?&nbsp;
                <span
                  onClick={() => router.push("/signup")}
                  className="cursor-pointer text-primary"
                >
                  Registrer deg
                </span>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Authentification;
