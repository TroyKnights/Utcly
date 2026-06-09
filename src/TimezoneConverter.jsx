import React, { useState, useEffect, useMemo, useRef } from "react";

// Top 25 cities by IANA timezone — chosen for global coverage + recognizability
const CITIES = [
  { city: "London", tz: "Europe/London", country: "UK" },
  { city: "New York", tz: "America/New_York", country: "USA" },
  { city: "Los Angeles", tz: "America/Los_Angeles", country: "USA" },
  { city: "Chicago", tz: "America/Chicago", country: "USA" },
  { city: "Toronto", tz: "America/Toronto", country: "Canada" },
  { city: "São Paulo", tz: "America/Sao_Paulo", country: "Brazil" },
  { city: "Mexico City", tz: "America/Mexico_City", country: "Mexico" },
  { city: "Paris", tz: "Europe/Paris", country: "France" },
  { city: "Berlin", tz: "Europe/Berlin", country: "Germany" },
  { city: "Madrid", tz: "Europe/Madrid", country: "Spain" },
  { city: "Amsterdam", tz: "Europe/Amsterdam", country: "Netherlands" },
  { city: "Moscow", tz: "Europe/Moscow", country: "Russia" },
  { city: "Istanbul", tz: "Europe/Istanbul", country: "Turkey" },
  { city: "Dubai", tz: "Asia/Dubai", country: "UAE" },
  { city: "Mumbai", tz: "Asia/Kolkata", country: "India" },
  { city: "Bangkok", tz: "Asia/Bangkok", country: "Thailand" },
  { city: "Singapore", tz: "Asia/Singapore", country: "Singapore" },
  { city: "Hong Kong", tz: "Asia/Hong_Kong", country: "Hong Kong" },
  { city: "Shanghai", tz: "Asia/Shanghai", country: "China" },
  { city: "Tokyo", tz: "Asia/Tokyo", country: "Japan" },
  { city: "Seoul", tz: "Asia/Seoul", country: "S. Korea" },
  { city: "Sydney", tz: "Australia/Sydney", country: "Australia" },
  { city: "Auckland", tz: "Pacific/Auckland", country: "NZ" },
  { city: "Cairo", tz: "Africa/Cairo", country: "Egypt" },
  { city: "Johannesburg", tz: "Africa/Johannesburg", country: "S. Africa" },
  { city: "Lagos", tz: "Africa/Lagos", country: "Nigeria" },
  { city: "Karachi", tz: "Asia/Karachi", country: "Pakistan" },
  { city: "Manila", tz: "Asia/Manila", country: "Philippines" },
  { city: "Kuala Lumpur", tz: "Asia/Kuala_Lumpur", country: "Malaysia" },
  { city: "Buenos Aires", tz: "America/Argentina/Buenos_Aires", country: "Argentina" },
];


// Shared card styling — used by every major section
const CARD_CLASS =
  "rounded-3xl border border-white/10 bg-white/[0.04] backdrop-blur-2xl p-4 sm:p-8 animate-[fadeIn_0.4s_ease-out]";

// ═══════════════════════════════════════════════════════════════════
// TIME & TIMEZONE HELPERS
// ═══════════════════════════════════════════════════════════════════


// Returns the wall-clock parts of a Date in a given IANA timezone.
function getZonedParts(date, tz) {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
    weekday: "short",
  });
  const parts = fmt.formatToParts(date).reduce((acc, p) => {
    if (p.type !== "literal") acc[p.type] = p.value;
    return acc;
  }, {});
  // hour24 fix: Intl can output "24" at midnight
  if (parts.hour === "24") parts.hour = "00";
  return parts;
}

// UTC offset in minutes for a given IANA timezone at a given instant.
function getOffsetMinutes(date, tz) {
  const parts = getZonedParts(date, tz);
  const asUTC = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour),
    Number(parts.minute),
    Number(parts.second)
  );
  return Math.round((asUTC - date.getTime()) / 60000);
}

// Build a UTC Date that represents a wall-clock time in a given timezone.
function zonedTimeToUTC(year, month, day, hour, minute, tz) {
  // Approximate: treat the wall time as UTC, then correct by offset.
  const guess = new Date(Date.UTC(year, month - 1, day, hour, minute, 0));
  const offset = getOffsetMinutes(guess, tz);
  return new Date(guess.getTime() - offset * 60000);
}

function formatOffset(mins) {
  const sign = mins >= 0 ? "+" : "-";
  const abs = Math.abs(mins);
  const h = String(Math.floor(abs / 60)).padStart(2, "0");
  const m = String(abs % 60).padStart(2, "0");
  return `UTC${sign}${h}:${m}`;
}

function pad(n) {
  return String(n).padStart(2, "0");
}


// ═══════════════════════════════════════════════════════════════════
// DOCUMENT-PASTE CONVERSION (regex + abbreviation map)
// ═══════════════════════════════════════════════════════════════════

// Maps common timezone abbreviations and names to UTC offset in hours.
// Handles both standard and daylight variants. Order matters for matching.
const TZ_ABBREVIATIONS = {
  // North America
  EST: -5, EDT: -4, ET: -5, "EASTERN TIME": -5, EASTERN: -5,
  CST: -6, CDT: -5, CT: -6, "CENTRAL TIME": -6, CENTRAL: -6,
  MST: -7, MDT: -6, MT: -7, "MOUNTAIN TIME": -7, MOUNTAIN: -7,
  PST: -8, PDT: -7, PT: -8, "PACIFIC TIME": -8, PACIFIC: -8,
  AKST: -9, AKDT: -8, ALASKA: -9,
  HST: -10, HAWAII: -10,
  AST: -4, ADT: -3, ATLANTIC: -4,
  NST: -3.5, NDT: -2.5, NEWFOUNDLAND: -3.5,
  // Europe
  GMT: 0, UTC: 0, Z: 0, ZULU: 0,
  BST: 1, "BRITISH SUMMER TIME": 1,
  WET: 0, WEST: 1,
  CET: 1, CEST: 2, "CENTRAL EUROPEAN": 1,
  EET: 2, EEST: 3, "EASTERN EUROPEAN": 2,
  MSK: 3, MOSCOW: 3,
  // Asia
  IST: 5.5, "INDIA STANDARD TIME": 5.5, INDIA: 5.5,
  PKT: 5, PAKISTAN: 5,
  ICT: 7, "INDOCHINA TIME": 7,
  SGT: 8, SINGAPORE: 8,
  HKT: 8, "HONG KONG": 8,
  CST_CHINA: 8, // disambiguated below
  JST: 9, JAPAN: 9, TOKYO: 9,
  KST: 9, KOREA: 9,
  // Oceania
  AEST: 10, AEDT: 11, "EASTERN AUSTRALIA": 10,
  ACST: 9.5, ACDT: 10.5,
  AWST: 8, "WESTERN AUSTRALIA": 8,
  NZST: 12, NZDT: 13, "NEW ZEALAND": 12,
  // Africa & Middle East
  SAST: 2, "SOUTH AFRICA": 2,
  EAT: 3, "EAST AFRICA": 3,
  GST: 4, "GULF STANDARD": 4, DUBAI: 4,
  IRST: 3.5, IRAN: 3.5,
  // South America
  BRT: -3, BRAZIL: -3, "BRASILIA": -3,
  ART: -3, ARGENTINA: -3,
  CLT: -4, CHILE: -4,
};

// Regex that finds time expressions like "9am EST", "2:30 PM PST", "14:00 GMT"
// Captures: full match, hour, minute (optional), am/pm (optional), timezone
const TIME_REGEX = new RegExp(
  // Time portion: "9", "9:30", "09:30"
  '\\b(\\d{1,2})(?::(\\d{2}))?\\s*' +
  // Optional am/pm
  '(am|pm|AM|PM|a\\.m\\.|p\\.m\\.|A\\.M\\.|P\\.M\\.)?\\s*' +
  // Required timezone abbreviation (3-5 letters, or known longer names)
  '(EST|EDT|CST|CDT|MST|MDT|PST|PDT|AKST|AKDT|HST|AST|ADT|NST|NDT|' +
  'ET|CT|MT|PT|' +
  'GMT|UTC|BST|WET|WEST|CET|CEST|EET|EEST|MSK|' +
  'IST|PKT|ICT|SGT|HKT|JST|KST|' +
  'AEST|AEDT|ACST|ACDT|AWST|NZST|NZDT|' +
  'SAST|EAT|GST|IRST|BRT|ART|CLT|Z)\\b',
  'g'
);

// Convert one matched time expression to UTC. Returns "HH:MM UTC" string or null on failure.
function convertMatchToUTC(hourStr, minStr, ampm, tz) {
  let hour = parseInt(hourStr, 10);
  const minute = minStr ? parseInt(minStr, 10) : 0;
  if (isNaN(hour) || hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;

  // Handle am/pm
  if (ampm) {
    const isPM = /p/i.test(ampm);
    if (isPM && hour < 12) hour += 12;
    if (!isPM && hour === 12) hour = 0;
  }

  const offset = TZ_ABBREVIATIONS[tz.toUpperCase()];
  if (offset === undefined) return null;

  // Convert local time to UTC by subtracting offset
  const totalMinutes = hour * 60 + minute - offset * 60;
  const wrapped = ((totalMinutes % 1440) + 1440) % 1440;
  const utcHour = Math.floor(wrapped / 60);
  const utcMin = Math.round(wrapped % 60);
  return `${pad(utcHour)}:${pad(utcMin)} UTC`;
}

// Run regex over text, replace each matched time expression with UTC equivalent.
// Returns { converted: string, count: number, matches: array }
function convertDocumentTimes(text) {
  const matches = [];
  const converted = text.replace(TIME_REGEX, (full, hour, min, ampm, tz) => {
    const utc = convertMatchToUTC(hour, min, ampm, tz);
    if (!utc) return full;
    matches.push({ original: full.trim(), utc });
    return utc;
  });
  return { converted, count: matches.length, matches };
}


// ═══════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════


export default function TimezoneConverter() {
  const userTZ = useMemo(
    () => Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
    []
  );

  const [now, setNow] = useState(() => new Date());
  const [tab, setTab] = useState("convert"); // "convert" | "meeting"
  const [toast, setToast] = useState(null);
  const toastTimer = useRef(null);

  // Theme + layout preferences (persisted in localStorage)
  const [theme, setTheme] = useState(() => {
    if (typeof window === "undefined") return "dark";
    return localStorage.getItem("utcly:theme") || "dark";
  });
  const [layout, setLayout] = useState(() => {
    if (typeof window === "undefined") return "stack";
    return localStorage.getItem("utcly:layout") || "stack";
  });

  useEffect(() => {
    try { localStorage.setItem("utcly:theme", theme); } catch {}
  }, [theme]);
  useEffect(() => {
    try { localStorage.setItem("utcly:layout", layout); } catch {}
  }, [layout]);

  const isLight = theme === "light";
  const isBento = layout === "bento";

  // Live clock tick
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  // Toast helper
  const showToast = (msg) => {
    setToast(msg);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2500);
  };

  const copyToClipboard = async (text, label = "Copied") => {
    try {
      await navigator.clipboard.writeText(text);
      showToast(`${label} · ${text}`);
    } catch {
      showToast("Copy failed");
    }
  };

  // --- Live clock data ---
  const userParts = getZonedParts(now, userTZ);
  const utcParts = getZonedParts(now, "UTC");
  const userOffset = getOffsetMinutes(now, userTZ);

  // --- Manual conversion state ---
  const today = userParts.year + "-" + userParts.month + "-" + userParts.day;
  const [convDate, setConvDate] = useState(today);
  const [convTime, setConvTime] = useState("12:00");
  const [convZone, setConvZone] = useState(userTZ);
  const [zoneQuery, setZoneQuery] = useState("");
  const [zoneOpen, setZoneOpen] = useState(false);

  const filteredZones = useMemo(() => {
    const q = zoneQuery.trim().toLowerCase();
    if (!q) return CITIES;
    return CITIES.filter(
      (c) =>
        c.city.toLowerCase().includes(q) ||
        c.country.toLowerCase().includes(q) ||
        c.tz.toLowerCase().includes(q)
    );
  }, [zoneQuery]);

  // Pre-compute offsets for all cities once per minute (offsets don't change
  // within a minute, and recomputing 30 cities every second is wasteful).
  const cityOffsets = useMemo(() => {
    const map = {};
    for (const c of CITIES) {
      map[c.tz] = getOffsetMinutes(now, c.tz);
    }
    return map;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [Math.floor(now.getTime() / 60000)]);

  const conversion = useMemo(() => {
    if (!convDate || !convTime) return null;
    const [y, mo, d] = convDate.split("-").map(Number);
    const [h, mi] = convTime.split(":").map(Number);
    if ([y, mo, d, h, mi].some(Number.isNaN)) return null;
    const utc = zonedTimeToUTC(y, mo, d, h, mi, convZone);
    const utcP = getZonedParts(utc, "UTC");
    const offset = getOffsetMinutes(utc, convZone);
    const iso = utc.toISOString();
    return {
      utc,
      utcDisplay: `${utcP.year}-${utcP.month}-${utcP.day} ${utcP.hour}:${utcP.minute}`,
      offset,
      iso,
    };
  }, [convDate, convTime, convZone]);

  // --- Meeting planner state ---
  const [meetDate, setMeetDate] = useState(today);
  const [meetTime, setMeetTime] = useState("09:00");
  const [meetDur, setMeetDur] = useState(60);
  const [meetZone, setMeetZone] = useState(
    userTZ === "America/New_York" ? "Europe/London" : "America/New_York"
  );

  const meeting = useMemo(() => {
    if (!meetDate || !meetTime) return null;
    const [y, mo, d] = meetDate.split("-").map(Number);
    const [h, mi] = meetTime.split(":").map(Number);
    if ([y, mo, d, h, mi].some(Number.isNaN)) return null;

    // Start instant: user enters time in their own zone
    const startUTC = zonedTimeToUTC(y, mo, d, h, mi, userTZ);
    const endUTC = new Date(startUTC.getTime() + meetDur * 60000);

    const fmt = (date, tz) => {
      const p = getZonedParts(date, tz);
      return {
        date: `${p.year}-${p.month}-${p.day}`,
        time: `${p.hour}:${p.minute}`,
        weekday: p.weekday,
        hour: Number(p.hour),
        minute: Number(p.minute),
      };
    };

    const userStart = fmt(startUTC, userTZ);
    const userEnd = fmt(endUTC, userTZ);
    const targetStart = fmt(startUTC, meetZone);
    const targetEnd = fmt(endUTC, meetZone);
    const utcStart = fmt(startUTC, "UTC");
    const utcEnd = fmt(endUTC, "UTC");

    // Business hours overlap (9–17 in target zone), in minutes
    const overlapMinutes = (() => {
      const tStartMin = targetStart.hour * 60 + targetStart.minute;
      const tEndMin = tStartMin + meetDur;
      const bizStart = 9 * 60;
      const bizEnd = 17 * 60;
      const overlap = Math.max(
        0,
        Math.min(tEndMin, bizEnd) - Math.max(tStartMin, bizStart)
      );
      return overlap;
    })();
    const overlapPct = Math.round((overlapMinutes / meetDur) * 100);

    return {
      userStart,
      userEnd,
      targetStart,
      targetEnd,
      utcStart,
      utcEnd,
      overlapMinutes,
      overlapPct,
      startUTC,
      endUTC,
    };
  }, [meetDate, meetTime, meetDur, meetZone, userTZ]);

  const formatDur = (mins) => {
    if (mins < 60) return `${mins} min`;
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return m === 0 ? `${h} hr` : `${h}h ${m}m`;
  };

  const selectedZoneLabel = useMemo(() => {
    const found = CITIES.find((c) => c.tz === convZone);
    return found ? `${found.city}, ${found.country}` : convZone;
  }, [convZone]);

  return (
    <div
      data-theme={theme}
      data-layout={layout}
      className={`min-h-screen w-full max-w-full font-sans relative overflow-x-hidden overflow-y-auto transition-colors duration-300 ${
        isLight ? "text-slate-900 bg-slate-50" : "text-slate-100 bg-slate-950"
      }`}
    >
      {/* Atmospheric background — adapts to theme */}
      <div className="absolute inset-0 -z-10">
        {isLight ? (
          <>
            <div className="absolute inset-0 bg-gradient-to-br from-slate-100 via-indigo-50 to-fuchsia-50" />
            <div className="absolute top-[-20%] left-[-10%] w-[60vw] h-[60vw] rounded-full bg-indigo-300/40 blur-[120px]" />
            <div className="absolute bottom-[-20%] right-[-10%] w-[60vw] h-[60vw] rounded-full bg-fuchsia-300/30 blur-[120px]" />
            <div className="absolute top-[30%] right-[20%] w-[40vw] h-[40vw] rounded-full bg-cyan-200/40 blur-[140px]" />
          </>
        ) : (
          <>
            <div className="absolute inset-0 bg-gradient-to-br from-[#0a0a1f] via-[#11102a] to-[#1a0f2e]" />
            <div className="absolute top-[-20%] left-[-10%] w-[60vw] h-[60vw] rounded-full bg-indigo-600/30 blur-[120px]" />
            <div className="absolute bottom-[-20%] right-[-10%] w-[60vw] h-[60vw] rounded-full bg-fuchsia-600/20 blur-[120px]" />
            <div className="absolute top-[30%] right-[20%] w-[40vw] h-[40vw] rounded-full bg-cyan-500/10 blur-[140px]" />
          </>
        )}
      </div>

      <div className={`mx-auto px-3 sm:px-6 py-8 sm:py-14 ${isBento ? "max-w-7xl" : "max-w-5xl"}`}>
        {/* Header + toolbar */}
        <header className="mb-8 sm:mb-10 flex items-start justify-between gap-4 flex-wrap">
          <div className="font-mono min-w-0">
            <div className={`flex items-center gap-2 text-xs sm:text-sm mb-1 ${isLight ? "text-slate-600" : "text-slate-400"}`}>
              <span className={isLight ? "text-emerald-600" : "text-emerald-400"}>user@utcly</span>
              <span className={isLight ? "text-slate-400" : "text-slate-500"}>:</span>
              <span className={isLight ? "text-indigo-600" : "text-indigo-300"}>~</span>
              <span className={isLight ? "text-slate-400" : "text-slate-500"}>$</span>
              <span className={isLight ? "text-slate-700" : "text-slate-300"}>date -u</span>
              <span
                className={`ml-1 inline-block w-2 h-4 animate-pulse ${isLight ? "bg-slate-700" : "bg-slate-300"}`}
                aria-hidden="true"
              />
            </div>
            <h1 className={`text-3xl sm:text-5xl font-mono font-medium tracking-tight ${isLight ? "text-slate-900" : "text-slate-100"}`}>
              <span className={isLight ? "text-slate-400" : "text-slate-500"}>/</span>
              utcly
              <span className={isLight ? "text-slate-400" : "text-slate-500"}>/</span>
            </h1>
            <p className={`text-xs sm:text-sm mt-2 font-mono ${isLight ? "text-slate-600" : "text-slate-400"}`}>
              # convert any zone to utc · plan meetings across zones
            </p>
          </div>

          {/* Toolbar: theme + layout toggles */}
          <Toolbar
            theme={theme}
            setTheme={setTheme}
            layout={layout}
            setLayout={setLayout}
          />
        </header>

        {/* Main content — wrapped in a bento grid when layout="bento" */}
        <div className={isBento ? "grid grid-cols-1 lg:grid-cols-12 gap-4" : ""}>

        {/* Live clock card */}
        <section
          className={`rounded-3xl border border-white/10 bg-white/[0.04] backdrop-blur-2xl shadow-[0_8px_40px_-12px_rgba(0,0,0,0.6)] p-4 sm:p-8 animate-[fadeIn_0.5s_ease-out] ${
            isBento ? "lg:col-span-12" : "mb-6"
          }`}
        >
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xs uppercase tracking-[0.18em] text-slate-400">Live clock</h2>
            <span className="text-xs text-slate-400">{userParts.weekday}, {userParts.year}-{userParts.month}-{userParts.day}</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <ClockBlock
              label={`Your time · ${userTZ}`}
              time={`${userParts.hour}:${userParts.minute}:${userParts.second}`}
              sub={formatOffset(userOffset)}
              onCopy={() => copyToClipboard(`${userParts.hour}:${userParts.minute}`, "Local time")}
            />
            <ClockBlock
              label="UTC"
              time={`${utcParts.hour}:${utcParts.minute}:${utcParts.second}`}
              sub={`UTC±00:00`}
              accent
              onCopy={() => copyToClipboard(`${utcParts.hour}:${utcParts.minute}`, "UTC time")}
            />
          </div>
        </section>

        {/* Tabs — only in stack mode; bento shows both panels simultaneously */}
        {!isBento && (
          <div className="flex gap-2 mb-4 mt-6">
            <TabButton active={tab === "convert"} onClick={() => setTab("convert")}>
              Convert
            </TabButton>
            <TabButton active={tab === "meeting"} onClick={() => setTab("meeting")}>
              Meeting planner
            </TabButton>
          </div>
        )}

        {/* Convert panel — visible if stack+selected, or always in bento */}
        {(isBento || tab === "convert") && (
          <section
            key="convert"
            className={`rounded-3xl border border-white/10 bg-white/[0.04] backdrop-blur-2xl p-4 sm:p-8 min-w-0 overflow-hidden animate-[fadeIn_0.4s_ease-out] ${
              isBento ? "lg:col-span-6" : ""
            }`}
          >
            <h2 className="text-xs uppercase tracking-[0.18em] text-slate-400 mb-6">Convert a time to UTC</h2>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6 min-w-0">
              {/* Zone selector */}
              <div className="md:col-span-3 relative min-w-0">
                <Label>From timezone</Label>
                <button
                  type="button"
                  onClick={() => setZoneOpen((v) => !v)}
                  className="w-full text-left rounded-xl border border-white/10 bg-white/[0.04] backdrop-blur-xl px-4 py-3 hover:bg-white/[0.08] hover:scale-[1.01] transition-all duration-200"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm">{selectedZoneLabel}</span>
                    <span className="text-xs text-slate-400">{convZone}</span>
                  </div>
                </button>

                {zoneOpen && (
                  <div className="absolute z-20 left-0 right-0 mt-2 rounded-xl border border-white/10 bg-slate-900/80 backdrop-blur-2xl p-2 max-h-72 overflow-auto animate-[fadeIn_0.18s_ease-out]">
                    <input
                      autoFocus
                      value={zoneQuery}
                      onChange={(e) => setZoneQuery(e.target.value)}
                      placeholder="Search city or country..."
                      className="w-full mb-2 rounded-lg bg-white/[0.04] border border-white/10 px-3 py-2 text-sm placeholder:text-slate-500 focus:outline-none focus:border-white/30"
                    />
                    {filteredZones.length === 0 && (
                      <div className="px-3 py-4 text-sm text-slate-400">No matches</div>
                    )}
                    {filteredZones.map((c) => (
                      <button
                        key={c.tz}
                        onClick={() => {
                          setConvZone(c.tz);
                          setZoneOpen(false);
                          setZoneQuery("");
                        }}
                        className="w-full text-left px-3 py-2 rounded-lg hover:bg-white/[0.08] flex items-center justify-between transition-colors"
                      >
                        <span className="text-sm">
                          {c.city} <span className="text-slate-500">· {c.country}</span>
                        </span>
                        <span className="text-xs text-slate-500">
                          {formatOffset(cityOffsets[c.tz] ?? 0)}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="min-w-0">
                <Label>Date</Label>
                <DatePickerButton value={convDate} onChange={setConvDate} />
              </div>
              <div className="min-w-0">
                <Label>Time</Label>
                <TimePickerButton value={convTime} onChange={setConvTime} />
              </div>
              <div className="min-w-0">
                <Label>Quick set</Label>
                <button
                  onClick={() => {
                    setConvDate(today);
                    setConvTime(`${userParts.hour}:${userParts.minute}`);
                    setConvZone(userTZ);
                  }}
                  className="w-full rounded-xl border border-white/10 bg-white/[0.04] backdrop-blur-xl px-4 py-3 text-sm hover:bg-white/[0.08] hover:scale-[1.02] active:scale-[0.98] transition-all duration-200"
                >
                  Use now
                </button>
              </div>
            </div>

            {/* Result */}
            {conversion && (
              <div
                key={conversion.iso}
                className="rounded-2xl border border-white/10 bg-gradient-to-br from-white/[0.06] to-white/[0.02] p-5 sm:p-6 animate-[slideUp_0.35s_ease-out]"
              >
                <div className="flex flex-wrap items-baseline gap-3 mb-4">
                  <span className="text-xs uppercase tracking-[0.16em] text-slate-400">In UTC</span>
                  <span className="text-xs text-slate-500">from {formatOffset(conversion.offset)}</span>
                </div>
                <div className="flex flex-wrap items-end gap-4">
                  <div className="text-3xl sm:text-4xl font-light tabular-nums tracking-tight">
                    {conversion.utcDisplay}
                  </div>
                  <button
                    onClick={() => copyToClipboard(conversion.utcDisplay, "UTC")}
                    className="rounded-lg border border-white/10 bg-white/[0.06] px-3 py-1.5 text-xs hover:bg-white/[0.12] hover:scale-105 active:scale-95 transition-all duration-200"
                  >
                    Copy
                  </button>
                  <button
                    onClick={() => copyToClipboard(conversion.iso, "ISO 8601")}
                    className="rounded-lg border border-white/10 bg-white/[0.06] px-3 py-1.5 text-xs hover:bg-white/[0.12] hover:scale-105 active:scale-95 transition-all duration-200"
                  >
                    Copy ISO
                  </button>
                </div>
                <div className="mt-3 text-xs text-slate-400 font-mono break-all">{conversion.iso}</div>
              </div>
            )}
          </section>
        )}

        {/* Meeting planner panel — visible if stack+selected, or always in bento */}
        {(isBento || tab === "meeting") && (
          <section
            key="meeting"
            className={`rounded-3xl border border-white/10 bg-white/[0.04] backdrop-blur-2xl p-4 sm:p-8 min-w-0 overflow-hidden animate-[fadeIn_0.4s_ease-out] ${
              isBento ? "lg:col-span-6" : ""
            }`}
          >
            <h2 className="text-xs uppercase tracking-[0.18em] text-slate-400 mb-6">Plan a meeting</h2>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6 min-w-0">
              <div className="min-w-0">
                <Label>Date</Label>
                <DatePickerButton value={meetDate} onChange={setMeetDate} />
              </div>
              <div className="min-w-0">
                <Label>Start time ({userTZ.split("/").pop().replace("_", " ")})</Label>
                <TimePickerButton value={meetTime} onChange={setMeetTime} />
              </div>
              <div className="min-w-0">
                <Label>Duration</Label>
                <select
                  value={meetDur}
                  onChange={(e) => setMeetDur(Number(e.target.value))}
                  className="w-full min-w-0 rounded-xl border border-white/10 bg-white/[0.04] backdrop-blur-xl px-3 sm:px-4 py-3 text-sm text-slate-100 hover:bg-white/[0.08] focus:outline-none focus:border-white/30 transition-all duration-200 [color-scheme:dark]"
                >
                  <option value={15}>15 min</option>
                  <option value={30}>30 min</option>
                  <option value={45}>45 min</option>
                  <option value={60}>1 hour</option>
                  <option value={90}>1.5 hours</option>
                  <option value={120}>2 hours</option>
                  <option value={180}>3 hours</option>
                </select>
              </div>
              <div className="min-w-0">
                <Label>Target zone</Label>
                <select
                  value={meetZone}
                  onChange={(e) => setMeetZone(e.target.value)}
                  className="w-full min-w-0 rounded-xl border border-white/10 bg-white/[0.04] backdrop-blur-xl px-3 sm:px-4 py-3 text-sm text-slate-100 hover:bg-white/[0.08] focus:outline-none focus:border-white/30 transition-all duration-200 [color-scheme:dark]"
                >
                  {CITIES.map((c) => (
                    <option key={c.tz} value={c.tz}>
                      {c.city} ({c.country})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {meeting && (
              <div
                key={meeting.startUTC.toISOString()}
                className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6 animate-[slideUp_0.35s_ease-out]"
              >
                <MeetingCard
                  title="Your zone"
                  subtitle={userTZ}
                  start={`${meeting.userStart.time}`}
                  end={`${meeting.userEnd.time}`}
                  date={`${meeting.userStart.weekday}, ${meeting.userStart.date}`}
                  onCopy={() =>
                    copyToClipboard(
                      `${meeting.userStart.date} ${meeting.userStart.time}–${meeting.userEnd.time}`,
                      "Your zone"
                    )
                  }
                />
                <MeetingCard
                  title="Target zone"
                  subtitle={meetZone}
                  start={`${meeting.targetStart.time}`}
                  end={`${meeting.targetEnd.time}`}
                  date={`${meeting.targetStart.weekday}, ${meeting.targetStart.date}`}
                  onCopy={() =>
                    copyToClipboard(
                      `${meeting.targetStart.date} ${meeting.targetStart.time}–${meeting.targetEnd.time}`,
                      "Target zone"
                    )
                  }
                />
                <MeetingCard
                  title="UTC"
                  subtitle="Coordinated Universal Time"
                  start={`${meeting.utcStart.time}`}
                  end={`${meeting.utcEnd.time}`}
                  date={`${meeting.utcStart.weekday}, ${meeting.utcStart.date}`}
                  accent
                  onCopy={() =>
                    copyToClipboard(
                      `${meeting.utcStart.date} ${meeting.utcStart.time}–${meeting.utcEnd.time}Z`,
                      "UTC"
                    )
                  }
                />
              </div>
            )}

            {/* Business hours overlap */}
            {meeting && (
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
                <div className="flex items-baseline justify-between mb-3">
                  <span className="text-xs uppercase tracking-[0.16em] text-slate-400">
                    Business hours overlap (target zone)
                  </span>
                  <span className="text-xs text-slate-400">{formatDur(meeting.overlapMinutes)} of {formatDur(meetDur)}</span>
                </div>
                <OverlapBar
                  startHour={meeting.targetStart.hour + meeting.targetStart.minute / 60}
                  endHour={
                    meeting.targetStart.hour +
                    meeting.targetStart.minute / 60 +
                    meetDur / 60
                  }
                />
                <div className="mt-3 text-sm">
                  {meeting.overlapPct === 100 ? (
                    <span className="text-emerald-300">Fully within 9–17 business hours.</span>
                  ) : meeting.overlapPct > 0 ? (
                    <span className="text-amber-300">
                      {meeting.overlapPct}% within business hours.
                    </span>
                  ) : (
                    <span className="text-rose-300">Outside standard business hours.</span>
                  )}
                </div>
              </div>
            )}
          </section>
        )}

        {/* Document paste converter — always visible below the tabs */}
        <DocumentConverter isBento={isBento} />

        {/* Epoch time converter — for developers and log-readers */}
        <EpochConverter isBento={isBento} now={now} />

        {/* Feedback section — copies pre-formatted message + my email */}
        <FeedbackSection isBento={isBento} />

        </div>{/* end of bento grid wrapper */}

        <footer className="mt-10 text-center text-xs text-slate-500">
          Detected zone: <span className="text-slate-400">{userTZ}</span> · times shown in 24-hour format
        </footer>
      </div>

      {/* Toast */}
      <div
        aria-live="polite"
        className={`fixed bottom-6 left-1/2 -translate-x-1/2 transition-all duration-300 ${
          toast ? "opacity-100 translate-y-0" : "opacity-0 translate-y-3 pointer-events-none"
        }`}
      >
        <div className="rounded-full border border-white/15 bg-slate-900/80 backdrop-blur-xl px-5 py-2.5 text-sm shadow-lg">
          {toast}
        </div>
      </div>

      {/* Keyframes + theme overrides */}
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(6px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(10px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          25%      { transform: translateX(-4px); }
          75%      { transform: translateX(4px); }
        }
        .shake { animation: shake 0.3s ease-in-out; }

        /* Accessible focus rings on form elements */
        button:focus-visible,
        input:focus-visible,
        textarea:focus-visible,
        select:focus-visible {
          outline: 2px solid rgba(129, 140, 248, 0.6);
          outline-offset: 2px;
        }

        /* ─── Light theme overrides ─── */
        /* Override the dark-theme glassmorphism colors when the root has data-theme="light" */
        [data-theme="light"] .bg-white\\/\\[0\\.04\\] { background-color: rgba(255, 255, 255, 0.65) !important; }
        [data-theme="light"] .bg-white\\/\\[0\\.03\\] { background-color: rgba(255, 255, 255, 0.5) !important; }
        [data-theme="light"] .bg-white\\/\\[0\\.02\\] { background-color: rgba(255, 255, 255, 0.4) !important; }
        [data-theme="light"] .hover\\:bg-white\\/\\[0\\.08\\]:hover { background-color: rgba(255, 255, 255, 0.85) !important; }
        [data-theme="light"] .hover\\:bg-white\\/\\[0\\.06\\]:hover { background-color: rgba(255, 255, 255, 0.75) !important; }
        [data-theme="light"] .hover\\:bg-white\\/\\[0\\.12\\]:hover { background-color: rgba(255, 255, 255, 0.95) !important; }
        [data-theme="light"] .border-white\\/10,
        [data-theme="light"] .border-white\\/15,
        [data-theme="light"] .border-white\\/5 { border-color: rgba(15, 23, 42, 0.12) !important; }
        [data-theme="light"] .focus\\:border-white\\/30:focus { border-color: rgba(15, 23, 42, 0.3) !important; }
        /* Text colors */
        [data-theme="light"] .text-slate-100 { color: #0f172a !important; }
        [data-theme="light"] .text-slate-200 { color: #1e293b !important; }
        [data-theme="light"] .text-slate-300 { color: #334155 !important; }
        [data-theme="light"] .text-slate-400 { color: #475569 !important; }
        [data-theme="light"] .text-slate-500 { color: #64748b !important; }
        [data-theme="light"] .text-slate-600 { color: #94a3b8 !important; }
        [data-theme="light"] .placeholder\\:text-slate-500::placeholder { color: #94a3b8 !important; }
        [data-theme="light"] .placeholder\\:text-slate-600::placeholder { color: #cbd5e1 !important; }
        /* Inline-styled boxes (textareas, output panes) need an override too */
        [data-theme="light"] textarea[style],
        [data-theme="light"] input[type="text"][style],
        [data-theme="light"] div[aria-live="polite"][style] {
          background-color: rgba(255, 255, 255, 0.75) !important;
          color: #0f172a !important;
        }
        /* Popover backgrounds (zone selector, date/time picker popups) */
        [data-theme="light"] .bg-slate-900\\/80,
        [data-theme="light"] .bg-slate-900\\/90 { background-color: rgba(255, 255, 255, 0.95) !important; }
        /* Picker selected state stays indigo but lighter */
        [data-theme="light"] .bg-indigo-500\\/30 { background-color: rgba(99, 102, 241, 0.85) !important; color: white !important; }
        [data-theme="light"] .bg-indigo-500\\/20 { background-color: rgba(99, 102, 241, 0.18) !important; }
        [data-theme="light"] .text-indigo-200,
        [data-theme="light"] .text-indigo-300 { color: #4338ca !important; }
        [data-theme="light"] .text-emerald-300 { color: #047857 !important; }
        [data-theme="light"] .text-amber-300 { color: #b45309 !important; }
        [data-theme="light"] .text-rose-300 { color: #be123c !important; }
      `}</style>
    </div>
  );
}


// ═══════════════════════════════════════════════════════════════════
// SHARED SUBCOMPONENTS
// ═══════════════════════════════════════════════════════════════════


function Toolbar({ theme, setTheme, layout, setLayout }) {
  return (
    <div className="flex items-center gap-2 flex-shrink-0">
      <ToggleGroup
        ariaLabel="Theme"
        value={theme}
        onChange={setTheme}
        options={[
          { value: "dark", label: "dark", icon: "🌙" },
          { value: "light", label: "light", icon: "☀" },
        ]}
      />
      <ToggleGroup
        ariaLabel="Layout"
        value={layout}
        onChange={setLayout}
        options={[
          { value: "stack", label: "stack", icon: "▤" },
          { value: "bento", label: "bento", icon: "▦" },
        ]}
      />
    </div>
  );
}

function ToggleGroup({ ariaLabel, value, onChange, options }) {
  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className="flex items-center rounded-xl border border-white/10 bg-white/[0.04] backdrop-blur-xl p-0.5"
    >
      {options.map((opt) => {
        const active = value === opt.value;
        return (
          <button
            key={opt.value}
            onClick={() => onChange(opt.value)}
            aria-pressed={active}
            title={opt.label}
            className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-mono transition-all duration-200 ${
              active
                ? "bg-white/[0.12] text-slate-100 shadow-sm"
                : "text-slate-400 hover:text-slate-200 hover:bg-white/[0.06]"
            }`}
          >
            <span aria-hidden="true">{opt.icon}</span>
            <span className="hidden sm:inline">{opt.label}</span>
          </button>
        );
      })}
    </div>
  );
}

function Label({ children }) {
  return (
    <label className="block text-[11px] uppercase tracking-[0.14em] text-slate-400 mb-2">
      {children}
    </label>
  );
}

function TabButton({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full px-5 py-2 text-sm border transition-all duration-200 hover:scale-[1.03] active:scale-[0.98] ${
        active
          ? "bg-white/15 border-white/25 text-white"
          : "bg-white/[0.03] border-white/10 text-slate-300 hover:bg-white/[0.08]"
      }`}
    >
      {children}
    </button>
  );
}

function ClockBlock({ label, time, sub, accent, onCopy }) {
  return (
    <div
      className={`rounded-2xl border p-5 transition-all duration-300 ${
        accent
          ? "border-indigo-400/20 bg-gradient-to-br from-indigo-500/10 to-fuchsia-500/5"
          : "border-white/10 bg-white/[0.03]"
      }`}
    >
      <div className="flex items-center justify-between mb-2">
        <span className="text-[11px] uppercase tracking-[0.14em] text-slate-400">{label}</span>
        <button
          onClick={onCopy}
          className="text-[11px] text-slate-400 hover:text-white border border-white/10 rounded-md px-2 py-0.5 hover:bg-white/[0.08] hover:scale-105 transition-all duration-200"
        >
          Copy
        </button>
      </div>
      <div className="text-4xl sm:text-5xl font-light tabular-nums tracking-tight">{time}</div>
      <div className="mt-1 text-xs text-slate-400">{sub}</div>
    </div>
  );
}

function MeetingCard({ title, subtitle, start, end, date, accent, onCopy }) {
  return (
    <div
      className={`rounded-2xl border p-5 transition-all duration-300 hover:scale-[1.01] ${
        accent
          ? "border-indigo-400/20 bg-gradient-to-br from-indigo-500/10 to-fuchsia-500/5"
          : "border-white/10 bg-white/[0.03]"
      }`}
    >
      <div className="flex items-center justify-between mb-1">
        <span className="text-[11px] uppercase tracking-[0.14em] text-slate-400">{title}</span>
        <button
          onClick={onCopy}
          className="text-[11px] text-slate-400 hover:text-white border border-white/10 rounded-md px-2 py-0.5 hover:bg-white/[0.08] hover:scale-105 transition-all duration-200"
        >
          Copy
        </button>
      </div>
      <div className="text-[11px] text-slate-500 mb-3 truncate">{subtitle}</div>
      <div className="text-2xl font-light tabular-nums tracking-tight">
        {start} <span className="text-slate-500">–</span> {end}
      </div>
      <div className="mt-1 text-xs text-slate-400">{date}</div>
    </div>
  );
}

// Visual bar showing the meeting window relative to a 0–24h day,
// with the 9–17 business window shaded.
function OverlapBar({ startHour, endHour }) {
  const dayStart = 0;
  const dayEnd = 24;
  const span = dayEnd - dayStart;
  const startPct = (Math.max(dayStart, startHour) / span) * 100;
  const widthPct =
    ((Math.min(dayEnd, endHour) - Math.max(dayStart, startHour)) / span) * 100;

  const bizStartPct = (9 / span) * 100;
  const bizWidthPct = (8 / span) * 100; // 9 to 17

  return (
    <div className="relative h-9 rounded-xl bg-white/[0.04] border border-white/10 overflow-hidden">
      {/* business hours band */}
      <div
        className="absolute top-0 bottom-0 bg-emerald-400/10 border-x border-emerald-400/20"
        style={{ left: `${bizStartPct}%`, width: `${bizWidthPct}%` }}
      />
      {/* meeting window */}
      <div
        className="absolute top-1 bottom-1 rounded-md bg-gradient-to-r from-indigo-400/80 to-fuchsia-400/80 shadow-[0_0_20px_rgba(129,140,248,0.4)] transition-all duration-500 ease-out"
        style={{ left: `${startPct}%`, width: `${Math.max(widthPct, 1)}%` }}
      />
      {/* hour ticks */}
      {[0, 6, 9, 12, 17, 21].map((h) => (
        <div
          key={h}
          className="absolute top-0 bottom-0 border-l border-white/10"
          style={{ left: `${(h / span) * 100}%` }}
        >
          <div className="absolute -bottom-4 -translate-x-1/2 text-[9px] text-slate-500">
            {h.toString().padStart(2, "0")}
          </div>
        </div>
      ))}
    </div>
  );
}


// ═══════════════════════════════════════════════════════════════════
// DATE & TIME PICKERS (custom buttons)
// ═══════════════════════════════════════════════════════════════════

function DatePickerButton({ value, onChange }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  // Close when clicking outside
  useEffect(() => {
    if (!open) return;
    const onDocClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [open]);

  const [y, m, d] = value.split("-").map(Number);
  const display = new Date(y, m - 1, d).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const currentYear = new Date().getFullYear();
  const years = [];
  for (let i = currentYear - 2; i <= currentYear + 5; i++) years.push(i);
  const daysInMonth = new Date(y, m, 0).getDate();
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  const update = (newY, newM, newD) => {
    const maxDay = new Date(newY, newM, 0).getDate();
    const clampedDay = Math.min(newD, maxDay);
    onChange(`${newY}-${String(newM).padStart(2, "0")}-${String(clampedDay).padStart(2, "0")}`);
  };

  return (
    <div className="relative min-w-0" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full text-left rounded-xl border border-white/10 bg-white/[0.04] backdrop-blur-xl px-4 py-3 hover:bg-white/[0.08] hover:scale-[1.01] transition-all duration-200"
      >
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm text-slate-100 truncate">{display}</span>
          <span className="text-xs text-slate-400 flex-shrink-0">▼</span>
        </div>
      </button>
      {open && (
        <div className="absolute z-30 left-0 right-0 mt-2 rounded-xl border border-white/10 bg-slate-900/90 backdrop-blur-2xl p-3 animate-[fadeIn_0.18s_ease-out]">
          <div className="grid grid-cols-3 gap-2">
            <PickerColumn options={months.map((label, i) => ({ value: i + 1, label }))} value={m} onChange={(v) => update(y, v, d)} />
            <PickerColumn options={days.map((dd) => ({ value: dd, label: String(dd) }))} value={d} onChange={(v) => update(y, m, v)} />
            <PickerColumn options={years.map((yy) => ({ value: yy, label: String(yy) }))} value={y} onChange={(v) => update(v, m, d)} />
          </div>
          <button
            onClick={() => setOpen(false)}
            className="mt-3 w-full rounded-lg border border-white/10 bg-white/[0.04] py-2 text-xs text-slate-300 hover:bg-white/[0.08] transition-colors"
          >
            Done
          </button>
        </div>
      )}
    </div>
  );
}

// --- Button-styled time picker matching same aesthetic ---
function TimePickerButton({ value, onChange }) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(value);
  const [invalid, setInvalid] = useState(false);
  const ref = useRef(null);

  // Sync draft when external value changes (e.g., picker selection)
  useEffect(() => {
    setDraft(value);
  }, [value]);

  // Close picker when clicking outside
  useEffect(() => {
    if (!open) return;
    const onDocClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [open]);

  const [h, mi] = value.split(":").map(Number);
  const hours = Array.from({ length: 24 }, (_, i) => i);
  const minutes = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55];

  const updateFromPicker = (newH, newMi) => {
    onChange(`${String(newH).padStart(2, "0")}:${String(newMi).padStart(2, "0")}`);
  };

  // Brief shake + revert when user types something invalid
  const flagInvalid = () => {
    setInvalid(true);
    setDraft(value);
    setTimeout(() => setInvalid(false), 300);
  };

  // Validate and commit typed text. Accepts "9", "9:30", "09:30", "930", "0930".
  const commitDraft = () => {
    const cleaned = draft.trim();
    if (cleaned === value) return; // no change
    let parsedH, parsedM;

    const colon = cleaned.match(/^(\d{1,2}):(\d{2})$/);
    const noColon = cleaned.match(/^(\d{1,2})(\d{2})$/);
    const hourOnly = cleaned.match(/^(\d{1,2})$/);

    if (colon) { parsedH = +colon[1]; parsedM = +colon[2]; }
    else if (noColon && cleaned.length >= 3) { parsedH = +noColon[1]; parsedM = +noColon[2]; }
    else if (hourOnly) { parsedH = +hourOnly[1]; parsedM = 0; }
    else { flagInvalid(); return; }

    if (parsedH < 0 || parsedH > 23 || parsedM < 0 || parsedM > 59) {
      flagInvalid();
      return;
    }
    onChange(`${String(parsedH).padStart(2, "0")}:${String(parsedM).padStart(2, "0")}`);
  };

  return (
    <div className="relative min-w-0" ref={ref}>
      <div className={`w-full rounded-xl border bg-white/[0.04] backdrop-blur-xl hover:bg-white/[0.08] transition-all duration-200 flex items-center ${
        invalid ? "border-rose-400/60 shake" : "border-white/10"
      }`}>
        <input
          type="text"
          inputMode="numeric"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commitDraft}
          onKeyDown={(e) => {
            if (e.key === "Enter") { e.target.blur(); }
            if (e.key === "Escape") { setDraft(value); e.target.blur(); }
          }}
          placeholder="HH:MM"
          aria-label="Time"
          style={{ backgroundColor: "transparent", color: "#f1f5f9" }}
          className="flex-1 min-w-0 px-4 py-3 text-sm font-mono tabular-nums bg-transparent focus:outline-none placeholder:text-slate-500"
        />
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-label="Open time picker"
          className="px-3 py-3 text-xs text-slate-400 hover:text-slate-200 flex-shrink-0 border-l border-white/5"
        >
          ▼
        </button>
      </div>
      {open && (
        <div className="absolute z-30 left-0 right-0 mt-2 rounded-xl border border-white/10 bg-slate-900/90 backdrop-blur-2xl p-3 animate-[fadeIn_0.18s_ease-out]">
          <div className="grid grid-cols-2 gap-2">
            <PickerColumn
              options={hours.map((hh) => ({ value: hh, label: String(hh).padStart(2, "0") }))}
              value={h}
              onChange={(v) => updateFromPicker(v, mi)}
            />
            <PickerColumn
              options={minutes.map((mm) => ({ value: mm, label: String(mm).padStart(2, "0") }))}
              value={mi}
              snapTo={mi}
              onChange={(v) => updateFromPicker(h, v)}
            />
          </div>
          <button
            onClick={() => setOpen(false)}
            className="mt-3 w-full rounded-lg border border-white/10 bg-white/[0.04] py-2 text-xs text-slate-300 hover:bg-white/[0.08] transition-colors"
          >
            Done
          </button>
        </div>
      )}
    </div>
  );
}

// Scrollable column of options used inside the date/time pickers.
// `snapTo` optionally finds the option closest to the given value
// (used by the minute column where minutes are in 5-min increments
// but the actual time can be any minute).
function PickerColumn({ options, value, onChange, snapTo }) {
  const ref = useRef(null);

  // If snapTo is provided, find the closest option to that value
  const effectiveValue = snapTo != null
    ? options.reduce(
        (best, opt) =>
          Math.abs(opt.value - snapTo) < Math.abs(best.value - snapTo) ? opt : best,
        options[0]
      ).value
    : value;

  // Scroll selected item into view when opened
  useEffect(() => {
    const el = ref.current?.querySelector('[data-selected="true"]');
    if (el) el.scrollIntoView({ block: "center" });
  }, []);

  return (
    <div ref={ref} className="max-h-48 overflow-y-auto rounded-lg bg-white/[0.02] border border-white/5 p-1">
      {options.map((opt) => {
        const selected = opt.value === effectiveValue;
        return (
          <button
            key={opt.value}
            data-selected={selected}
            onClick={() => onChange(opt.value)}
            className={`w-full text-center text-sm py-1.5 rounded-md transition-colors ${
              selected
                ? "bg-indigo-500/30 text-white"
                : "text-slate-300 hover:bg-white/[0.06]"
            }`}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}


// ═══════════════════════════════════════════════════════════════════
// DOCUMENT CONVERTER UI
// ═══════════════════════════════════════════════════════════════════

function DocumentConverter({ isBento }) {
  const [input, setInput] = useState("");
  const [output, setOutput] = useState("");
  const [count, setCount] = useState(0);
  const [copied, setCopied] = useState(false);

  const handleConvert = () => {
    const { converted, count: matchCount } = convertDocumentTimes(input);
    setOutput(converted);
    setCount(matchCount);
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(output);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {}
  };

  const handleExample = () => {
    setInput(
      "Standup at 9am EST, then design review at 2pm PST.\n" +
      "Demo with the London team at 5pm GMT.\n" +
      "Tokyo sync moved to 10:30 JST tomorrow."
    );
    setOutput("");
    setCount(0);
  };

  const handleClear = () => {
    setInput("");
    setOutput("");
    setCount(0);
  };

  return (
    <section className={`${CARD_CLASS} ${
      isBento ? "lg:col-span-12" : "mt-8"
    }`}>
      <div className="flex items-baseline justify-between mb-2 flex-wrap gap-2">
        <h2 className="text-xs uppercase tracking-[0.18em] text-slate-400">
          Paste a document — convert every time to UTC
        </h2>
        <span className="text-[10px] text-indigo-300 font-mono">// experimental</span>
      </div>
      <p className="text-xs text-slate-500 mb-4">
        Recognizes formats like <span className="text-slate-300 font-mono">9am EST</span>,{" "}
        <span className="text-slate-300 font-mono">2:30 PM PST</span>,{" "}
        <span className="text-slate-300 font-mono">14:00 GMT</span>,{" "}
        <span className="text-slate-300 font-mono">10:30 JST</span>.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 min-w-0">
        {/* Input */}
        <div className="min-w-0">
          <div className="flex items-center justify-between mb-2">
            <Label>Paste text</Label>
            <div className="flex gap-2">
              <button
                onClick={handleExample}
                className="text-[10px] text-slate-400 hover:text-slate-200 transition-colors"
              >
                Try example
              </button>
              {input && (
                <button
                  onClick={handleClear}
                  className="text-[10px] text-slate-400 hover:text-slate-200 transition-colors"
                >
                  Clear
                </button>
              )}
            </div>
          </div>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Paste your meeting notes, email, or schedule here..."
            rows={8}
            style={{ backgroundColor: "rgba(15, 23, 42, 0.6)", color: "#f1f5f9" }}
            className="w-full min-w-0 rounded-xl border border-white/10 backdrop-blur-xl px-4 py-3 text-sm placeholder:text-slate-500 focus:outline-none focus:border-white/30 transition-all duration-200 resize-y font-mono leading-relaxed"
          />
        </div>

        {/* Output */}
        <div className="min-w-0">
          <div className="flex items-center justify-between mb-2">
            <Label>Converted to UTC</Label>
            {output && (
              <button
                onClick={handleCopy}
                className="text-[10px] text-slate-400 hover:text-slate-200 transition-colors"
              >
                {copied ? "Copied ✓" : "Copy"}
              </button>
            )}
          </div>
          <div
            style={{ backgroundColor: "rgba(15, 23, 42, 0.6)", color: "#f1f5f9" }}
            className="w-full min-w-0 min-h-[200px] rounded-xl border border-white/10 backdrop-blur-xl px-4 py-3 text-sm font-mono leading-relaxed whitespace-pre-wrap break-words"
            aria-live="polite"
          >
            {output ? (
              <ConvertedDisplay original={input} converted={output} />
            ) : (
              <span className="text-slate-600">Output appears here after conversion...</span>
            )}
          </div>
        </div>
      </div>

      {/* Action row */}
      <div className="flex items-center justify-between mt-4 flex-wrap gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={handleConvert}
            disabled={!input.trim()}
            aria-label="Convert all times to UTC"
            className="rounded-xl border border-white/10 bg-indigo-500/20 hover:bg-indigo-500/30 disabled:opacity-40 disabled:cursor-not-allowed px-5 py-2.5 text-sm font-medium hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
          >
            Convert all times →
          </button>
          {(input || output) && (
            <button
              onClick={handleClear}
              aria-label="Clear all text"
              className="rounded-xl border border-white/10 bg-white/[0.04] hover:bg-white/[0.08] px-4 py-2.5 text-sm text-slate-300 transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30"
            >
              Clear
            </button>
          )}
        </div>
        {count > 0 && (
          <span className="text-xs text-emerald-300 animate-[fadeIn_0.3s_ease-out]">
            ✓ Converted {count} time{count === 1 ? "" : "s"}
          </span>
        )}
        {output && count === 0 && (
          <span className="text-xs text-amber-300">
            No recognized time formats found
          </span>
        )}
      </div>
    </section>
  );
}

// Renders converted text with UTC times highlighted in indigo
function ConvertedDisplay({ original, converted }) {
  // Find all "HH:MM UTC" matches in converted output and highlight them
  const parts = converted.split(/(\d{2}:\d{2} UTC)/g);
  return (
    <>
      {parts.map((part, i) =>
        /^\d{2}:\d{2} UTC$/.test(part) ? (
          <span key={i} className="text-indigo-300 bg-indigo-500/10 px-1 rounded">
            {part}
          </span>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </>
  );
}


// ═══════════════════════════════════════════════════════════════════
// EPOCH / UNIX TIMESTAMP CONVERTER
// ═══════════════════════════════════════════════════════════════════

function EpochConverter({ isBento, now }) {
  const liveEpoch = Math.floor(now.getTime() / 1000);
  const [unit, setUnit] = useState("seconds"); // "seconds" | "milliseconds"
  const [epochInput, setEpochInput] = useState("");
  const [humanInput, setHumanInput] = useState(""); // ISO-ish string

  // Auto-detect unit from input length and convert epoch → human
  const epochResult = useMemo(() => {
    const cleaned = epochInput.replace(/[,_\s]/g, "");
    if (!cleaned || !/^-?\d+(\.\d+)?$/.test(cleaned)) return null;
    const num = parseFloat(cleaned);
    if (isNaN(num)) return null;

    // Auto-detect: 10 digits = seconds, 13 digits = milliseconds, 16 = microseconds
    let ms;
    let detected;
    const absLen = Math.abs(Math.floor(num)).toString().length;
    if (unit === "auto" || !unit) {
      if (absLen >= 16) { ms = num / 1000; detected = "microseconds"; }
      else if (absLen >= 13) { ms = num; detected = "milliseconds"; }
      else { ms = num * 1000; detected = "seconds"; }
    } else if (unit === "milliseconds") {
      ms = num;
      detected = "milliseconds";
    } else {
      ms = num * 1000;
      detected = "seconds";
    }

    const date = new Date(ms);
    if (isNaN(date.getTime())) return null;

    const utcStr = date.toISOString().replace("T", " ").replace(".000Z", " UTC");
    const localStr = date.toLocaleString(undefined, {
      weekday: "short",
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      timeZoneName: "short",
    });
    const relative = formatRelative(date);

    return { date, utcStr, localStr, relative, detected };
  }, [epochInput, unit]);

  // Convert human ISO-ish input → epoch
  const humanResult = useMemo(() => {
    if (!humanInput.trim()) return null;
    // Accept "2026-06-09 14:30" or "2026-06-09T14:30:00Z" etc.
    const normalized = humanInput.trim().replace(" ", "T");
    const date = new Date(normalized.endsWith("Z") || /[+-]\d\d:?\d\d$/.test(normalized) ? normalized : normalized + "Z");
    if (isNaN(date.getTime())) return null;
    const seconds = Math.floor(date.getTime() / 1000);
    const ms = date.getTime();
    return { seconds, ms, iso: date.toISOString() };
  }, [humanInput]);

  const copy = async (text) => {
    try { await navigator.clipboard.writeText(text); } catch {}
  };

  const useNow = () => {
    setEpochInput(String(Math.floor(Date.now() / 1000)));
    setUnit("seconds");
  };

  return (
    <section className={`${CARD_CLASS} ${
      isBento ? "lg:col-span-7" : "mt-6"
    }`}>
      <div className="flex items-baseline justify-between mb-2 flex-wrap gap-2">
        <h2 className="text-xs uppercase tracking-[0.18em] text-slate-400">
          Epoch / Unix timestamp converter
        </h2>
        <span className="text-[10px] text-slate-500 font-mono">$ date +%s</span>
      </div>
      <p className="text-xs text-slate-500 mb-4">
        Convert between Unix timestamps and human-readable dates. Auto-detects seconds vs milliseconds.
      </p>

      {/* Live epoch ticker */}
      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 mb-5">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="min-w-0">
            <div className="text-[10px] uppercase tracking-[0.14em] text-slate-400 mb-1">Current epoch (seconds)</div>
            <div className="text-2xl sm:text-3xl font-mono font-light tabular-nums text-slate-100">
              {liveEpoch}
            </div>
            <div className="text-[11px] text-slate-500 font-mono mt-0.5">
              {liveEpoch * 1000} ms
            </div>
          </div>
          <button
            onClick={() => copy(String(liveEpoch))}
            className="rounded-lg border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs text-slate-300 hover:bg-white/[0.08] hover:scale-105 transition-all duration-200"
          >
            Copy
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 min-w-0">
        {/* Epoch → Human */}
        <div className="min-w-0">
          <div className="flex items-center justify-between mb-2 gap-2 flex-wrap">
            <Label>Epoch → Human</Label>
            <div className="flex gap-1">
              <UnitToggle value={unit} onChange={setUnit} option="seconds" label="s" />
              <UnitToggle value={unit} onChange={setUnit} option="milliseconds" label="ms" />
            </div>
          </div>
          <div className="flex gap-2 mb-3">
            <input
              type="text"
              value={epochInput}
              onChange={(e) => setEpochInput(e.target.value)}
              placeholder="1717902000"
              style={{ backgroundColor: "rgba(15, 23, 42, 0.6)", color: "#f1f5f9" }}
              className="flex-1 min-w-0 rounded-xl border border-white/10 backdrop-blur-xl px-4 py-3 text-sm placeholder:text-slate-500 focus:outline-none focus:border-white/30 transition-all duration-200 font-mono"
            />
            <button
              onClick={useNow}
              className="rounded-xl border border-white/10 bg-white/[0.04] backdrop-blur-xl px-3 py-3 text-xs text-slate-300 hover:bg-white/[0.08] hover:scale-[1.02] transition-all duration-200 flex-shrink-0"
            >
              Now
            </button>
          </div>
          {epochResult ? (
            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3 space-y-2 animate-[fadeIn_0.3s_ease-out]">
              <Row label="UTC" value={epochResult.utcStr} onCopy={() => copy(epochResult.utcStr)} mono />
              <Row label="Local" value={epochResult.localStr} onCopy={() => copy(epochResult.localStr)} />
              <Row label="Relative" value={epochResult.relative} muted />
            </div>
          ) : epochInput ? (
            <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-3 text-xs text-amber-300">
              Not a valid timestamp
            </div>
          ) : null}
        </div>

        {/* Human → Epoch */}
        <div className="min-w-0">
          <Label>Human → Epoch</Label>
          <div className="flex gap-2 mb-3">
            <input
              type="text"
              value={humanInput}
              onChange={(e) => setHumanInput(e.target.value)}
              placeholder="2026-06-09 14:30:00"
              aria-label="Human-readable date and time"
              style={{ backgroundColor: "rgba(15, 23, 42, 0.6)", color: "#f1f5f9" }}
              className="flex-1 min-w-0 rounded-xl border border-white/10 backdrop-blur-xl px-4 py-3 text-sm placeholder:text-slate-500 focus:outline-none focus:border-white/30 transition-all duration-200 font-mono"
            />
            <button
              onClick={() => setHumanInput(new Date().toISOString().replace("T", " ").slice(0, 19))}
              aria-label="Fill in current time"
              className="rounded-xl border border-white/10 bg-white/[0.04] backdrop-blur-xl px-3 py-3 text-xs text-slate-300 hover:bg-white/[0.08] hover:scale-[1.02] transition-all duration-200 flex-shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30"
            >
              Now
            </button>
          </div>
          {humanResult ? (
            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3 space-y-2 animate-[fadeIn_0.3s_ease-out]">
              <Row label="Seconds" value={String(humanResult.seconds)} onCopy={() => copy(String(humanResult.seconds))} mono />
              <Row label="Milliseconds" value={String(humanResult.ms)} onCopy={() => copy(String(humanResult.ms))} mono />
              <Row label="ISO 8601" value={humanResult.iso} onCopy={() => copy(humanResult.iso)} mono />
            </div>
          ) : humanInput ? (
            <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-3 text-xs text-amber-300">
              Use format <span className="font-mono">YYYY-MM-DD HH:MM:SS</span>. Treated as UTC unless a zone is given.
            </div>
          ) : (
            <p className="text-[11px] text-slate-500">
              Try: <button onClick={() => setHumanInput("2026-06-09 14:30:00")} className="font-mono text-slate-400 hover:text-slate-200 underline-offset-2 hover:underline">2026-06-09 14:30:00</button>
            </p>
          )}
        </div>
      </div>

      {/* Reference row */}
      <div className="mt-5 rounded-xl border border-white/5 bg-white/[0.02] p-3 text-[11px] text-slate-500 font-mono">
        <span className="text-slate-400"># reference: </span>
        seconds = 10 digits · milliseconds = 13 digits · epoch starts 1970-01-01 00:00:00 UTC
      </div>
    </section>
  );
}

// Small row used in EpochConverter result cards
function Row({ label, value, onCopy, mono, muted }) {
  return (
    <div className="flex items-center justify-between gap-2 min-w-0">
      <span className="text-[10px] uppercase tracking-[0.12em] text-slate-400 flex-shrink-0 w-20">{label}</span>
      <span className={`flex-1 min-w-0 truncate text-sm ${mono ? "font-mono" : ""} ${muted ? "text-slate-400" : "text-slate-100"}`}>
        {value}
      </span>
      {onCopy && (
        <button
          onClick={onCopy}
          className="text-[10px] text-slate-400 hover:text-slate-200 border border-white/10 rounded px-2 py-0.5 hover:bg-white/[0.06] transition-colors flex-shrink-0"
        >
          Copy
        </button>
      )}
    </div>
  );
}

function UnitToggle({ value, onChange, option, label }) {
  const active = value === option;
  return (
    <button
      onClick={() => onChange(option)}
      className={`text-[10px] font-mono px-2 py-1 rounded border transition-all duration-200 ${
        active
          ? "bg-indigo-500/20 border-indigo-400/30 text-indigo-200"
          : "bg-white/[0.04] border-white/10 text-slate-400 hover:bg-white/[0.08]"
      }`}
    >
      {label}
    </button>
  );
}

// Human-friendly "5 minutes ago" / "in 3 days" from a Date
function formatRelative(date) {
  const diffMs = date.getTime() - Date.now();
  const absMs = Math.abs(diffMs);
  const future = diffMs > 0;
  const units = [
    { ms: 1000 * 60 * 60 * 24 * 365, name: "year" },
    { ms: 1000 * 60 * 60 * 24 * 30, name: "month" },
    { ms: 1000 * 60 * 60 * 24 * 7, name: "week" },
    { ms: 1000 * 60 * 60 * 24, name: "day" },
    { ms: 1000 * 60 * 60, name: "hour" },
    { ms: 1000 * 60, name: "minute" },
    { ms: 1000, name: "second" },
  ];
  for (const u of units) {
    if (absMs >= u.ms) {
      const n = Math.floor(absMs / u.ms);
      return future ? `in ${n} ${u.name}${n === 1 ? "" : "s"}` : `${n} ${u.name}${n === 1 ? "" : "s"} ago`;
    }
  }
  return "just now";
}


// ═══════════════════════════════════════════════════════════════════
// FEEDBACK SECTION
// ═══════════════════════════════════════════════════════════════════

function FeedbackSection({ isBento }) {
  const FEEDBACK_EMAIL = "feedback@utcly.com"; // ← swap this for your real email
  const [category, setCategory] = useState("bug");
  const [message, setMessage] = useState("");
  const [copied, setCopied] = useState(false);

  const categories = [
    { id: "bug", label: "Bug" },
    { id: "feature", label: "Feature idea" },
    { id: "other", label: "Other" },
  ];

  const buildPayload = () => {
    const categoryLabel = categories.find((c) => c.id === category)?.label || "Other";
    return (
      `To: ${FEEDBACK_EMAIL}\n` +
      `Subject: UTCly feedback — ${categoryLabel}\n\n` +
      `${message.trim()}\n\n` +
      `---\n` +
      `Sent from utcly.com\n` +
      `Browser: ${typeof navigator !== "undefined" ? navigator.userAgent : "unknown"}\n` +
      `Timezone: ${Intl.DateTimeFormat().resolvedOptions().timeZone}\n` +
      `Date: ${new Date().toISOString()}`
    );
  };

  const handleCopy = async () => {
    if (!message.trim()) return;
    try {
      await navigator.clipboard.writeText(buildPayload());
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      setCopied(false);
    }
  };

  return (
    <section className={`${CARD_CLASS} ${
      isBento ? "lg:col-span-5" : "mt-6"
    }`}>
      <div className="flex items-baseline justify-between mb-2 flex-wrap gap-2">
        <h2 className="text-xs uppercase tracking-[0.18em] text-slate-400">
          Feedback &amp; bug reports
        </h2>
        <span className="text-[10px] text-slate-500 font-mono">$ echo $FEEDBACK</span>
      </div>
      <p className="text-xs text-slate-500 mb-4">
        Found a bug or have an idea? Write it below, click copy, then paste it into an email to{" "}
        <span className="text-slate-300 font-mono">{FEEDBACK_EMAIL}</span>.
      </p>

      {/* Category pills */}
      <div className="flex gap-2 mb-3 flex-wrap">
        {categories.map((c) => (
          <button
            key={c.id}
            onClick={() => setCategory(c.id)}
            className={`text-xs px-3 py-1.5 rounded-full border transition-all duration-200 ${
              category === c.id
                ? "bg-indigo-500/20 border-indigo-400/30 text-indigo-200"
                : "bg-white/[0.04] border-white/10 text-slate-400 hover:bg-white/[0.08]"
            }`}
          >
            {c.label}
          </button>
        ))}
      </div>

      <Label>Your message</Label>
      <textarea
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        placeholder={
          category === "bug"
            ? "Describe what went wrong, and what you expected to happen..."
            : category === "feature"
            ? "What would you like to see added or changed?"
            : "Anything else you'd like to share?"
        }
        rows={5}
        style={{ backgroundColor: "rgba(15, 23, 42, 0.6)", color: "#f1f5f9" }}
        className="w-full min-w-0 rounded-xl border border-white/10 backdrop-blur-xl px-4 py-3 text-sm placeholder:text-slate-500 focus:outline-none focus:border-white/30 transition-all duration-200 resize-y leading-relaxed"
      />

      <div className="flex items-center justify-between mt-4 flex-wrap gap-3">
        <button
          onClick={handleCopy}
          disabled={!message.trim()}
          className="rounded-xl border border-white/10 bg-indigo-500/20 hover:bg-indigo-500/30 disabled:opacity-40 disabled:cursor-not-allowed px-5 py-2.5 text-sm font-medium hover:scale-[1.02] active:scale-[0.98] transition-all duration-200"
        >
          {copied ? "✓ Copied — paste into email" : "Copy feedback to clipboard"}
        </button>
        <span className="text-[11px] text-slate-500">
          No data is sent automatically. Privacy preserved.
        </span>
      </div>

      {copied && (
        <div className="mt-3 rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3 text-xs text-emerald-300 animate-[fadeIn_0.3s_ease-out]">
          Copied! Open your email app, paste, and send to{" "}
          <span className="font-mono">{FEEDBACK_EMAIL}</span>.
        </div>
      )}
    </section>
  );
}
