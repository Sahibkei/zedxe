"use client";

import { useCallback, useState } from "react";
import { useForm } from "react-hook-form";
import InputField from "@/components/forms/InputField";
import { CountrySelectField } from "@/components/forms/CountrySelectField";
import { Button } from "@/components/ui/button";
import TurnstileWidget from "@/components/auth/TurnstileWidget";

type WaitlistFormData = {
    fullName: string;
    email: string;
    company?: string;
    country: string;
    website?: string;
};

/** Waitlist form for collecting manual onboarding requests. */
const WaitlistForm = () => {
    const {
        register,
        handleSubmit,
        control,
        watch,
        reset,
        formState: { errors, isSubmitting },
    } = useForm<WaitlistFormData>({
        defaultValues: {
            fullName: "",
            email: "",
            company: "",
            country: "",
            website: "",
        },
        mode: "onBlur",
        reValidateMode: "onChange",
    });
    const [status, setStatus] = useState<"idle" | "success" | "error">("idle");
    const [message, setMessage] = useState("");
    const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
    const [turnstileMessage, setTurnstileMessage] = useState<string | null>(null);
    const [resetTurnstile, setResetTurnstile] = useState<(() => void) | null>(null);
    const turnstileEnabled = Boolean(process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY);
    const turnstileRequired = turnstileEnabled;
    const [fullNameValue, emailValue, countryValue] = watch(["fullName", "email", "country"]);
    const formReady = Boolean(fullNameValue?.trim() && emailValue?.trim() && countryValue?.trim());

    const handleTurnstileSuccess = useCallback((token: string) => {
        setTurnstileToken(token);
        setTurnstileMessage(null);
    }, []);
    const handleTurnstileExpire = useCallback(() => {
        setTurnstileToken(null);
        setTurnstileMessage("Verification expired. Please try again.");
    }, []);
    const handleTurnstileError = useCallback(() => {
        setTurnstileToken(null);
        setTurnstileMessage("Verification failed. Please retry.");
    }, []);

    const onSubmit = async (data: WaitlistFormData) => {
        setStatus("idle");
        setMessage("");
        setTurnstileMessage(null);
        try {
            if (turnstileRequired && !turnstileToken) {
                setTurnstileMessage("Please complete the human verification.");
                return;
            }
            const response = await fetch("/api/waitlist", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    fullName: data.fullName,
                    email: data.email,
                    company: data.company,
                    country: data.country,
                    website: data.website,
                    turnstileToken,
                }),
            });
            const payload = await response.json().catch(() => ({}));
            if (!response.ok) {
                setStatus("error");
                setMessage(payload?.error ?? "Something went wrong.");
                setTurnstileToken(null);
                resetTurnstile?.();
                return;
            }
            setStatus("success");
            setMessage("Thanks — we’ll contact you soon.");
            reset();
            setTurnstileToken(null);
            resetTurnstile?.();
        } catch (error) {
            console.error("Waitlist request failed", error);
            setStatus("error");
            setMessage("Unable to join right now.");
            setTurnstileToken(null);
            resetTurnstile?.();
        }
    };

    return (
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            <input
                type="text"
                tabIndex={-1}
                autoComplete="off"
                aria-hidden="true"
                className="hidden"
                {...register("website")}
            />
            <InputField
                name="fullName"
                label="Full name"
                placeholder="Avery Johnson"
                register={register}
                error={errors.fullName}
                validation={{ required: "Full name is required", minLength: 2 }}
                disabled={status === "success"}
            />
            <InputField
                name="email"
                label="Email"
                placeholder="you@company.com"
                type="email"
                register={register}
                error={errors.email}
                validation={{
                    required: "Email is required",
                    pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
                }}
                disabled={status === "success"}
            />
            <InputField
                name="company"
                label="Company (optional)"
                placeholder="ZedXe"
                register={register}
                error={errors.company}
                disabled={status === "success"}
            />
            <CountrySelectField
                name="country"
                label="Country"
                control={control}
                error={errors.country}
                required
            />

            {turnstileEnabled ? (
                <TurnstileWidget
                    onSuccess={handleTurnstileSuccess}
                    onExpire={handleTurnstileExpire}
                    onError={handleTurnstileError}
                    onResetRef={setResetTurnstile}
                />
            ) : null}
            {turnstileMessage ? <p className="text-xs text-red-400">{turnstileMessage}</p> : null}

            <Button
                type="submit"
                disabled={isSubmitting || !formReady || (turnstileRequired && !turnstileToken) || status === "success"}
                className="btn-glow w-full rounded-full bg-teal-400 px-6 py-3 text-sm font-semibold text-gray-900"
            >
                {isSubmitting ? "Joining waitlist..." : "Join waitlist"}
            </Button>

            {message ? (
                <p className={`text-sm ${status === "error" ? "text-red-300" : "text-teal-200"}`}>{message}</p>
            ) : null}
        </form>
    );
};

export default WaitlistForm;
