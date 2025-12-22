'use client';

import { useCallback, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import InputField from '@/components/forms/InputField';
import FooterLink from '@/components/forms/FooterLink';
import TurnstileWidget from "@/components/auth/TurnstileWidget";
import type { SignInFormData } from "@/lib/types/auth";
import {toast} from "sonner";
import {useRouter, useSearchParams} from "next/navigation";
import { safeRedirect } from "@/lib/safeRedirect";


const SignIn = () => {
    const router = useRouter();
    const searchParams = useSearchParams();
    const redirectTo = safeRedirect(searchParams.get("redirect"), "/dashboard");
    const {
        register,
        handleSubmit,
        watch,
        formState: { errors, isSubmitting },
    } = useForm<SignInFormData>({
        defaultValues: {
            email: '',
            password: '',
        },
        mode: 'onBlur',
        reValidateMode: 'onChange',
    });
    const [emailValue, passwordValue] = watch(["email", "password"]);
    const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
    const [turnstileMessage, setTurnstileMessage] = useState<string | null>(null);
    const [resetTurnstile, setResetTurnstile] = useState<(() => void) | null>(null);
    const turnstileEnabled = Boolean(process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY);
    const turnstileRequired = turnstileEnabled;
    const formReady = Boolean(emailValue?.trim() && passwordValue?.trim());
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
        setTurnstileMessage("Verification failed. Please try again.");
    }, []);
    const handleTurnstileReset = useCallback(() => {
        setTurnstileToken(null);
    }, []);
    const getErrorMessage = useCallback((status?: number, code?: string) => {
        if (status === 401) return "Invalid email or password.";
        if (status === 403 && code === "turnstile_missing") return "Please complete the verification.";
        if (status === 403 && code === "turnstile_failed") return "Verification failed. Please try again.";
        if (status === 500 && code === "turnstile_misconfigured") {
            return "Verification service misconfigured. Please contact support.";
        }
        return "Failed to sign in.";
    }, []);
    const isProduction = process.env.NODE_ENV === "production";

    const onSubmit = async (data: SignInFormData) => {
        try {
            if (!turnstileEnabled) {
                setTurnstileMessage("Human verification is not configured.");
                return;
            }
            if (turnstileRequired && !turnstileToken) {
                setTurnstileMessage("Please complete the human verification.");
                return;
            }
            const response = await fetch("/api/auth/sign-in", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify({
                    email: data.email,
                    password: data.password,
                    turnstileToken,
                }),
            });
            const contentType = response.headers.get("content-type") ?? "";
            const payload = contentType.includes("application/json") ? await response.json() : null;
            if (response.ok) {
                router.push(redirectTo);
                return;
            }
            const errorCode = payload?.code;
            setTurnstileToken(null);
            resetTurnstile?.();
            if (typeof errorCode === "string" && errorCode.startsWith("turnstile")) {
                setTurnstileMessage(getErrorMessage(response.status, errorCode));
            }
            const debugSuffix = !isProduction && errorCode ? ` (${errorCode})` : "";
            toast.error('Sign in failed', {
                description: `${getErrorMessage(response.status, errorCode)}${debugSuffix}`,
            });
        } catch (e) {
            console.error(e);
            setTurnstileToken(null);
            resetTurnstile?.();
            toast.error('Sign in failed', {
                description: e instanceof Error ? e.message : 'Failed to sign in.'
            })
        }
    }

    return (
        <>
            <h1 className="form-title">Welcome back</h1>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
                <InputField
                    name="email"
                    label="Email"
                    placeholder="contact@jsmastery.com"
                    register={register}
                    error={errors.email}
                    validation={{ required: 'Email is required', pattern: /^\w+@\w+\.\w+$/ }}
                />

                <InputField
                    name="password"
                    label="Password"
                    placeholder="Enter your password"
                    type="password"
                    register={register}
                    error={errors.password}
                    validation={{ required: 'Password is required', minLength: 8 }}
                />

                <TurnstileWidget
                    onSuccess={handleTurnstileSuccess}
                    onExpire={handleTurnstileExpire}
                    onError={handleTurnstileError}
                    onResetRef={setResetTurnstile}
                    onTokenReset={handleTurnstileReset}
                />
                {!turnstileEnabled ? (
                    <p className="text-xs text-red-400">Human verification is not configured.</p>
                ) : null}
                {turnstileMessage ? (
                    <p className="text-xs text-red-400">{turnstileMessage}</p>
                ) : null}

                <Button
                    type="submit"
                    disabled={isSubmitting || !formReady || !turnstileEnabled || (turnstileRequired && !turnstileToken)}
                    className="blue-btn w-full mt-5 text-white"
                >
                    {isSubmitting ? 'Signing In' : 'Sign In'}
                </Button>

                <FooterLink text="Don't have an account?" linkText="Create an account" href="/sign-up" />
            </form>
        </>
    );
};
export default SignIn;
