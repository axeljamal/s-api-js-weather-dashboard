// Floating panel that animates each API call made by script.js.
// script.js fires api:start, api:request, api:response and api:render events on document.
(function () {
  const panel = document.getElementById("api-flow");
  const toggle = document.getElementById("api-flow-toggle");
  const statusText = document.getElementById("api-flow-status");
  const appNode = document.getElementById("node-app");
  const log = document.getElementById("api-log");
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const TRAVEL = reducedMotion ? 0 : 700; // ms a packet takes to cross a wire
  const MAX_LOG = 6;
  const OPEN_KEY = "api-flow-open";

  let currentRun = 0;
  const lanes = {};
  document.querySelectorAll(".lane").forEach((el) => {
    const label = el.querySelector(".lane-label");
    lanes[el.dataset.step] = { el, label, text: label.textContent, sentAt: 0 };
  });

  // ---------- Open / close (remembered per browser) ----------
  let saved = null;
  try {
    saved = localStorage.getItem(OPEN_KEY);
  } catch {}
  setOpen(saved ? saved === "true" : window.innerWidth > 600);

  toggle.addEventListener("click", () => setOpen(panel.classList.contains("collapsed")));

  function setOpen(isOpen) {
    panel.classList.toggle("collapsed", !isOpen);
    toggle.setAttribute("aria-expanded", isOpen);
    try {
      localStorage.setItem(OPEN_KEY, isOpen);
    } catch {}
  }

  // keep the page content clear of the floating panel
  new ResizeObserver(() => {
    document.body.style.paddingBottom = `${panel.offsetHeight + 24}px`;
  }).observe(panel);

  // ---------- Events from script.js ----------
  document.addEventListener("api:start", (e) => {
    const { source, city, run } = e.detail;
    currentRun = run;
    Object.values(lanes).forEach(resetLane);
    appNode.classList.remove("rendering");
    if (source === "history") {
      lanes.geo.el.classList.add("skipped");
      lanes.geo.label.textContent = "Skipped: coordinates saved from an earlier search";
      statusText.textContent = `${city}: using saved coordinates`;
    } else {
      statusText.textContent = `Looking up "${city}"…`;
    }
  });

  document.addEventListener("api:request", (e) => {
    if (e.detail.run !== currentRun) return;
    const lane = lanes[e.detail.step];
    lane.sentAt = performance.now();
    lane.el.classList.remove("skipped", "done", "receiving", "error", "waiting");
    restartClass(lane.el, "sending");
    lane.label.textContent = `GET ${maskedQuery(e.detail.url)}`;
    // while the server is working, the wire shows a moving dash
    setTimeout(() => {
      if (lane.el.classList.contains("sending")) lane.el.classList.add("waiting");
    }, TRAVEL);
  });

  document.addEventListener("api:response", (e) => {
    const d = e.detail;
    // a reply to an older search: log it, but leave the diagram alone
    if (d.run !== currentRun) return addLog(d);
    const lane = lanes[d.step];
    // let the outgoing packet finish its trip before the reply comes back
    const wait = Math.max(0, lane.sentAt + TRAVEL - performance.now());
    setTimeout(() => {
      if (d.run !== currentRun) return addLog(d);
      lane.el.classList.remove("sending", "waiting");
      restartClass(lane.el, d.ok ? "receiving" : "error");
      if (d.ok) lane.el.classList.add("done");
      lane.label.textContent = d.ok
        ? `${d.status} OK · ${d.ms} ms · ${summary(d)}`
        : `${d.status ? `Error ${d.status}` : d.error} · ${d.ms} ms`;
      if (d.step === "geo" && d.ok && !(d.data && d.data.length)) {
        statusText.textContent = "No city found, so the weather calls are never made";
      } else if (!d.ok) {
        statusText.textContent = "A request failed";
      } else {
        statusText.textContent = d.step === "geo" ? "Got coordinates, now asking for the weather…" : "Waiting for replies…";
      }
      addLog(d);
    }, wait);
  });

  document.addEventListener("api:render", () => {
    setTimeout(() => {
      restartClass(appNode, "rendering");
      statusText.textContent = "Both replies in, page updated";
    }, TRAVEL * 2);
  });

  // ---------- Helpers ----------
  function resetLane(lane) {
    lane.el.classList.remove("sending", "waiting", "receiving", "error", "done", "skipped");
    lane.label.textContent = lane.text;
  }

  function restartClass(el, cls) {
    el.classList.remove(cls);
    void el.offsetWidth; // forces the CSS animation to play again
    el.classList.add(cls);
  }

  // hide the API key before showing a URL on screen
  function maskedQuery(url) {
    const u = new URL(url);
    u.searchParams.set("appid", "•••");
    return "?" + decodeURIComponent(u.searchParams.toString());
  }

  function maskedPath(url) {
    return new URL(url).pathname + maskedQuery(url);
  }

  // one-line summary of what came back
  function summary(d) {
    try {
      if (d.step === "geo") {
        const place = d.data[0];
        return place
          ? `${place.name}, ${place.country} → lat ${place.lat.toFixed(2)}, lon ${place.lon.toFixed(2)}`
          : "no match";
      }
      if (d.step === "weather") {
        return `${Math.round(d.data.main.temp)}°C, ${d.data.weather[0].description}`;
      }
      if (d.step === "forecast") {
        return `${d.data.list.length} three-hour slots`;
      }
    } catch {}
    return "";
  }

  function addLog(d) {
    const item = document.createElement("li");
    const status = document.createElement("span");
    status.className = `log-status ${d.ok ? "ok" : "bad"}`;
    status.textContent = d.status || "ERR";
    const url = document.createElement("code");
    url.className = "log-url";
    url.textContent = `GET ${maskedPath(d.url)}`;
    url.title = url.textContent;
    const meta = document.createElement("span");
    meta.className = "log-meta";
    meta.textContent = d.bytes ? `${d.ms} ms · ${(d.bytes / 1024).toFixed(1)} KB` : `${d.ms} ms`;
    item.append(status, url, meta);
    log.prepend(item);
    while (log.children.length > MAX_LOG) log.lastElementChild.remove();
  }
})();
