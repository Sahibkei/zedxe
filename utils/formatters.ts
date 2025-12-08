export const formatNumber = (value: number, maximumFractionDigits = 4) =>
    value.toLocaleString(undefined, { maximumFractionDigits });

export const formatTime = (timestamp: number) =>
    new Date(timestamp).toLocaleTimeString([], { minute: '2-digit', second: '2-digit' });
