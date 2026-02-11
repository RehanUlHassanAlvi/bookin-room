"use client";
import { useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { toast } from "react-hot-toast";
import axios from "axios";
import Image from "next/image";
import Link from "next/link";
import { logo } from "@/assets";
import Button from "@/components/Button";

const ResetPasswordPage = () => {
    const searchParams = useSearchParams();
    const router = useRouter();
    const token = searchParams?.get("token");

    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [isLoading, setIsLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!token) {
            toast.error("Ugyldig eller manglende lenke");
            return;
        }

        if (password.length < 8) {
            toast.error("Passordet må være minst 8 karakterer langt");
            return;
        }

        if (password !== confirmPassword) {
            toast.error("Passordene er ikke like");
            return;
        }

        try {
            setIsLoading(true);
            const res = await axios.post("/api/auth/reset-password", { token, password });
            toast.success(res.data.message);
            router.push("/login"); // Redirect to login after success
        } catch (err: any) {
            toast.error(err.response?.data?.error || "Noe gikk galt");
        } finally {
            setIsLoading(false);
        }
    };

    if (!token) {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen p-10 bg-gray-50">
                <h1 className="text-2xl font-bold text-rose-500">Ugyldig lenke</h1>
                <p className="mt-4 text-gray-600">Denne lenken for tilbakestilling av passord er ugyldig eller har utløpt.</p>
                <Link href="/login" className="mt-6 text-primary hover:underline">
                    Gå tilbake til innlogging
                </Link>
            </div>
        );
    }

    return (
        <div className="relative w-full mx-auto bg-gradient-to-b from-[#F5F5F5] to-[#fff] min-h-[100vh]">
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
                            Nytt Passord
                        </h5>
                    </div>
                    <form onSubmit={handleSubmit}>
                        <div className="mb-4">
                            <label className="block mb-2 text-sm font-semibold text-gray-700">Nytt passord</label>
                            <input
                                type="password"
                                className="w-full p-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="Minst 8 tegn"
                                disabled={isLoading}
                                required
                            />
                        </div>
                        <div className="mb-8">
                            <label className="block mb-2 text-sm font-semibold text-gray-700">Bekreft nytt passord</label>
                            <input
                                type="password"
                                className="w-full p-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                placeholder="Gjenta passord"
                                disabled={isLoading}
                                required
                            />
                        </div>
                        <div className="mb-4">
                            <Button
                                label={isLoading ? "Oppdaterer..." : "Lagre nytt passord"}
                                type
                                disabled={isLoading}
                            />
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
};

export default ResetPasswordPage;
