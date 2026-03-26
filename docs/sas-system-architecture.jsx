import { useState } from "react";

const COLORS = {
  bg: "#0D0F12",
  card: "#141720",
  cardHover: "#1A1D27",
  border: "#2D3148",
  text: "#F1F5F9",
  textMuted: "#9CA3AF",
  indigo: "#6366F1",
  green: "#10B981",
  amber: "#F59E0B",
  blue: "#3B82F6",
  red: "#EF4444",
  pink: "#EC4899",
};

const CURRENT_FEATURES = {
  auth: {
    label: "Authentication",
    color: COLORS.indigo,
    items: [
      { name: "Login (Company Code + Email + Password)", done: true },
      { name: "Set Password (Invite/Recovery)", done: true },
      { name: "Role-based routing (Owner/Admin/Employee)", done: true },
      { name: "Supabase session management", done: true },
      { name: "AuthGate redirect logic", done: true },
    ],
  },
  owner: {
    label: "Owner Portal",
    color: COLORS.amber,
    items: [
      { name: "Company list view", done: true },
      { name: "Create company modal", done: true },
      { name: "Owner settings & sign out", done: true },
    ],
  },
  admin: {
    label: "Admin Portal",
    color: COLORS.green,
    items: [
      { name: "Dashboard with KPI stats", done: true },
      { name: "Client management (CRUD)", done: true },
      { name: "Client detail & authorizations", done: true },
      { name: "Schedule management (CRUD)", done: true },
      { name: "Schedule detail (time entries, notes)", done: true },
      { name: "Employee management & invite", done: true },
      { name: "Settings & service types", done: true },
    ],
  },
  employee: {
    label: "Employee Portal",
    color: COLORS.blue,
    items: [
      { name: "My visits list", done: true },
      { name: "Visit detail & notes", done: true },
      { name: "Clock in/out with live timer", done: true },
    ],
  },
};

const PLANNED_FEATURES = [
  {
    phase: "Phase 1 — Core Polish",
    color: COLORS.indigo,
    features: [
      {
        name: "Onboarding Flow",
        desc: "First-time setup wizard for owners: create company, configure services, invite first admin",
        priority: "P0",
      },
      {
        name: "Forgot Password",
        desc: "Password reset flow via Supabase magic link / email OTP",
        priority: "P0",
      },
      {
        name: "Profile Management",
        desc: "Edit name, avatar upload, change password, notification preferences for all roles",
        priority: "P0",
      },
      {
        name: "Real-time Notifications",
        desc: "Push + in-app notifications for schedule changes, clock events, new assignments",
        priority: "P1",
      },
      {
        name: "Error Handling & Empty States",
        desc: "Graceful error boundaries, retry logic, illustrated empty states across all screens",
        priority: "P1",
      },
      {
        name: "Loading & Skeleton States",
        desc: "Skeleton screens for all data-fetching views, pull-to-refresh on mobile",
        priority: "P1",
      },
    ],
  },
  {
    phase: "Phase 2 — Scheduling & Calendar",
    color: COLORS.green,
    features: [
      {
        name: "Calendar View",
        desc: "Day/week/month calendar with drag-to-create, color-coded by client or employee",
        priority: "P0",
      },
      {
        name: "Recurring Schedules",
        desc: "Weekly/biweekly/monthly repeat rules with exception handling",
        priority: "P0",
      },
      {
        name: "Schedule Conflicts",
        desc: "Auto-detect overlapping appointments, warn on create/edit, suggest alternatives",
        priority: "P1",
      },
      {
        name: "Availability Management",
        desc: "Employees set working hours, time-off requests, admin approval flow",
        priority: "P1",
      },
      {
        name: "Bulk Schedule",
        desc: "Create multiple appointments at once via template or CSV import",
        priority: "P2",
      },
    ],
  },
  {
    phase: "Phase 3 — Case Notes & Documentation",
    color: COLORS.blue,
    features: [
      {
        name: "Rich Case Notes",
        desc: "Markdown/rich text editor, attach photos, structured templates per service type",
        priority: "P0",
      },
      {
        name: "Case Note Templates",
        desc: "Admin-configurable templates with required fields, dropdowns, checkboxes",
        priority: "P0",
      },
      {
        name: "Document Management",
        desc: "Upload/store PDFs, images, signed forms per client with version history",
        priority: "P1",
      },
      {
        name: "E-Signatures",
        desc: "In-app signature capture for consent forms, service agreements",
        priority: "P2",
      },
      {
        name: "Case Note Review/Approval",
        desc: "Admin review queue, approve/reject/request-revision workflow",
        priority: "P1",
      },
    ],
  },
  {
    phase: "Phase 4 — Payroll & Billing",
    color: COLORS.amber,
    features: [
      {
        name: "Timesheet Summary",
        desc: "Weekly/biweekly timesheet view grouped by employee, auto-calculated from time entries",
        priority: "P0",
      },
      {
        name: "Pay Rate Configuration",
        desc: "Per-employee pay rates, overtime rules, holiday multipliers",
        priority: "P0",
      },
      {
        name: "Payroll Export",
        desc: "Generate CSV/PDF for ADP, Gusto, QuickBooks integration",
        priority: "P1",
      },
      {
        name: "Invoice Generation",
        desc: "Auto-generate invoices per client based on completed visits and authorized hours",
        priority: "P1",
      },
      {
        name: "Authorization Tracking",
        desc: "Track approved hours per client, alert when nearing limits, prevent over-scheduling",
        priority: "P0",
      },
    ],
  },
  {
    phase: "Phase 5 — Reporting & Analytics",
    color: COLORS.pink,
    features: [
      {
        name: "Admin Dashboard Charts",
        desc: "Revenue trends, hours by employee, visits by client, utilization rates",
        priority: "P0",
      },
      {
        name: "Employee Performance",
        desc: "On-time rate, visit completion, hours logged vs scheduled",
        priority: "P1",
      },
      {
        name: "Client Reports",
        desc: "Service history, authorization usage, visit frequency per client",
        priority: "P1",
      },
      {
        name: "Export Reports",
        desc: "Download PDF/Excel reports for stakeholders, Medicaid/DHR audits",
        priority: "P1",
      },
      {
        name: "Owner Cross-Company Analytics",
        desc: "Compare metrics across all tenant companies, identify top/bottom performers",
        priority: "P2",
      },
    ],
  },
  {
    phase: "Phase 6 — Platform & Scale",
    color: COLORS.red,
    features: [
      {
        name: "White-Label Theming",
        desc: "Per-company logo, accent color, brand name — configurable via admin settings",
        priority: "P0",
      },
      {
        name: "Role Permissions Granularity",
        desc: "Custom permission sets beyond owner/admin/employee (e.g., supervisor, billing-only)",
        priority: "P1",
      },
      {
        name: "Audit Log",
        desc: "Track all data changes with who/what/when for compliance",
        priority: "P1",
      },
      {
        name: "Multi-language (i18n)",
        desc: "English + Spanish to start, per-company default language setting",
        priority: "P2",
      },
      {
        name: "Offline Mode",
        desc: "Queue actions when offline, sync on reconnect — critical for field workers",
        priority: "P1",
      },
      {
        name: "GPS & Geofencing",
        desc: "Verify clock-in location matches client address, mileage tracking",
        priority: "P2",
      },
    ],
  },
];

const DB_TABLES = [
  { name: "companies", desc: "Tenant root with access_code", exists: true },
  { name: "users", desc: "Profiles with role enum", exists: true },
  { name: "clients", desc: "Service locations per tenant", exists: true },
  { name: "schedules", desc: "Appointments with status", exists: true },
  { name: "time_entries", desc: "Clock in/out with duration", exists: true },
  { name: "visit_notes", desc: "Notes per schedule", exists: true },
  { name: "authorizations", desc: "Approved hours per client", exists: false },
  { name: "documents", desc: "File attachments per client", exists: false },
  { name: "pay_rates", desc: "Employee compensation config", exists: false },
  { name: "invoices", desc: "Generated billing records", exists: false },
  { name: "notifications", desc: "In-app notification queue", exists: false },
  { name: "audit_log", desc: "Change tracking for compliance", exists: false },
  { name: "templates", desc: "Case note templates", exists: false },
  { name: "availability", desc: "Employee working hours", exists: false },
];

function PriorityBadge({ priority }) {
  const colors = {
    P0: { bg: "#EF444420", text: "#EF4444", label: "Must Have" },
    P1: { bg: "#F59E0B20", text: "#F59E0B", label: "Should Have" },
    P2: { bg: "#6366F120", text: "#6366F1", label: "Nice to Have" },
  };
  const c = colors[priority];
  return (
    <span
      style={{
        fontSize: 11,
        padding: "2px 8px",
        borderRadius: 999,
        backgroundColor: c.bg,
        color: c.text,
        fontWeight: 600,
        whiteSpace: "nowrap",
      }}
    >
      {priority} {c.label}
    </span>
  );
}

function FlowNode({ label, color, x, y, w = 140, h = 36, onClick, active }) {
  return (
    <g
      onClick={onClick}
      style={{ cursor: onClick ? "pointer" : "default" }}
    >
      <rect
        x={x}
        y={y}
        width={w}
        height={h}
        rx={8}
        fill={active ? color : color + "30"}
        stroke={color}
        strokeWidth={active ? 2 : 1}
      />
      <text
        x={x + w / 2}
        y={y + h / 2 + 1}
        textAnchor="middle"
        dominantBaseline="middle"
        fill={active ? "#fff" : COLORS.text}
        fontSize={11}
        fontWeight={500}
        fontFamily="Inter, system-ui, sans-serif"
      >
        {label}
      </text>
    </g>
  );
}

function Arrow({ x1, y1, x2, y2, color = "#4B5563" }) {
  return (
    <line
      x1={x1}
      y1={y1}
      x2={x2}
      y2={y2}
      stroke={color}
      strokeWidth={1.5}
      markerEnd="url(#arrow)"
    />
  );
}

function FlowDiagram({ activeSection, setActiveSection }) {
  const W = 130;
  const H = 32;
  return (
    <svg viewBox="0 0 800 520" style={{ width: "100%", maxWidth: 800 }}>
      <defs>
        <marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth={6} markerHeight={6} orient="auto-start-auto">
          <path d="M 0 0 L 10 5 L 0 10 z" fill="#4B5563" />
        </marker>
      </defs>

      {/* Auth Section */}
      <rect x={10} y={10} width={780} height={100} rx={12} fill={COLORS.indigo + "10"} stroke={COLORS.indigo + "40"} strokeWidth={1} />
      <text x={24} y={32} fill={COLORS.indigo} fontSize={12} fontWeight={700} fontFamily="Inter, system-ui, sans-serif">AUTHENTICATION</text>

      <FlowNode label="App Launch" color={COLORS.indigo} x={30} y={50} w={100} h={H} />
      <Arrow x1={130} y1={66} x2={150} y2={66} color={COLORS.indigo} />
      <FlowNode label="Auth Gate" color={COLORS.indigo} x={150} y={50} w={100} h={H} />
      <Arrow x1={250} y1={66} x2={270} y2={66} color={COLORS.indigo} />
      <FlowNode label="Login" color={COLORS.indigo} x={270} y={50} w={90} h={H} active />
      <Arrow x1={360} y1={66} x2={380} y2={66} color={COLORS.indigo} />
      <FlowNode label="Sign In" color={COLORS.indigo} x={380} y={50} w={90} h={H} />
      <Arrow x1={470} y1={66} x2={490} y2={66} color={COLORS.indigo} />
      <FlowNode label="Resolve Role" color={COLORS.indigo} x={490} y={50} w={110} h={H} />

      {/* Arrows to portals */}
      <Arrow x1={545} y1={82} x2={140} y2={150} color={COLORS.amber} />
      <Arrow x1={545} y1={82} x2={400} y2={150} color={COLORS.green} />
      <Arrow x1={545} y1={82} x2={660} y2={150} color={COLORS.blue} />

      {/* Owner */}
      <rect x={10} y={130} width={250} height={370} rx={12} fill={COLORS.amber + "08"} stroke={COLORS.amber + "40"} strokeWidth={1} />
      <text x={24} y={152} fill={COLORS.amber} fontSize={12} fontWeight={700} fontFamily="Inter, system-ui, sans-serif">OWNER PORTAL</text>

      <FlowNode label="Dashboard" color={COLORS.amber} x={30} y={165} w={W} h={H} active={activeSection === "owner"} onClick={() => setActiveSection("owner")} />
      <FlowNode label="Company List" color={COLORS.amber} x={30} y={210} w={W} h={H} />
      <FlowNode label="Create Company" color={COLORS.amber} x={30} y={255} w={W} h={H} />
      <FlowNode label="Settings" color={COLORS.amber} x={30} y={300} w={W} h={H} />
      <FlowNode label="Sign Out" color={COLORS.amber} x={30} y={345} w={W} h={H} />

      <Arrow x1={95} y1={197} x2={95} y2={210} color={COLORS.amber} />
      <Arrow x1={95} y1={242} x2={95} y2={255} color={COLORS.amber} />
      <Arrow x1={95} y1={287} x2={95} y2={300} color={COLORS.amber} />
      <Arrow x1={95} y1={332} x2={95} y2={345} color={COLORS.amber} />

      {/* Admin */}
      <rect x={270} y={130} width={250} height={370} rx={12} fill={COLORS.green + "08"} stroke={COLORS.green + "40"} strokeWidth={1} />
      <text x={284} y={152} fill={COLORS.green} fontSize={12} fontWeight={700} fontFamily="Inter, system-ui, sans-serif">ADMIN PORTAL</text>

      <FlowNode label="Dashboard + KPIs" color={COLORS.green} x={290} y={165} w={W} h={H} active={activeSection === "admin"} onClick={() => setActiveSection("admin")} />
      <FlowNode label="Clients" color={COLORS.green} x={290} y={210} w={W} h={H} />
      <FlowNode label="Client Detail" color={COLORS.green} x={290} y={255} w={W} h={H} />
      <FlowNode label="Authorizations" color={COLORS.green} x={290} y={300} w={W} h={H} />
      <FlowNode label="Schedules" color={COLORS.green} x={290} y={345} w={W} h={H} />
      <FlowNode label="Schedule Detail" color={COLORS.green} x={290} y={390} w={W} h={H} />
      <FlowNode label="Employees" color={COLORS.green} x={290} y={435} w={W} h={H} />
      <FlowNode label="Settings" color={COLORS.green} x={290} y={475} w={W} h={H} />

      <Arrow x1={355} y1={197} x2={355} y2={210} color={COLORS.green} />
      <Arrow x1={355} y1={242} x2={355} y2={255} color={COLORS.green} />
      <Arrow x1={355} y1={287} x2={355} y2={300} color={COLORS.green} />
      <Arrow x1={355} y1={332} x2={355} y2={345} color={COLORS.green} />
      <Arrow x1={355} y1={377} x2={355} y2={390} color={COLORS.green} />
      <Arrow x1={355} y1={422} x2={355} y2={435} color={COLORS.green} />
      <Arrow x1={355} y1={467} x2={355} y2={475} color={COLORS.green} />

      {/* Employee */}
      <rect x={530} y={130} width={260} height={370} rx={12} fill={COLORS.blue + "08"} stroke={COLORS.blue + "40"} strokeWidth={1} />
      <text x={544} y={152} fill={COLORS.blue} fontSize={12} fontWeight={700} fontFamily="Inter, system-ui, sans-serif">EMPLOYEE PORTAL</text>

      <FlowNode label="My Visits" color={COLORS.blue} x={550} y={165} w={W} h={H} active={activeSection === "employee"} onClick={() => setActiveSection("employee")} />
      <FlowNode label="Visit Detail" color={COLORS.blue} x={550} y={210} w={W} h={H} />
      <FlowNode label="Add Note" color={COLORS.blue} x={550} y={255} w={W} h={H} />
      <FlowNode label="Clock In/Out" color={COLORS.blue} x={550} y={300} w={W} h={H} />
      <FlowNode label="Select Visit" color={COLORS.blue} x={550} y={345} w={W} h={H} />
      <FlowNode label="Live Timer" color={COLORS.blue} x={550} y={390} w={W} h={H} />
      <FlowNode label="Clock Out" color={COLORS.blue} x={550} y={435} w={W} h={H} />

      <Arrow x1={615} y1={197} x2={615} y2={210} color={COLORS.blue} />
      <Arrow x1={615} y1={242} x2={615} y2={255} color={COLORS.blue} />
      <Arrow x1={615} y1={287} x2={615} y2={300} color={COLORS.blue} />
      <Arrow x1={615} y1={332} x2={615} y2={345} color={COLORS.blue} />
      <Arrow x1={615} y1={377} x2={615} y2={390} color={COLORS.blue} />
      <Arrow x1={615} y1={422} x2={615} y2={435} color={COLORS.blue} />
    </svg>
  );
}

export default function SaaSArchitecture() {
  const [tab, setTab] = useState("flow");
  const [activeSection, setActiveSection] = useState(null);

  return (
    <div style={{ fontFamily: "Inter, system-ui, sans-serif", backgroundColor: COLORS.bg, color: COLORS.text, minHeight: "100vh", padding: 24 }}>
      <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 4 }}>SaaS System Architecture</h1>
      <p style={{ color: COLORS.textMuted, marginBottom: 24, fontSize: 14 }}>DHR Services Platform — Current state & feature roadmap</p>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 4, marginBottom: 24, borderBottom: `1px solid ${COLORS.border}`, paddingBottom: 0 }}>
        {[
          { id: "flow", label: "App Flow" },
          { id: "current", label: "Current Features" },
          { id: "roadmap", label: "Feature Roadmap" },
          { id: "database", label: "Database Schema" },
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            style={{
              padding: "10px 20px",
              fontSize: 13,
              fontWeight: 600,
              border: "none",
              borderBottom: tab === t.id ? `2px solid ${COLORS.indigo}` : "2px solid transparent",
              backgroundColor: "transparent",
              color: tab === t.id ? COLORS.indigo : COLORS.textMuted,
              cursor: "pointer",
              fontFamily: "inherit",
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Flow Tab */}
      {tab === "flow" && (
        <div>
          <p style={{ color: COLORS.textMuted, fontSize: 13, marginBottom: 16 }}>
            Click on portal headers to highlight. Shows auth routing, role-based navigation, and screen hierarchy.
          </p>
          <div style={{ backgroundColor: COLORS.card, borderRadius: 12, padding: 20, border: `1px solid ${COLORS.border}` }}>
            <FlowDiagram activeSection={activeSection} setActiveSection={setActiveSection} />
          </div>
        </div>
      )}

      {/* Current Features Tab */}
      {tab === "current" && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 16 }}>
          {Object.entries(CURRENT_FEATURES).map(([key, section]) => (
            <div key={key} style={{ backgroundColor: COLORS.card, borderRadius: 12, padding: 20, border: `1px solid ${COLORS.border}` }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
                <div style={{ width: 12, height: 12, borderRadius: 3, backgroundColor: section.color }} />
                <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>{section.label}</h3>
              </div>
              {section.items.map((item, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 0", fontSize: 13 }}>
                  <span style={{ color: COLORS.green, fontSize: 16 }}>&#10003;</span>
                  <span>{item.name}</span>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}

      {/* Roadmap Tab */}
      {tab === "roadmap" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          {PLANNED_FEATURES.map((phase, pi) => (
            <div key={pi} style={{ backgroundColor: COLORS.card, borderRadius: 12, border: `1px solid ${COLORS.border}`, overflow: "hidden" }}>
              <div style={{ padding: "16px 20px", borderBottom: `1px solid ${COLORS.border}`, display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ width: 4, height: 24, borderRadius: 2, backgroundColor: phase.color }} />
                <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>{phase.phase}</h3>
              </div>
              <div style={{ padding: 4 }}>
                {phase.features.map((f, fi) => (
                  <div key={fi} style={{ padding: "12px 20px", borderBottom: fi < phase.features.length - 1 ? `1px solid ${COLORS.border}20` : "none" }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
                      <span style={{ fontSize: 14, fontWeight: 600 }}>{f.name}</span>
                      <PriorityBadge priority={f.priority} />
                    </div>
                    <p style={{ fontSize: 12, color: COLORS.textMuted, margin: 0, lineHeight: 1.5 }}>{f.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Database Tab */}
      {tab === "database" && (
        <div style={{ backgroundColor: COLORS.card, borderRadius: 12, border: `1px solid ${COLORS.border}`, overflow: "hidden" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr 100px", padding: "12px 20px", borderBottom: `1px solid ${COLORS.border}`, fontSize: 11, fontWeight: 700, color: COLORS.textMuted, textTransform: "uppercase", letterSpacing: 1 }}>
            <span>Table</span>
            <span>Description</span>
            <span>Status</span>
          </div>
          {DB_TABLES.map((t, i) => (
            <div key={i} style={{ display: "grid", gridTemplateColumns: "1fr 2fr 100px", padding: "12px 20px", borderBottom: i < DB_TABLES.length - 1 ? `1px solid ${COLORS.border}20` : "none", fontSize: 13 }}>
              <span style={{ fontWeight: 600, fontFamily: "monospace", color: t.exists ? COLORS.green : COLORS.textMuted }}>{t.name}</span>
              <span style={{ color: COLORS.textMuted }}>{t.desc}</span>
              <span style={{
                fontSize: 11,
                padding: "2px 10px",
                borderRadius: 999,
                backgroundColor: t.exists ? COLORS.green + "20" : COLORS.amber + "20",
                color: t.exists ? COLORS.green : COLORS.amber,
                fontWeight: 600,
                textAlign: "center",
              }}>
                {t.exists ? "Built" : "Planned"}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
