"use client";

import type { ComponentType } from "react";
import dynamic from "next/dynamic";
import type { PlotParams } from "react-plotly.js";

const Plot = dynamic(() => import("react-plotly.js"), {
    ssr: false,
}) as ComponentType<PlotParams>;

type SurfaceData = {
    x: number[];
    y: number[];
    z: number[][];
};

type VolMomoSurface3DProps = {
    data: SurfaceData | null;
};

export default function VolMomoSurface3D({ data }: VolMomoSurface3DProps) {
    if (!data) {
        return (
            <div className="flex h-[380px] w-full items-center justify-center rounded-2xl border border-white/10 bg-white/[0.02] text-sm text-slate-400">
                No 3D surface data available.
            </div>
        );
    }

    return (
        <div className="h-[380px] w-full rounded-2xl border border-white/10 bg-[#0b0f14] p-3 shadow-2xl shadow-black/40">
            <Plot
                data={[
                    {
                        type: "surface",
                        x: data.x,
                        y: data.y,
                        z: data.z,
                        colorscale: "Viridis",
                        showscale: false,
                    },
                ]}
                layout={{
                    autosize: true,
                    margin: { l: 0, r: 0, t: 0, b: 0 },
                    paper_bgcolor: "rgba(0,0,0,0)",
                    plot_bgcolor: "rgba(0,0,0,0)",
                    scene: {
                        xaxis: {
                            title: "z-momentum",
                            color: "#cbd5f5",
                            gridcolor: "rgba(255,255,255,0.08)",
                        },
                        yaxis: {
                            title: "z-volatility",
                            color: "#cbd5f5",
                            gridcolor: "rgba(255,255,255,0.08)",
                        },
                        zaxis: {
                            title: "Win prob",
                            color: "#cbd5f5",
                            gridcolor: "rgba(255,255,255,0.08)",
                        },
                    },
                }}
                config={{ responsive: true, displayModeBar: false }}
                style={{ width: "100%", height: "100%" }}
                useResizeHandler
            />
        </div>
    );
}
