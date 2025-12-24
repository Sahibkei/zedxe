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
    const filtered = result.values.filter((item) => typeof item?.value === "number" && typeof item?.region === "string");
    if (!filtered.length) return { values: [], error: "Geo data missing required fields" };
    return { values: filtered };
  };

  const parseSankey = (raw) => {
    const result = parseJson(raw);
    if (!result.values.length) return result;
    const filtered = result.values.filter((item) => typeof item?.value === "number" && typeof item?.source === "string" && typeof item?.target === "string");
    if (!filtered.length) return { values: [], error: "Sankey data missing required fields" };
    return { values: filtered };
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
      container.innerHTML = `<div class="empty">${message}</div>`;
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
      const bars = values
        .map((item) => {
          const height = Math.max(4, (item.value / maxValue) * 100);
          return `<div class="bar-group" title="${item.label}: ${item.value}">
            <div class="bar" style="height:${height}%"></div>
            <span class="label">${item.label}</span>
          </div>`;
        })
        .join("");
      container.innerHTML = `<div class="bars">${bars}</div>`;
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
      const list = values
        .map((item) => {
          const width = Math.max(6, (item.value / maxValue) * 100);
          return `<li class="geo-item">
            <div class="geo-head"><span>${item.region}</span><span class="geo-value">${item.value.toLocaleString?.() ?? item.value}</span></div>
            <div class="geo-bar-wrap"><div class="geo-bar" style="width:${width}%"></div></div>
          </li>`;
        })
        .join("");
      container.innerHTML = `<ul class="geo-list">${list}</ul>`;
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
      const flows = values
        .map((link) => {
          const width = Math.max(6, (link.value / maxValue) * 100);
          return `<div class="flow">
            <div class="flow-head"><span class="flow-source">${link.source}</span><span class="flow-target">→ ${link.target}</span></div>
            <div class="flow-bar-wrap"><div class="flow-bar" style="width:${width}%"></div></div>
            <span class="flow-value">${link.value.toLocaleString?.() ?? link.value}</span>
          </div>`;
        })
        .join("");
      container.innerHTML = `<div class="flow-grid">${flows}</div>`;
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
})();
