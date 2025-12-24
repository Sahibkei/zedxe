(() => {
  const styles = `
  :host {
    display: block;
    font-family: Inter, system-ui, -apple-system, "Segoe UI", sans-serif;
    color: #e5e7eb;
  }
  .card {
    border-radius: 16px;
    border: 1px solid rgba(255,255,255,0.08);
    background: radial-gradient(circle at 16% 12%, rgba(255,255,255,0.06), rgba(255,255,255,0.02)),
      linear-gradient(180deg, rgba(255,255,255,0.03), rgba(255,255,255,0.02));
    padding: 14px;
    min-height: 240px;
    box-sizing: border-box;
  }
  .empty {
    display: grid;
    place-items: center;
    width: 100%;
    height: 100%;
    color: rgba(255,255,255,0.65);
    text-align: center;
    font-size: 0.95rem;
  }
  .bars {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(48px, 1fr));
    gap: 10px;
    align-items: end;
    height: 100%;
  }
  .bar-group { display: grid; grid-template-rows: 1fr auto; gap: 6px; }
  .bar {
    background: linear-gradient(180deg, rgba(56, 189, 248, 0.4), rgba(56, 189, 248, 0.1));
    border: 1px solid rgba(56, 189, 248, 0.6);
    border-radius: 10px 10px 6px 6px;
    min-height: 4px;
    box-shadow: 0 10px 25px rgba(56, 189, 248, 0.15);
  }
  .bar-group .label { text-align: center; font-size: 0.75rem; color: rgba(255,255,255,0.8); }
  .axis { display:flex; justify-content:space-between; margin-top:10px; color: rgba(255,255,255,0.55); font-size:0.75rem; }
  .axis-label { display:inline-block; }
  .sr-only { position:absolute; width:1px; height:1px; padding:0; margin:-1px; overflow:hidden; clip:rect(0,0,0,0); white-space:nowrap; border:0; }
  .geo-list { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 10px; }
  .geo-item { display: flex; flex-direction: column; gap: 6px; }
  .geo-head { display: flex; justify-content: space-between; color: rgba(255,255,255,0.86); font-size: 0.9rem; }
  .geo-value { color: rgba(56,189,248,0.9); font-variant-numeric: tabular-nums; }
  .geo-bar-wrap { background: rgba(255,255,255,0.04); border-radius: 10px; overflow: hidden; border: 1px solid rgba(255,255,255,0.08); }
  .geo-bar { height: 8px; background: linear-gradient(90deg, rgba(16,185,129,0.7), rgba(56,189,248,0.6)); }
  .flow-grid { display: flex; flex-direction: column; gap: 10px; }
  .flow { background: rgba(255,255,255,0.04); border-radius: 12px; padding: 10px 12px; border: 1px solid rgba(255,255,255,0.08); box-shadow: 0 6px 18px rgba(0,0,0,0.2); }
  .flow-head { display: flex; justify-content: space-between; font-size: 0.9rem; color: rgba(255,255,255,0.85); margin-bottom: 6px; }
  .flow-source { color: rgba(56,189,248,0.9); }
  .flow-target { color: rgba(16,185,129,0.9); }
  .flow-bar-wrap { background: rgba(255,255,255,0.06); border-radius: 10px; overflow: hidden; border: 1px solid rgba(255,255,255,0.1); }
  .flow-bar { height: 10px; background: linear-gradient(90deg, rgba(59,130,246,0.8), rgba(16,185,129,0.7)); }
  .flow-value { margin-top: 6px; display: inline-block; color: rgba(255,255,255,0.7); font-variant-numeric: tabular-nums; font-size: 0.85rem; }
  `;

  const parseJson = (raw) => {
    if (!raw) return { values: [], error: "No data provided" };
    try {
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) {
        return { values: [], error: "Data must be an array" };
      }
      return { values: parsed };
    } catch (error) {
      return { values: [], error: error.message };
    }
  };

  const parseHistogram = (raw) => {
    const result = parseJson(raw);
    if (!result.values.length) return result;
    const filtered = result.values.filter((item) => typeof item?.value === "number" && !Number.isNaN(item.value) && typeof item?.label === "string");
    if (!filtered.length) return { values: [], error: "Histogram data missing numeric values" };
    return { values: filtered };
  };

  const parseGeo = (raw) => {
    const result = parseJson(raw);
    if (!result.values.length) return result;
    const filtered = result.values.filter((item) => typeof item?.value === "number" && !Number.isNaN(item.value) && typeof item?.region === "string");
    if (!filtered.length) return { values: [], error: "Geo data missing required fields" };
    return { values: filtered };
  };

  const parseSankey = (raw) => {
    const result = parseJson(raw);
    if (!result.values.length) return result;
    const filtered = result.values.filter((item) => typeof item?.value === "number" && !Number.isNaN(item.value) && typeof item?.source === "string" && typeof item?.target === "string");
    if (!filtered.length) return { values: [], error: "Sankey data missing required fields" };
    return { values: filtered };
  };

  const parseRevenue = (raw) => {
    if (!raw) return null;
    try {
      const payload = JSON.parse(raw);
      if (!payload?.series || !Array.isArray(payload.series)) return null;
      const series = payload.series.filter((item) => typeof item?.date === "string" && typeof item?.revenue === "number" && !Number.isNaN(item.revenue));
      return { ...payload, view: payload.view === "yoy" ? "yoy" : "values", series };
    } catch {
      return null;
    }
  };

  const parseProfitability = (raw) => {
    if (!raw) return null;
    try {
      const payload = JSON.parse(raw);
      if (!payload?.series || !Array.isArray(payload.series)) return null;
      const series = payload.series
        .filter((item) => typeof item?.date === "string")
        .map((item) => ({
          date: item.date,
          ebitda: typeof item.ebitda === "number" && !Number.isNaN(item.ebitda) ? item.ebitda : undefined,
          netIncome: typeof item.netIncome === "number" && !Number.isNaN(item.netIncome) ? item.netIncome : undefined
        }));
      return { ...payload, series };
    } catch {
      return null;
    }
  };

  class BaseChart extends HTMLElement {
    static get observedAttributes() { return ["data"]; }
    constructor() {
      super();
      this.attachShadow({ mode: "open" });
    }
    connectedCallback() {
      this.render();
    }
    attributeChangedCallback() {
      this.render();
    }
    render() {}
    mountBase() {
      if (!this.shadowRoot) return null;
      this.shadowRoot.innerHTML = `<style>${styles}</style><div class="card"></div>`;
      return this.shadowRoot.querySelector(".card");
    }
    showEmpty(container, message = "No data") {
      if (!container) return;
      container.textContent = "";
      const empty = document.createElement("div");
      empty.className = "empty";
      empty.textContent = message;
      container.appendChild(empty);
    }
  }

  class HistogramElement extends BaseChart {
    render() {
      const container = this.mountBase();
      if (!container) return;
      const { values, error } = parseHistogram(this.getAttribute("data"));
      if (error || !values.length) {
        this.showEmpty(container, "No data");
        return;
      }
      const maxValue = values.reduce((acc, item) => Math.max(acc, item.value || 0), 0) || 1;
      container.textContent = "";
      const bars = document.createElement("div");
      bars.className = "bars";
      const frag = document.createDocumentFragment();
      values.forEach((item) => {
        const group = document.createElement("div");
        group.className = "bar-group";
        group.setAttribute("title", `${item.label}: ${item.value}`);

        const bar = document.createElement("div");
        bar.className = "bar";
        bar.style.height = `${Math.max(4, (item.value / maxValue) * 100)}%`;
        const sr = document.createElement("span");
        sr.className = "sr-only";
        sr.textContent = `${item.label}: ${item.value}`;
        bar.appendChild(sr);

        const label = document.createElement("span");
        label.className = "label";
        label.textContent = item.label;

        group.append(bar, label);
        frag.appendChild(group);
      });
      bars.appendChild(frag);

      const axis = document.createElement("div");
      axis.className = "axis";
      const left = document.createElement("span");
      left.className = "axis-label";
      left.textContent = "Period";
      const right = document.createElement("span");
      right.className = "axis-label";
      right.textContent = "Change (%)";
      axis.append(left, right);

      container.append(bars, axis);
    }
  }

  class GeoElement extends BaseChart {
    render() {
      const container = this.mountBase();
      if (!container) return;
      const { values, error } = parseGeo(this.getAttribute("data"));
      if (error || !values.length) {
        this.showEmpty(container, "No data");
        return;
      }
      const maxValue = values.reduce((acc, item) => Math.max(acc, item.value || 0), 0) || 1;
      container.textContent = "";
      const listEl = document.createElement("ul");
      listEl.className = "geo-list";
      const frag = document.createDocumentFragment();
      values.forEach((item) => {
        const li = document.createElement("li");
        li.className = "geo-item";

        const head = document.createElement("div");
        head.className = "geo-head";
        const region = document.createElement("span");
        region.textContent = item.region;
        const value = document.createElement("span");
        value.className = "geo-value";
        value.textContent = (item.value ?? 0).toLocaleString();
        head.append(region, value);

        const wrap = document.createElement("div");
        wrap.className = "geo-bar-wrap";
        const bar = document.createElement("div");
        bar.className = "geo-bar";
        bar.style.width = `${Math.max(6, (item.value / maxValue) * 100)}%`;
        wrap.appendChild(bar);

        li.append(head, wrap);
        frag.appendChild(li);
      });
      listEl.appendChild(frag);
      container.appendChild(listEl);
    }
  }

  class SankeyElement extends BaseChart {
    render() {
      const container = this.mountBase();
      if (!container) return;
      const { values, error } = parseSankey(this.getAttribute("data"));
      if (error || !values.length) {
        this.showEmpty(container, "No data");
        return;
      }
      const maxValue = values.reduce((acc, item) => Math.max(acc, item.value || 0), 0) || 1;
      container.textContent = "";
      const grid = document.createElement("div");
      grid.className = "flow-grid";
      const frag = document.createDocumentFragment();
      values.forEach((link) => {
        const flow = document.createElement("div");
        flow.className = "flow";

        const head = document.createElement("div");
        head.className = "flow-head";
        const source = document.createElement("span");
        source.className = "flow-source";
        source.textContent = link.source;
        const target = document.createElement("span");
        target.className = "flow-target";
        target.textContent = `→ ${link.target}`;
        head.append(source, target);

        const wrap = document.createElement("div");
        wrap.className = "flow-bar-wrap";
        const bar = document.createElement("div");
        bar.className = "flow-bar";
        bar.style.width = `${Math.max(6, (link.value / maxValue) * 100)}%`;
        wrap.appendChild(bar);

        const value = document.createElement("span");
        value.className = "flow-value";
        value.textContent = (link.value ?? 0).toLocaleString();

        flow.append(head, wrap, value);
        frag.appendChild(flow);
      });
      grid.appendChild(frag);
      container.appendChild(grid);
    }
  }

  class RevenueGrowthElement extends BaseChart {
    computeYoy(series) {
      const sorted = [...series].sort((a, b) => a.date.localeCompare(b.date));
      return sorted.map((point, idx) => {
        if (idx === 0) return { ...point, change: 0 };
        const prev = sorted[idx - 1];
        const change = prev.revenue ? ((point.revenue - prev.revenue) / prev.revenue) * 100 : 0;
        return { ...point, change };
      });
    }

    formatNumber(value, currency) {
      if (typeof value !== "number" || Number.isNaN(value)) return "—";
      const short = value >= 1e9 ? `${(value / 1e9).toFixed(1)}B` : value >= 1e6 ? `${(value / 1e6).toFixed(1)}M` : value.toLocaleString();
      return currency ? `${currency} ${short}` : short;
    }

    render() {
      const container = this.mountBase();
      if (!container) return;
      const payload = parseRevenue(this.getAttribute("data"));
      if (!payload || !payload.series.length) {
        this.showEmpty(container, "No data");
        return;
      }
      const view = payload.view === "yoy" ? "yoy" : "values";
      const series = payload.series;
      const yoySeries = this.computeYoy(series);
      container.textContent = "";

      const chart = document.createElement("div");
      chart.className = "chart";

      const bars = document.createElement("div");
      bars.className = "bars";
      const frag = document.createDocumentFragment();

      const maxRevenue = Math.max(...series.map((p) => p.revenue || 0), 1);
      const maxChange = Math.max(...yoySeries.map((p) => Math.abs(p.change || 0)), 1);

      (view === "yoy" ? yoySeries : series).forEach((point) => {
        const bar = document.createElement("div");
        const value = view === "yoy" ? Math.max(4, ((Math.abs(point.change || 0)) / maxChange) * 100) : Math.max(4, ((point.revenue || 0) / maxRevenue) * 100);
        bar.className = "bar";
        if (view === "yoy" && (point.change || 0) < 0) bar.classList.add("negative");
        bar.style.height = view === "yoy" ? `${Math.min(100, value)}%` : `${Math.min(100, value)}%`;
        bar.addEventListener("mouseenter", () => {
          tooltipLabel.textContent = point.date;
          tooltipValue.textContent =
            view === "yoy"
              ? `${(point.change || 0).toFixed(2)}% YoY`
              : this.formatNumber(point.revenue || 0, payload.currency);
          bar.classList.add("active");
        });
        bar.addEventListener("mouseleave", () => {
          tooltipLabel.textContent = "";
          tooltipValue.textContent = "";
          bar.classList.remove("active");
        });
        const sr = document.createElement("span");
        sr.className = "sr-only";
        sr.textContent =
          view === "yoy"
            ? `${point.date}: ${(point.change || 0).toFixed(2)}%`
            : `${point.date}: ${this.formatNumber(point.revenue || 0, payload.currency)}`;
        bar.appendChild(sr);
        frag.appendChild(bar);
      });
      bars.appendChild(frag);

      const tooltip = document.createElement("div");
      tooltip.className = "tooltip";
      const tooltipLabel = document.createElement("p");
      tooltipLabel.className = "tooltip-label";
      const tooltipValue = document.createElement("p");
      tooltipValue.className = "tooltip-value";
      tooltip.append(tooltipLabel, tooltipValue);

      const legend = document.createElement("div");
      legend.className = "legend";
      const dot = document.createElement("span");
      dot.className = "dot";
      const legendText = document.createElement("span");
      legendText.className = "legend-text";
      legendText.textContent = view === "yoy" ? "YoY %" : `Revenue (${payload.currency || ""})`;
      legend.append(dot, legendText);

      chart.append(bars, tooltip, legend);
      container.appendChild(chart);
    }
  }

  class ProfitabilityElement extends BaseChart {
    formatNumber(value, currency) {
      if (typeof value !== "number" || Number.isNaN(value)) return "—";
      const short = value >= 1e9 ? `${(value / 1e9).toFixed(1)}B` : value >= 1e6 ? `${(value / 1e6).toFixed(1)}M` : value.toLocaleString();
      return currency ? `${currency} ${short}` : short;
    }

    render() {
      const container = this.mountBase();
      if (!container) return;
      if (this.showEbitda === undefined) this.showEbitda = true;
      if (this.showNetIncome === undefined) this.showNetIncome = true;
      const payload = parseProfitability(this.getAttribute("data"));
      if (!payload || !payload.series.length) {
        this.showEmpty(container, "No data");
        return;
      }
      container.textContent = "";

      const chart = document.createElement("div");
      chart.className = "chart";

      const legend = document.createElement("div");
      legend.className = "legend";

      const ebitdaBtn = document.createElement("button");
      ebitdaBtn.type = "button";
      ebitdaBtn.className = `legend-btn ${this.showEbitda ? "active" : ""}`;
      const eDot = document.createElement("span");
      eDot.className = "dot ebitda";
      ebitdaBtn.append(eDot, document.createTextNode("EBITDA"));
      ebitdaBtn.addEventListener("click", () => {
        this.showEbitda = !this.showEbitda;
        this.render();
      });

      const netBtn = document.createElement("button");
      netBtn.type = "button";
      netBtn.className = `legend-btn ${this.showNetIncome ? "active" : ""}`;
      const nDot = document.createElement("span");
      nDot.className = "dot net";
      netBtn.append(nDot, document.createTextNode("Net Income"));
      netBtn.addEventListener("click", () => {
        this.showNetIncome = !this.showNetIncome;
        this.render();
      });

      legend.append(ebitdaBtn, netBtn);

      const grid = document.createElement("div");
      grid.className = "grid";
      const frag = document.createDocumentFragment();
      const maxValue = Math.max(...payload.series.map((p) => Math.max(p.ebitda || 0, p.netIncome || 0, 1)));

      const tooltip = document.createElement("div");
      tooltip.className = "tooltip";
      const tooltipLabel = document.createElement("p");
      tooltipLabel.className = "tooltip-label";
      const tooltipValues = document.createElement("div");
      tooltip.append(tooltipLabel, tooltipValues);

      payload.series.forEach((point) => {
        const column = document.createElement("div");
        column.className = "column";
        column.addEventListener("mouseenter", () => {
          tooltipLabel.textContent = point.date;
          tooltipValues.textContent = "";
          if (this.showEbitda) {
            const line = document.createElement("p");
            line.className = "tooltip-value";
            line.textContent = `EBITDA: ${this.formatNumber(point.ebitda, payload.currency)}`;
            tooltipValues.appendChild(line);
          }
          if (this.showNetIncome) {
            const line = document.createElement("p");
            line.className = "tooltip-value";
            line.textContent = `Net Income: ${this.formatNumber(point.netIncome, payload.currency)}`;
            tooltipValues.appendChild(line);
          }
        });
        column.addEventListener("mouseleave", () => {
          tooltipLabel.textContent = "";
          tooltipValues.textContent = "";
        });

        const stack = document.createElement("div");
        stack.className = "stack";
        if (this.showEbitda && point.ebitda) {
          const bar = document.createElement("div");
          bar.className = "bar ebitda";
          bar.style.height = `${Math.max(6, (point.ebitda / maxValue) * 100)}%`;
          const sr = document.createElement("span");
          sr.className = "sr-only";
          sr.textContent = `${point.date}: EBITDA ${this.formatNumber(point.ebitda, payload.currency)}`;
          bar.appendChild(sr);
          stack.appendChild(bar);
        }
        if (this.showNetIncome && point.netIncome) {
          const bar = document.createElement("div");
          bar.className = "bar net";
          bar.style.height = `${Math.max(6, (point.netIncome / maxValue) * 100)}%`;
          const sr = document.createElement("span");
          sr.className = "sr-only";
          sr.textContent = `${point.date}: Net Income ${this.formatNumber(point.netIncome, payload.currency)}`;
          bar.appendChild(sr);
          stack.appendChild(bar);
        }

        const label = document.createElement("span");
        label.className = "label";
        label.textContent = point.date;

        column.append(stack, label);
        frag.appendChild(column);
      });

      grid.appendChild(frag);
      chart.append(legend, grid, tooltip);
      container.appendChild(chart);
    }
  }

  if (!customElements.get("zedxe-histogram")) {
    customElements.define("zedxe-histogram", HistogramElement);
  }
  if (!customElements.get("zedxe-geo-map")) {
    customElements.define("zedxe-geo-map", GeoElement);
  }
  if (!customElements.get("zedxe-sankey")) {
    customElements.define("zedxe-sankey", SankeyElement);
  }
  if (!customElements.get("zedxe-revenue-growth")) {
    customElements.define("zedxe-revenue-growth", RevenueGrowthElement);
  }
  if (!customElements.get("zedxe-profitability")) {
    customElements.define("zedxe-profitability", ProfitabilityElement);
  }
})();
