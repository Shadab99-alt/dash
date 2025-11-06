// src/pages/Dashboard.jsx
import React, { useEffect, useState, useCallback, useRef } from "react";
import axios from "axios";
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, Tooltip,
  ResponsiveContainer, XAxis, YAxis, Legend, CartesianGrid
} from "recharts";

// =======================
// White Particles Background (Minimal, correctly updates)
// =======================
const ParticlesBackground = ({ particleCount = 10 }) => {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    let animationFrameId;
    let w = window.innerWidth;
    let h = window.innerHeight;

    const setSize = () => {
      w = window.innerWidth;
      h = window.innerHeight;
      canvas.width = w;
      canvas.height = h;
    };
    setSize();
    window.addEventListener("resize", setSize);

    let particles = [];
    function resetParticles() {
      particles = Array.from({ length: particleCount }).map(() => {
        const angle = Math.random() * Math.PI * 2;
        const speed = 0.2 + Math.random() * 0.8;
        return {
          x: Math.random() * w,
          y: Math.random() * h,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          size: 1.2 + Math.random() * 1.8,
        };
      });
    }
    resetParticles();

    const handleResizeParticles = () => {
      setSize();
      resetParticles();
    };
    window.addEventListener("resize", handleResizeParticles);

    const animate = () => {
      ctx.clearRect(0, 0, w, h);
      particles.forEach((p) => {
        p.x += p.vx;
        p.y += p.vy;
        if (p.x > w) p.x = 0;
        if (p.x < 0) p.x = w;
        if (p.y > h) p.y = 0;
        if (p.y < 0) p.y = h;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(255,255,255,0.8)";
        ctx.shadowColor = "white";
        ctx.shadowBlur = 7;
        ctx.fill();
        ctx.closePath();
      });
      animationFrameId = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener("resize", setSize);
      window.removeEventListener("resize", handleResizeParticles);
    };
  }, [particleCount]);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: "fixed",
        inset: 0,
        width: "100vw",
        height: "100vh",
        zIndex: 0,
        pointerEvents: "none",
        background: "transparent"
      }}
      tabIndex={-1}
      aria-hidden="true"
    />
  );
};

// Background Animation CSS (हल्की बैकग्राउंड एनिमेशन के लिए)
const GlobalStyles = () => (
  <style jsx="true">{`
    @keyframes background-pan {
      0% { background-position: 0% 50%; }
      50% { background-position: 100% 50%; }
      100% { background-position: 0% 50%; }
    }
    .animated-gradient {
      background-size: 400% 400%; 
      animation: background-pan 15s ease infinite; 
    }
    /* Custom scrollbar for premium look */
    .custom-scrollbar::-webkit-scrollbar {
        width: 6px;
        height: 6px;
    }
    .custom-scrollbar::-webkit-scrollbar-thumb {
        background-color: rgba(0, 255, 242, 0.7);
        border-radius: 3px;
    }
    .custom-scrollbar::-webkit-scrollbar-track {
        background: rgba(0, 0, 0, 0.1);
    }
  `}</style>
);


// ====== Premium Glass Card with background & hover effect ======
const GlassCard = ({ title, children, className = "", center = false }) => (
  <div
    className={`relative bg-gradient-to-br from-[#0a0e2e]/30 to-[#091133]/30
      border border-[#445a90]/80 rounded-2xl 
      shadow-[0_0_20px_rgba(0,180,255,0.05)]
      hover:shadow-[0_0_35px_rgba(255,0,255,0.4),_0_0_15px_rgba(0,255,255,0.3)]
      transition-all duration-300 p-4 text-slate-100
      backdrop-blur-sm ${center ? "flex flex-col items-center justify-center text-center" : ""} ${className}`}
  >
    <h2 className="text-[#00eaff] font-semibold mb-2 text-sm uppercase tracking-wider drop-shadow-[0_0_8px_rgba(0,255,255,0.8)]">
      {title}
    </h2>
    {children}
  </div>
);


const KpiLine = ({ label, value, color = "text-slate-100" }) => (
  <div className="flex justify-between text-sm mb-1">
    <span className="text-slate-400">{label}</span>
    <span className={`font-semibold ${color} drop-shadow-[0_0_3px_#00eaff]`}>{value}</span> 
  </div>
);


// =========================================================================
// Custom Tooltip with Decimal Fix (Improved Check)
// =========================================================================
const formatTimestampToTime = (timestamp) => {
    if (!timestamp) return 'N/A';
    try {
        const date = new Date(timestamp);
        const timeString = date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
        if (timeString.includes('AM') || timeString.includes('PM')) {
            return date.getHours().toString().padStart(2, '0') + ':' + date.getMinutes().toString().padStart(2, '0');
        }
        return timeString;
    } catch (e) {
        return timestamp;
    }
};


const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    const formattedLabel = label.toString().includes('T') && label.toString().includes('Z')
                              ? formatTimestampToTime(label)
                              : label;
    return (
      <div className="bg-[#101735]/95 border border-[#FF00FF] text-slate-200 text-xs px-2 py-1 rounded-md shadow-[0_0_10px_rgba(255,0,255,0.7)]">
        <p className="text-[#00eaff] font-bold">{formattedLabel}</p>
        {payload.map((item, index) => {
          let formattedValue = item.value;
          if (typeof item.value === 'number' || (typeof item.value === 'string' && !isNaN(parseFloat(item.value)))) {
              const numValue = Number(item.value);
              if (Math.abs(numValue - Math.round(numValue)) > 0.000001 || item.value.toString().split('.')[1]?.length > 2) {
                  formattedValue = numValue.toFixed(2);
              } else {
                  formattedValue = numValue.toFixed(0); 
              }
          }
          return (
            <p key={index} className="text-[#f9fafb] font-semibold">
              {item.name}: {formattedValue}
            </p>
          );
        })}
      </div>
    );
  }
  return null;
};
// =========================================================================


const cursorStyle = { fill: "rgba(0,0,0,0)" };
const chartFixStyle = { outline: "none", userSelect: "none", pointerEvents: "auto" };


const MiniLine = ({ data, dataKey, xAxisKey = undefined }) => (
  <ResponsiveContainer width="100%" height="70%">
    <LineChart data={data} style={chartFixStyle}>
      <XAxis 
        dataKey={xAxisKey || 'index'}
        tick={false}
        axisLine={false}
        tickLine={false}
      />
      <Tooltip content={<CustomTooltip />} cursor={cursorStyle} />
      <defs>
        <linearGradient id="lineGradient" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#00FFFF" stopOpacity={1}/> 
          <stop offset="50%" stopColor="#33b4ffff" stopOpacity={1}/>
          <stop offset="100%" stopColor="#87d324ff" stopOpacity={1}/>
        </linearGradient>
      </defs>
      <Line type="monotone" dataKey={dataKey} stroke="url(#lineGradient)" strokeWidth={3} dot={false} />
    </LineChart>
  </ResponsiveContainer>
);


// === FPY GAUGE COMPONENT ===
const FpyGauge = ({ fpy }) => {
    const data = [
      { name: 'Progress', value: fpy },
      { name: 'Remaining', value: 100 - fpy },
    ];
    return (
      <div className="w-[100px] h-[100px] relative">
          <ResponsiveContainer width="100%" height="100%">
              <PieChart style={chartFixStyle}>
                  <defs>
                      <linearGradient id="fpyGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#00eaff" stopOpacity={1}/>
                          <stop offset="100%" stopColor="#6cd63bff" stopOpacity={1}/>
                      </linearGradient>
                  </defs>
                  <Pie
                      data={data}
                      innerRadius={40}
                      outerRadius={48}
                      startAngle={225}
                      endAngle={-45}
                      paddingAngle={0} 
                      dataKey="value"
                  >
                      <Cell key="progress" fill="url(#fpyGradient)" stroke="none" />
                      <Cell key="remaining" fill="#1e293b" stroke="none" />
                  </Pie>
              </PieChart>
          </ResponsiveContainer>
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-center">
              <p className="text-xs text-slate-400">Quality</p>
              <p className="text-2xl font-extrabold text-[#14bffc] drop-shadow-[0_0_12px_rgba(20,191,252,1)]">
                  {fpy.toFixed(1)}
              </p>
              <p className="text-[10px] text-slate-500 mt-[-5px]">Score</p>
          </div>
      </div>
    );
};
// === END FPY GAUGE COMPONENT ===



export default function Dashboard() {
  const [data, setData] = useState({});
  const [loading, setLoading] = useState(true);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const base = "https://dash-backend-312j.onrender.com";

  const fetchAll = useCallback(() => {
    setLoading(true);
    const endpoints = [
      { key: "production", url: `${base}/production${startDate && endDate ? `?start=${startDate}&end=${endDate}` : ""}` },
      { key: "energy", url: `${base}/energy${startDate && endDate ? `?start=${startDate}&end=${endDate}` : ""}` },
      { key: "steam", url: `${base}/steam${startDate && endDate ? `?start=${startDate}&end=${endDate}` : ""}` },
      { key: "availability", url: `${base}/availability${startDate && endDate ? `?start=${startDate}&end=${endDate}` : ""}` },
      { key: "quality", url: `${base}/quality${startDate && endDate ? `?start=${startDate}&end=${endDate}` : ""}` },
      { key: "recipe", url: `${base}/recipe${startDate && endDate ? `?start=${startDate}&end=${endDate}` : ""}` },
      { key: "silos", url: `${base}/silos${startDate && endDate ? `?start=${startDate}&end=${endDate}` : ""}` },
      { key: "reliability", url: `${base}/reliability${startDate && endDate ? `?start=${startDate}&end=${endDate}` : ""}` },
      { key: "packaging", url: `${base}/packaging${startDate && endDate ? `?start=${startDate}&end=${endDate}` : ""}` },
    ];
    endpoints.forEach(({ key, url }) => {
      axios.get(url)
        .then((res) => {
          setData((prev) => ({ ...prev, [key]: res.data }));
        })
        .catch((err) => {
          setData((prev) => ({ ...prev, [key]: prev[key] || null }));
        });
    });
    setTimeout(() => setLoading(false), 250);
  }, [startDate, endDate]);

  useEffect(() => {
    fetchAll();
  }, [startDate, endDate, fetchAll]);

  if (loading && Object.keys(data).length === 0)
    return (
      <div className="text-white text-center p-20 text-xl animate-pulse min-h-screen bg-gradient-to-r from-[#01010a] via-[#05011a] to-[#01010a]">
        Dashboard Data Loading...
      </div>
    );

  const prod = data.production?.summary || { actual_tons: "-", planned_tons: "-", plan_attainment_pct: 0 };
  const prodByLine = data.production?.byLine || [];
  const fpy = Number(data.quality?.fpy_percent ?? data.quality?.fpy ?? 0); 
  const holds = data.quality?.holds ?? "-";
  const totalSamples = data.quality?.total_samples ?? "-";
  const silosDoc = (data.silos?.doc || data.silos || []).map(d => ({
    material_code: d.material_code ?? d.name ?? "N/A",
    days_of_cover: Number(d.days_of_cover ?? d.value ?? 0)
  }));
  const silosEvents = data.silos?.events || { low_level_count: 0, changeover_count: 0 };
  const recipeChart = (data.recipe || []).map((r, i) => ({
    name: r.product_code || `R${i + 1}`,
    Compliance: Number(r.compliance_pct || r.compliance || 0),
    Worst: r.worst_ingredient || "-",
  }));

  return (
    <div className="min-h-screen bg-gradient-to-r from-[#01010a] via-[#05011a] to-[#01010a] text-slate-100 p-4 font-[Inter] overflow-hidden animated-gradient" style={{ position: "relative", zIndex: 1 }}>
      <ParticlesBackground particleCount={10} /> {/* Minimal White Particles */}
      <GlobalStyles />
      {/* === Dashboard Title + Date Filter === */}
      <div className="flex justify-between items-center mb-4" style={{ position: "relative", zIndex: 2 }}>
        <h1 className="text-2xl font-bold text-[#00E3FF] drop-shadow-[0_0_18px_rgba(0,255,255,0.9)] tracking-wide">
          Feedmill Executive Dashboard
        </h1>
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="bg-[#0b122a] border border-[#00eaff40] text-slate-200 px-2 py-1 rounded-md text-sm"
            disabled={loading}
          />
          <span className="text-slate-400 text-sm">to</span>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="bg-[#0b122a] border border-[#00eaff40] text-slate-200 px-2 py-1 rounded-md text-sm"
            disabled={loading}
          />
          <button
            onClick={fetchAll}
            className={`text-sm px-3 py-1 rounded-md border transition ${loading ? 'bg-slate-700 text-slate-400 border-slate-600 cursor-not-allowed' : 'bg-[#00eaff22] hover:bg-[#00eaff44] text-[#00eaff] border-[#00eaff55]'}`}
            disabled={loading}
          >
            {loading ? (
              <span className="flex items-center">
                <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Loading...
              </span>
            ) : "Apply"}
          </button>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-3 h-[calc(100vh-90px)]" style={{ position: "relative", zIndex: 2 }}>
        {/* LEFT SIDE */}
        <div className="col-span-1 flex flex-col gap-3">
          {/* PRODUCTION VS PLAN */}
          <GlassCard title="Production vs Plan" className="flex-[1.5]">
            <KpiLine label="Actual Tons (WTD)" value={`${prod.actual_tons ?? "-"} t`} />
            <KpiLine label="Planned Tons (WTD)" value={`${prod.planned_tons ?? "-"} t`} />
            <KpiLine
              label="Plan Attainment"
              value={`${Number(prod.plan_attainment_pct ?? 0).toFixed(1)}%`}
              color="text-green-400"
            />
            <div className="h-[160px] mt-3">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={prodByLine.map(l => ({
                    name: l.line,
                    Actual: Number(l.actual_tons),
                    Planned: Number(l.planned_tons),
                  }))}
                  barCategoryGap={15}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 255, 255, 0.08)" /> 
                  <XAxis dataKey="name" tick={{ fill: "#00E3FF", fontSize: 10 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: "#00E3FF", fontSize: 10 }} axisLine={false} tickLine={false} />
                  <Tooltip content={<CustomTooltip />} cursor={cursorStyle} />
                  <Legend wrapperStyle={{ color: "#00eaff", fontSize: 10, paddingTop: "10px" }} />
                  <defs>
                    <linearGradient id="actualBar" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#6ebb15ff" stopOpacity={1}/>
                      <stop offset="100%" stopColor="#49e22bff" stopOpacity={1}/>
                    </linearGradient>
                    <linearGradient id="plannedBar" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#00E3FF" stopOpacity={1}/>
                      <stop offset="100%" stopColor="#0033CC" stopOpacity={1}/>
                    </linearGradient>
                  </defs>
                  <Bar dataKey="Actual" fill="url(#actualBar)" radius={[8, 8, 0, 0]} barSize={18}/>
                  <Bar dataKey="Planned" fill="url(#plannedBar)" radius={[8, 8, 0, 0]} barSize={18}/>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </GlassCard>
          {/* AVAILABILITY & SILOS */}
          <div className="grid grid-cols-2 gap-3 flex-1">
            <GlassCard title="Availability (RUN%)">
              <ResponsiveContainer width="100%" height={150}>
                <BarChart layout="vertical" data={data.availability || []} barCategoryGap={6} style={chartFixStyle}>
                   <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 255, 255, 0.08)" horizontal={false} />
                   <XAxis type="number" domain={[0, 100]} hide />
                   <YAxis type="category" dataKey="line_id" width={50} tick={{ fill: "#00E3FF" }} axisLine={false} tickLine={false} />
                   <Tooltip content={<CustomTooltip />} cursor={cursorStyle} />
                   <Bar dataKey="run_availability_pct" fill="url(#actualBar)" radius={[0, 10, 10, 0]} barSize={14} />
                 </BarChart>
              </ResponsiveContainer>
            </GlassCard>
            <GlassCard title="Silos / Materials">
              <div className="w-full overflow-x-auto custom-scrollbar">
                <div className="min-w-[600px] h-[120px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={silosDoc} barSize={14}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 255, 255, 0.08)" />
                      <XAxis
                        dataKey="material_code"
                        tick={{ fill: "#00E3FF", fontSize: 9 }}
                        interval={0}
                        angle={-25}
                        textAnchor="end"
                        height={40}
                        axisLine={false} tickLine={false}
                      />
                      <YAxis hide />
                      <Tooltip content={<CustomTooltip />} cursor={cursorStyle} />
                      <defs>
                        <linearGradient id="docBar" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#00E3FF" stopOpacity={1} />
                          <stop offset="100%" stopColor="#2be2baff" stopOpacity={1} />
                        </linearGradient>
                      </defs>
                      <Bar dataKey="days_of_cover" fill="url(#docBar)" radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
              <div className="mt-2 text-xs text-slate-300 flex justify-between">
                <span>
                  Low Level:{" "}
                  <span className="text-[#ff4d6d] font-semibold">
                    {silosEvents.low_level_count}
                  </span>
                </span>
                <span>
                  Changeovers:{" "}
                  <span className="text-[#00eaff] font-semibold">
                    {silosEvents.changeover_count}
                  </span>
                </span>
              </div>
            </GlassCard>
          </div>
        </div>
        {/* RIGHT SIDE */}
        <div className="col-span-2 grid grid-cols-2 grid-rows-3 gap-3">
          <GlassCard title="Energy (kWh/t)">
            <KpiLine label="SEC" value={`${data.energy?.sec?.sec_kwh_per_t ?? "-"} kWh/t`} />
            <MiniLine data={data.energy?.trend || []} dataKey="demand_kw" xAxisKey="timestamp" />
          </GlassCard>
          <GlassCard title="Steam & Conditioning">
            <KpiLine label="Steam/t" value={`${data.steam?.steam?.steam_kg_per_t ?? "-"} kg/t`} />
            <KpiLine label="SP" value={data.steam?.steam?.sp ?? "-"} />
            <KpiLine label="PV" value={data.steam?.steam?.pv ?? "-"} />
            <KpiLine label="SP vs PV" value={data.steam?.steam?.sp_vs_pv ?? "-"} color="text-yellow-400" />
            <MiniLine data={data.steam?.trend || []} dataKey="pv" xAxisKey="timestamp" />
          </GlassCard>
          <GlassCard title="Quality (FPY)" center>
            <div className="mb-2 text-sm w-full flex justify-between px-8">
              <div>
                Holds: <span className="font-semibold">{data.quality?.holds ?? "-"}</span>
              </div>
              <div>
                Total Samples: <span className="font-semibold">{data.quality?.total_samples ?? "-"}</span>
              </div>
            </div>
            <FpyGauge fpy={fpy} />
            <p className="mt-2 text-xl font-extrabold text-[#14bffc] drop-shadow-[0_0_12px_rgba(255,20,147,1)]"></p>
          </GlassCard>
          <GlassCard title="Recipe Adherence">
            <KpiLine
              label="Overall % within tolerance"
              value={`${Number(data.recipe?.[0]?.compliance_pct || 0).toFixed(1)}%`}
              color="text-green-400"
            />
            <KpiLine
              label="Worst Ingredient"
              value={data.recipe?.[0]?.worst_ingredient || "-"}
              color="text-[#e8022c]" 
            />
            <ResponsiveContainer width="100%" height="70%">
                <LineChart data={recipeChart} style={chartFixStyle}>
                    <Tooltip content={<CustomTooltip />} cursor={cursorStyle} />
                    <XAxis 
                        dataKey="name"
                        tick={false}
                        axisLine={false}
                        tickLine={false} 
                    />
                    <YAxis hide />
                    <defs>
                        <linearGradient id="lineGradient" x1="0" y1="0" x2="1" y2="1">
                            <stop offset="0%" stopColor="#00FFFF" stopOpacity={1}/> 
                            <stop offset="50%" stopColor="#33b4ffff" stopOpacity={1}/>
                            <stop offset="100%" stopColor="#87d324ff" stopOpacity={1}/>
                        </linearGradient>
                    </defs>
                    <Line type="monotone" dataKey="Compliance" stroke="url(#lineGradient)" strokeWidth={3} dot={false} />
                </LineChart>
            </ResponsiveContainer>
          </GlassCard>
          <GlassCard title="Reliability (Downtime)">
            <KpiLine label="Total Downtime" value={`${data.reliability?.downtime_pct ?? "0"}%`} color="text-[#e8022c]" />
            <ResponsiveContainer width="100%" height="70%">
              <BarChart layout="vertical" data={data.reliability?.pareto || []}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 255, 255, 0.08)" horizontal={false} />
                <XAxis type="number" hide />
                <YAxis
                  type="category"
                  dataKey="reason"
                  width={100} 
                  tick={{ fill: "#00E3FF", fontSize: 10 }}
                  axisLine={false}
                  tickLine={false}
                  interval={0} 
                />
                <Tooltip content={<CustomTooltip />} cursor={cursorStyle} />
                <defs>
                  <linearGradient id="downtimeMini" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor="#f77307ff" stopOpacity={1} />
                    <stop offset="100%" stopColor="#FFC300" stopOpacity={1} />
                  </linearGradient>
                </defs>
                <Bar dataKey="total_min" fill="url(#downtimeMini)" radius={[0, 6, 6, 0]} barSize={10} />
              </BarChart>
            </ResponsiveContainer>
          </GlassCard>
          <GlassCard title="Packaging & Dispatch">
            <KpiLine label="Total Bags" value={`${data.packaging?.total_bags ?? "-"}`} />
            <KpiLine label="Rework" value={`${Number(data.packaging?.rework_percent || 0).toFixed(1)}%`} color="text-yellow-400" />
            <KpiLine label="Avg Bag Weight" value={`${Number(data.packaging?.avg_bag_weight || 0).toFixed(2)} kg`} color="text-[#00eaff]" />
            <MiniLine data={data.packaging?.trend || []} dataKey="total_bags" />
          </GlassCard>
        </div>
      </div>
    </div>
  );
}
