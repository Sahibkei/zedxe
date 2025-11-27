"use client";

import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { CONDITION_OPTIONS, ALERT_FREQUENCY_OPTIONS } from "@/lib/constants";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

type ApiAlert = Partial<AlertDisplay> & { _id?: string; userId?: string };

const mapAlertFromApi = (alert: ApiAlert): AlertDisplay => ({
    id: String(alert._id || alert.id),
    userId: String(alert.userId),
    symbol: alert.symbol || '',
    name: alert.name,
    condition: alert.condition as AlertCondition,
    thresholdValue: Number(alert.thresholdValue),
    frequency: (alert.frequency as AlertFrequency) || 'once_per_day',
    isActive: Boolean(alert.isActive),
    lastTriggeredAt: alert.lastTriggeredAt || null,
});

const AlertModal = ({ open, onClose, initialState, onSave }: AlertModalProps) => {
    const router = useRouter();
    const [formState, setFormState] = useState<AlertFormState>(initialState);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        setFormState(initialState);
    }, [initialState]);

    const handleSubmit = async (event: React.FormEvent) => {
        event.preventDefault();
        if (saving) return;
        if (formState.thresholdValue === '' || Number.isNaN(Number(formState.thresholdValue))) {
            toast.error('Please enter a valid threshold');
            return;
        }

        setSaving(true);
        try {
            const res = await fetch('/api/alerts', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({
                    id: formState.alertId,
                    symbol: formState.symbol,
                    name: formState.name,
                    condition: formState.condition,
                    thresholdValue: Number(formState.thresholdValue),
                    frequency: formState.frequency,
                }),
            });

            if (res.status === 401) {
                router.push(`/sign-in?redirect=${encodeURIComponent(typeof window !== 'undefined' ? window.location.pathname : '/')}`);
                return;
            }

            if (!res.ok) throw new Error('Failed to save alert');

            const json = await res.json();
            const saved = mapAlertFromApi(json.data);
            onSave?.(saved);
            toast.success(`Alert ${formState.alertId ? 'updated' : 'created'} for ${formState.symbol}`);
            onClose();
        } catch (err) {
            console.error('AlertModal submit error', err);
            toast.error('Unable to save alert right now.');
        } finally {
            setSaving(false);
        }
    };

    const handleChange = (key: keyof AlertFormState, value: string | number) => {
        setFormState((prev) => ({ ...prev, [key]: value }));
    };

    return (
        <Dialog open={open} onOpenChange={(next) => (!next ? onClose() : undefined)}>
            <DialogContent className="bg-[#0f0f0f] border border-gray-800 text-gray-100 max-w-lg">
                <DialogHeader>
                    <DialogTitle className="text-xl text-yellow-400">Price Alert</DialogTitle>
                    <p className="text-sm text-gray-400">Create a simple price alert for {formState.symbol}.</p>
                </DialogHeader>

                <form className="space-y-4" onSubmit={handleSubmit}>
                    <div>
                        <Label className="text-gray-300">Alert Name</Label>
                        <Input
                            value={formState.name || ''}
                            onChange={(e) => handleChange('name', e.target.value)}
                            placeholder={`Alert for ${formState.symbol}`}
                            className="bg-[#111] border-gray-700 text-gray-100"
                        />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                            <Label className="text-gray-300">Symbol</Label>
                            <Input value={`${formState.symbol} • ${formState.company}`} disabled className="bg-[#111] border-gray-700" />
                        </div>
                        <div>
                            <Label className="text-gray-300">Alert Type</Label>
                            <Input value="Price" disabled className="bg-[#111] border-gray-700" />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                            <Label className="text-gray-300">Condition</Label>
                            <Select value={formState.condition} onValueChange={(val) => handleChange('condition', val)}>
                                <SelectTrigger className="bg-[#111] border-gray-700 text-gray-100">
                                    <SelectValue placeholder="Select" />
                                </SelectTrigger>
                                <SelectContent className="bg-[#0f0f0f] text-gray-100 border-gray-800">
                                    {CONDITION_OPTIONS.map((opt) => (
                                        <SelectItem key={opt.value} value={opt.value}>
                                            {opt.label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div>
                            <Label className="text-gray-300">Threshold</Label>
                            <Input
                                type="number"
                                step="0.01"
                                value={formState.thresholdValue}
                                onChange={(e) => handleChange('thresholdValue', e.target.value === '' ? '' : Number(e.target.value))}
                                className="bg-[#111] border-gray-700 text-gray-100"
                                placeholder="250.00"
                            />
                        </div>
                    </div>

                    <div>
                        <Label className="text-gray-300">Frequency</Label>
                        <Select value={formState.frequency} onValueChange={(val) => handleChange('frequency', val)}>
                            <SelectTrigger className="bg-[#111] border-gray-700 text-gray-100">
                                <SelectValue placeholder="Select" />
                            </SelectTrigger>
                            <SelectContent className="bg-[#0f0f0f] text-gray-100 border-gray-800">
                                {ALERT_FREQUENCY_OPTIONS.map((opt) => (
                                    <SelectItem key={opt.value} value={opt.value}>
                                        {opt.label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="flex justify-end gap-3 pt-2">
                        <Button type="button" variant="outline" className="bg-transparent border-gray-700 text-gray-300" onClick={onClose}>
                            Cancel
                        </Button>
                        <Button type="submit" className="bg-yellow-500 text-black hover:bg-yellow-400" disabled={saving}>
                            {saving ? 'Saving...' : formState.alertId ? 'Update Alert' : 'Create Alert'}
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
};

export default AlertModal;
