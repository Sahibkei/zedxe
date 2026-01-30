import type { AxisBaseOption, TextStyleOption, TooltipOption, GridComponentOption } from "echarts";

const baseTextStyle: TextStyleOption = {
    fontFamily: "Inter, system-ui, sans-serif",
    fontSize: 11,
    color: "#cbd5f5",
};

const baseGrid: GridComponentOption = {
    left: 50,
    right: 20,
    top: 30,
    bottom: 45,
    containLabel: true,
};

const baseAxis: AxisBaseOption = {
    axisLine: {
        lineStyle: { color: "rgba(148,163,184,0.35)" },
    },
    axisTick: { show: false },
    axisLabel: {
        color: "#cbd5f5",
        fontSize: 10,
        margin: 8,
    },
    splitLine: {
        lineStyle: { color: "rgba(148,163,184,0.12)" },
    },
};

const baseTooltip: TooltipOption = {
    backgroundColor: "rgba(15,23,42,0.95)",
    borderColor: "rgba(148,163,184,0.3)",
    textStyle: {
        color: "#e2e8f0",
        fontSize: 11,
    },
};

export { baseAxis, baseGrid, baseTextStyle, baseTooltip };
