'use client';

import { useCallback, useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import InputField from '@/components/forms/InputField';
import FooterLink from '@/components/forms/FooterLink';
import TurnstileWidget from '@/components/auth/TurnstileWidget';
import { toast } from 'sonner';

type ResetPasswordFormData = {
    newPassword: string;
    confirmPassword: string;
};

const ResetPasswordPage = () => {
    const router = useRouter();
    const searchParams = useSearchParams();
    const token = searchParams.get('token') ?? '';
    const errorParam = searchParams.get('error');
    const {
        register,
        handleSubmit,
        watch,
        formState: { errors, isSubmitting },
    } = useForm<ResetPasswordFormData>({
        defaultValues: {
            newPassword: '',
            confirmPassword: '',
        },
        mode: 'onBlur',
        reValidateMode: 'onChange',
    });
    const [passwordValue, confirmValue] = watch(['newPassword', 'confirmPassword']);
    const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
    const [turnstileMessage, setTurnstileMessage] = useState<string | null>(null);
    const [resetTurnstile, setResetTurnstile] = useState<(() => void) | null>(null);
    const [tokenError, setTokenError] = useState<string | null>(null);
    const turnstileEnabled = Boolean(process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY);
    const turnstileRequired = turnstileEnabled;
    const formReady = Boolean(passwordValue?.trim() && confirmValue?.trim());
    const isProduction = process.env.NODE_ENV === 'production';

    useEffect(() => {
        if (errorParam === 'INVALID_TOKEN') {
            setTokenError('Reset link is invalid or expired.');
        }
    }, [errorParam]);

    const handleTurnstileSuccess = useCallback((tokenValue: string) => {
        setTurnstileToken(tokenValue);
        setTurnstileMessage(null);
    }, []);

    const handleTurnstileExpire = useCallback(() => {
        setTurnstileToken(null);
        setTurnstileMessage('Verification expired. Please try again.');
    }, []);

    const handleTurnstileError = useCallback(() => {
        setTurnstileToken(null);
        setTurnstileMessage('Verification failed. Please retry.');
    }, []);

    const getErrorMessage = useCallback((error?: string) => {
        if (!error) return 'Failed to reset password.';
        switch (error) {
            case 'turnstile_missing':
                return 'Please complete the human verification.';
            case 'turnstile_failed':
            case 'turnstile_invalid':
                return 'Human verification failed. Please try again.';
            case 'turnstile_misconfigured':
                return 'Human verification is unavailable. Please try again later.';
            case 'INVALID_TOKEN':
                return 'Reset link is invalid or expired.';
            default:
                return error;
        }
    }, []);

    const onSubmit = async (data: ResetPasswordFormData) => {
        setTokenError(null);
        try {
            if (!token) {
                setTokenError('Reset link is missing or invalid.');
                return;
            }
            if (!turnstileEnabled) {
                setTurnstileMessage('Human verification is not configured.');
                return;
            }
            if (turnstileRequired && !turnstileToken) {
                setTurnstileMessage('Please complete the human verification.');
                return;
            }

            const response = await fetch('/api/auth/reset-password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    token,
                    newPassword: data.newPassword,
                    turnstileToken,
                }),
            });

            const contentType = response.headers.get('content-type') ?? '';
            const payload = contentType.includes('application/json') ? await response.json() : null;

            if (response.ok) {
                toast.success('Password updated');
                router.push('/sign-in');
                return;
            }

            const errorCode = payload?.code ?? payload?.error;
            setTurnstileToken(null);
            resetTurnstile?.();

            if (errorCode === 'INVALID_TOKEN') {
                setTokenError('Reset link is invalid or expired.');
            }

            if (typeof errorCode === 'string' && errorCode.startsWith('turnstile')) {
                setTurnstileMessage(getErrorMessage(errorCode));
            }

            const debugSuffix = !isProduction && errorCode ? ` (${errorCode})` : '';
            toast.error('Reset failed', {
                description: `${getErrorMessage(errorCode)}${debugSuffix}`,
            });
        } catch (error) {
            console.error(error);
            setTurnstileToken(null);
            resetTurnstile?.();
            toast.error('Reset failed', {
                description: error instanceof Error ? error.message : 'Failed to reset password.',
            });
        }
    };

    return (
        <>
            <h1 className="form-title">Reset your password</h1>
            <p className="text-sm text-gray-400 mb-6">
                Choose a new password for your account.
            </p>

            {tokenError ? (
                <div className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                    {tokenError} You can request a new reset link.
                </div>
            ) : null}

            {!token ? (
                <p className="text-xs text-red-400 mb-4">Reset link token is missing.</p>
            ) : null}

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
                <InputField
                    name="newPassword"
                    label="New password"
                    placeholder="Enter a new password"
                    type="password"
                    register={register}
                    error={errors.newPassword}
                    validation={{ required: 'Password is required', minLength: 8 }}
                />

                <InputField
                    name="confirmPassword"
                    label="Confirm password"
                    placeholder="Re-enter your password"
                    type="password"
                    register={register}
                    error={errors.confirmPassword}
                    validation={{
                        required: 'Please confirm your password',
                        validate: (value: string) =>
                            value === passwordValue || 'Passwords do not match',
                    }}
                />

                <TurnstileWidget
                    onSuccess={handleTurnstileSuccess}
                    onExpire={handleTurnstileExpire}
                    onError={handleTurnstileError}
                    onResetRef={setResetTurnstile}
                />

                {!turnstileEnabled ? (
                    <p className="text-xs text-red-400">Human verification is not configured.</p>
                ) : null}
                {turnstileMessage ? <p className="text-xs text-red-400">{turnstileMessage}</p> : null}

                <Button
                    type="submit"
                    disabled={
                        isSubmitting ||
                        !formReady ||
                        !turnstileEnabled ||
                        (turnstileRequired && !turnstileToken) ||
                        !token
                    }
                    className="blue-btn w-full mt-5 text-white"
                >
                    {isSubmitting ? 'Updating' : 'Reset password'}
                </Button>

                <FooterLink text="Need a new link?" linkText="Request reset" href="/forgot-password" />
            </form>

            <FooterLink text="Remembered your password?" linkText="Back to sign in" href="/sign-in" />
        </>
    );
};

export default ResetPasswordPage;
