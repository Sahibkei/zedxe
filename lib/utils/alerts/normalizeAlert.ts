import type { AlertItem } from "@/database/models/alert.model";

export function normalizeAlert(alert: AlertItem): AlertDisplay {
    return {
        id: String(alert._id),
        userId: alert.userId,
        symbol: alert.symbol,
        company: alert.company,
        alertName: alert.alertName,
        condition: alert.condition,
        thresholdValue: alert.thresholdValue,
        frequency: alert.frequency,
        isActive: alert.isActive,
        createdAt: alert.createdAt,
        lastTriggeredAt: alert.lastTriggeredAt ?? null,
        lastPrice: alert.lastPrice ?? null,
    };
}

export default normalizeAlert;
