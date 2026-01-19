import type { Plan } from "@/lib/entitlements/plans";

export type Entitlements = {
    plan: Plan;
    features: {
        probabilitySurface: boolean;
    };
    limits: {
        maxLookbackBars: number;
        maxHorizonBars: number;
        allowedTargetXPreset: number[];
        allowCustomTargetX: boolean;
        maxTargetX: number;
    };
};

const FREE_LIMITS = {
    maxLookbackBars: 500,
    maxHorizonBars: 48,
    allowedTargetXPreset: [5, 10, 15],
    allowCustomTargetX: false,
    maxTargetX: 25,
} as const;

const PRO_LIMITS = {
    maxLookbackBars: 5000,
    maxHorizonBars: 240,
    allowedTargetXPreset: [5, 10, 15, 20, 25],
    allowCustomTargetX: true,
    maxTargetX: 200,
} as const;

export const getEntitlements = (plan: Plan): Entitlements => {
    if (plan === "pro") {
        return {
            plan,
            features: {
                probabilitySurface: true,
            },
            limits: { ...PRO_LIMITS },
        };
    }

    return {
        plan: "free",
        features: {
            probabilitySurface: false,
        },
        limits: { ...FREE_LIMITS },
    };
};
