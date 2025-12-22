'use client';

import { useCallback, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import InputField from '@/components/forms/InputField';
import FooterLink from '@/components/forms/FooterLink';
import TurnstileWidget from "@/components/auth/TurnstileWidget";
import {signInWithEmail} from "@/lib/actions/auth.actions";
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
        formState: { errors, isSubmitting },
    } = useForm<SignInFormData>({
        defaultValues: {
            email: '',
            password: '',
        },
        mode: 'onBlur',
    });
    const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
    const [turnstileMessage, setTurnstileMessage] = useState<string | null>(null);
    const [turnstileKey, setTurnstileKey] = useState(0);
    const turnstileRequired = Boolean(process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY);
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
    const getErrorMessage = useCallback((error?: string) => {
        if (!error) return "Failed to sign in.";
        switch (error) {
            case "turnstile_missing":
                return "Please complete the human verification.";
            case "turnstile_invalid":
                return "Human verification failed. Please try again.";
            case "turnstile_misconfigured":
                return "Human verification is unavailable. Please try again later.";
            case "invalid_credentials":
                return "Invalid email or password.";
            default:
                return error;
        }
    }, []);

    const onSubmit = async (data: SignInFormData) => {
        try {
            if (turnstileRequired && !turnstileToken) {
                setTurnstileMessage("Please complete the human verification.");
                return;
            }
            const result = await signInWithEmail({ ...data, turnstileToken });
            if(result.success) {
                router.push(redirectTo);
                return;
            }
            setTurnstileToken(null);
            setTurnstileKey((current) => current + 1);
            if (result.error?.startsWith("turnstile")) {
                setTurnstileMessage(getErrorMessage(result.error));
            }
            toast.error('Sign in failed', {
                description: getErrorMessage(result.error),
            });
        } catch (e) {
            console.error(e);
            setTurnstileToken(null);
            setTurnstileKey((current) => current + 1);
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
                    resetKey={turnstileKey}
                />
                {turnstileMessage ? (
                    <p className="text-xs text-red-400">{turnstileMessage}</p>
                ) : null}

                <Button type="submit" disabled={isSubmitting || (turnstileRequired && !turnstileToken)} className="blue-btn w-full mt-5 text-white">
                    {isSubmitting ? 'Signing In' : 'Sign In'}
                </Button>

                <FooterLink text="Don't have an account?" linkText="Create an account" href="/sign-up" />
            </form>
        </>
    );
};
export default SignIn;
