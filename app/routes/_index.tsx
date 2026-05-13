import { Link } from "@remix-run/react";
import type { MetaFunction } from "@remix-run/node";

export const meta: MetaFunction = () => {
  return [
    { title: "SyncBridge — eBay ↔ Shopify Inventory Sync" },
    {
      name: "description",
      content:
        "Keep your eBay and Shopify inventory in sync with bidirectional synchronization. Lowest-stock-wins conflict resolution prevents overselling.",
    },
  ];
};

const FEATURES = [
  {
    icon: "🔄",
    title: "Bidirectional Sync",
    desc: "Inventory changes on eBay are reflected in Shopify and vice versa. No more manual updates or spreadsheet tracking across platforms.",
  },
  {
    icon: "🛡️",
    title: "Lowest Stock Wins",
    desc: "When quantities differ, the lower value is applied to both platforms. This prevents overselling — if eBay shows 3 and Shopify shows 7, both become 3.",
  },
  {
    icon: "⏱️",
    title: "Automatic Every 15 Minutes",
    desc: "A BullMQ job queue with Redis runs periodic syncs automatically. You can also trigger manual syncs instantly from the dashboard.",
  },
  {
    icon: "📦",
    title: "Initial Bulk Import",
    desc: "Import all your eBay listings into Shopify with one click. Products, variants, images, and pricing are all transferred with rate-limit protection.",
  },
  {
    icon: "🔐",
    title: "Encrypted Credentials",
    desc: "eBay API keys are encrypted at rest with AES-256-GCM. Supports both legacy Auth'n'Auth tokens and modern OAuth 2.0 with auto-refresh.",
  },
  {
    icon: "🔔",
    title: "Webhook-Driven",
    desc: "Shopify orders and inventory changes trigger immediate syncs via webhooks, so stock levels update within seconds of a sale.",
  },
];

const STEPS = [
  {
    title: "Connect Your Accounts",
    desc: "Enter your eBay Developer credentials (or authorize via OAuth 2.0) and install the app on your Shopify store. All credentials are AES-256-GCM encrypted at rest.",
  },
  {
    title: "Import Your eBay Listings",
    desc: "Run a one-time bulk import to create Shopify products for every eBay listing. SKU mappings are created automatically, linking each eBay item to its Shopify variant.",
  },
  {
    title: "Sync Runs Automatically",
    desc: "The sync engine compares inventory levels every 15 minutes and applies the lowest-stock-wins rule. Webhooks also trigger instant syncs on new orders.",
  },
];

export default function LandingPage() {
  return (
    <div style={styles.body}>
      {/* Nav */}
      <nav style={styles.nav}>
        <div style={styles.navInner}>
          <div style={styles.logo}>
            <span style={styles.logoIcon}>⟲</span>
            <span style={styles.logoText}>SyncBridge</span>
          </div>
          <div style={styles.navLinks}>
            <a href="#features" style={styles.navLink}>
              Features
            </a>
            <a href="#how-it-works" style={styles.navLink}>
              How It Works
            </a>
            <a href="#demo" style={styles.navLink}>
              Demo
            </a>
            <Link to="/demo" style={styles.ctaNavButton}>
              Try Demo →
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section style={styles.hero}>
        <div style={styles.heroInner}>
          <div style={styles.heroBadge}>
            <span style={styles.heroBadgeDot} /> Open Source
          </div>
          <h1 style={styles.heroTitle}>
            eBay & Shopify
            <br />
            <span style={styles.heroTitleAccent}>Inventory Sync</span>
          </h1>
          <p style={styles.heroSubtitle}>
            Keep your inventory perfectly synchronized between eBay and Shopify.
            Bidirectional sync with lowest-stock-wins conflict resolution
            prevents overselling across both platforms — automatically, every 15
            minutes.
          </p>
          <div style={styles.heroButtons}>
            <Link to="/demo" style={styles.primaryButton}>
              Launch Demo Dashboard
            </Link>
            <a href="#how-it-works" style={styles.secondaryButton}>
              See How It Works ↓
            </a>
          </div>
          <div style={styles.heroStats}>
            <div style={styles.heroStat}>
              <span style={styles.heroStatNumber}>15min</span>
              <span style={styles.heroStatLabel}>Auto-sync interval</span>
            </div>
            <div style={styles.heroStatDivider} />
            <div style={styles.heroStat}>
              <span style={styles.heroStatNumber}>2-way</span>
              <span style={styles.heroStatLabel}>Bidirectional sync</span>
            </div>
            <div style={styles.heroStatDivider} />
            <div style={styles.heroStat}>
              <span style={styles.heroStatNumber}>0</span>
              <span style={styles.heroStatLabel}>Overselling risk</span>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" style={styles.features}>
        <div style={styles.sectionInner}>
          <h2 style={styles.sectionTitle}>Built for Multi-Platform Sellers</h2>
          <p style={styles.sectionSubtitle}>
            Everything you need to sell on both eBay and Shopify without worrying
            about inventory conflicts.
          </p>
          <div style={styles.featureGrid}>
            {FEATURES.map((f, i) => (
              <div key={i} style={styles.featureCard}>
                <div style={styles.featureIcon}>{f.icon}</div>
                <h3 style={styles.featureTitle}>{f.title}</h3>
                <p style={styles.featureDesc}>{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section id="how-it-works" style={styles.howItWorks}>
        <div style={styles.sectionInner}>
          <h2 style={styles.sectionTitle}>How It Works</h2>
          <p style={styles.sectionSubtitle}>
            Three simple steps to keep your inventory in perfect harmony.
          </p>
          <div style={styles.stepsGrid}>
            {STEPS.map((s, i) => (
              <div key={i} style={styles.stepCard}>
                <div style={styles.stepNumber}>{i + 1}</div>
                <h3 style={styles.stepTitle}>{s.title}</h3>
                <p style={styles.stepDesc}>{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Demo CTA */}
      <section id="demo" style={styles.demoSection}>
        <div style={styles.sectionInner}>
          <div style={styles.demoCard}>
            <h2 style={styles.demoTitle}>
              Try It Now — No Setup Required
            </h2>
            <p style={styles.demoDesc}>
              The interactive demo works entirely in your browser with simulated
              eBay and Shopify data. Trigger orders, watch quantity mismatches
              appear, then run a sync to see the lowest-stock-wins logic resolve
              them in real time. No database, no API keys, no deployment needed.
            </p>
            <div style={styles.demoFeatures}>
              <span style={styles.demoFeatureBadge}>20 realistic products</span>
              <span style={styles.demoFeatureBadge}>Simulated orders</span>
              <span style={styles.demoFeatureBadge}>Live sync engine</span>
              <span style={styles.demoFeatureBadge}>Error simulation</span>
            </div>
            <Link to="/demo" style={styles.primaryButtonLarge}>
              Enter Demo Dashboard →
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer style={styles.footer}>
        <div style={styles.sectionInner}>
          <div style={styles.footerInner}>
            <div style={styles.logo}>
              <span style={styles.logoIcon}>⟲</span>
              <span style={styles.logoText}>SyncBridge</span>
            </div>
            <p style={styles.footerText}>
              eBay ↔ Shopify Inventory Sync — Open Source
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  body: {
    minHeight: "100vh",
    background: "#0a0a0a",
    color: "#e5e5e5",
    fontFamily:
      "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    lineHeight: 1.6,
  },
  nav: {
    position: "fixed",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 50,
    background: "rgba(10,10,10,0.85)",
    backdropFilter: "blur(12px)",
    borderBottom: "1px solid rgba(255,255,255,0.06)",
  },
  navInner: {
    maxWidth: 1200,
    margin: "0 auto",
    padding: "0 24px",
    height: 64,
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
  },
  logo: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    textDecoration: "none",
  },
  logoIcon: { fontSize: 28, color: "#6366f1" },
  logoText: {
    fontSize: 20,
    fontWeight: 700,
    color: "#fff",
    letterSpacing: -0.5,
  },
  navLinks: { display: "flex", alignItems: "center", gap: 32 },
  navLink: {
    color: "#a1a1aa",
    textDecoration: "none",
    fontSize: 14,
    fontWeight: 500,
    transition: "color 0.2s",
  },
  ctaNavButton: {
    color: "#fff",
    background: "#6366f1",
    padding: "8px 18px",
    borderRadius: 8,
    textDecoration: "none",
    fontSize: 14,
    fontWeight: 600,
    transition: "background 0.2s",
  },
  hero: {
    paddingTop: 160,
    paddingBottom: 100,
    textAlign: "center",
  },
  heroInner: { maxWidth: 800, margin: "0 auto", padding: "0 24px" },
  heroBadge: {
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    background: "rgba(99,102,241,0.12)",
    border: "1px solid rgba(99,102,241,0.25)",
    padding: "6px 16px",
    borderRadius: 100,
    fontSize: 13,
    fontWeight: 600,
    color: "#a5b4fc",
    marginBottom: 28,
  },
  heroBadgeDot: {
    width: 8,
    height: 8,
    borderRadius: "50%",
    background: "#6366f1",
    display: "inline-block",
  },
  heroTitle: {
    fontSize: 56,
    fontWeight: 800,
    lineHeight: 1.1,
    letterSpacing: -2,
    margin: "0 0 24px",
    color: "#fff",
  },
  heroTitleAccent: {
    background: "linear-gradient(135deg, #6366f1, #8b5cf6, #a78bfa)",
    WebkitBackgroundClip: "text",
    WebkitTextFillColor: "transparent",
  },
  heroSubtitle: {
    fontSize: 18,
    color: "#a1a1aa",
    maxWidth: 600,
    margin: "0 auto 40px",
    lineHeight: 1.7,
  },
  heroButtons: {
    display: "flex",
    gap: 16,
    justifyContent: "center",
    flexWrap: "wrap",
  },
  primaryButton: {
    display: "inline-block",
    background: "#6366f1",
    color: "#fff",
    padding: "14px 32px",
    borderRadius: 10,
    fontSize: 16,
    fontWeight: 600,
    textDecoration: "none",
    transition: "background 0.2s",
    boxShadow: "0 4px 24px rgba(99,102,241,0.35)",
  },
  secondaryButton: {
    display: "inline-block",
    background: "rgba(255,255,255,0.06)",
    border: "1px solid rgba(255,255,255,0.1)",
    color: "#e5e5e5",
    padding: "14px 32px",
    borderRadius: 10,
    fontSize: 16,
    fontWeight: 600,
    textDecoration: "none",
    transition: "background 0.2s",
  },
  primaryButtonLarge: {
    display: "inline-block",
    background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
    color: "#fff",
    padding: "16px 40px",
    borderRadius: 12,
    fontSize: 18,
    fontWeight: 700,
    textDecoration: "none",
    transition: "transform 0.2s, box-shadow 0.2s",
    boxShadow: "0 4px 32px rgba(99,102,241,0.4)",
  },
  heroStats: {
    display: "flex",
    justifyContent: "center",
    gap: 40,
    marginTop: 64,
    paddingTop: 40,
    borderTop: "1px solid rgba(255,255,255,0.06)",
  },
  heroStat: { textAlign: "center" },
  heroStatNumber: {
    display: "block",
    fontSize: 32,
    fontWeight: 800,
    color: "#fff",
  },
  heroStatLabel: {
    display: "block",
    fontSize: 14,
    color: "#71717a",
    marginTop: 4,
  },
  heroStatDivider: {
    width: 1,
    background: "rgba(255,255,255,0.06)",
    alignSelf: "stretch",
  },
  features: {
    padding: "100px 0",
    background: "#111",
  },
  sectionInner: { maxWidth: 1200, margin: "0 auto", padding: "0 24px" },
  sectionTitle: {
    fontSize: 40,
    fontWeight: 800,
    textAlign: "center",
    letterSpacing: -1.5,
    margin: "0 0 16px",
    color: "#fff",
  },
  sectionSubtitle: {
    fontSize: 18,
    color: "#71717a",
    textAlign: "center",
    maxWidth: 560,
    margin: "0 auto 64px",
  },
  featureGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))",
    gap: 24,
  },
  featureCard: {
    background: "rgba(255,255,255,0.03)",
    border: "1px solid rgba(255,255,255,0.06)",
    borderRadius: 16,
    padding: 32,
    transition: "border-color 0.3s, background 0.3s",
  },
  featureIcon: { fontSize: 36, marginBottom: 16 },
  featureTitle: {
    fontSize: 20,
    fontWeight: 700,
    margin: "0 0 12px",
    color: "#fff",
  },
  featureDesc: { fontSize: 15, color: "#a1a1aa", lineHeight: 1.7, margin: 0 },
  howItWorks: { padding: "100px 0" },
  stepsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
    gap: 32,
  },
  stepCard: {
    background: "rgba(99,102,241,0.06)",
    border: "1px solid rgba(99,102,241,0.15)",
    borderRadius: 16,
    padding: 36,
    textAlign: "center",
  },
  stepNumber: {
    width: 48,
    height: 48,
    borderRadius: 14,
    background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
    color: "#fff",
    fontSize: 22,
    fontWeight: 800,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    margin: "0 auto 20px",
    lineHeight: "48px",
  },
  stepTitle: {
    fontSize: 20,
    fontWeight: 700,
    margin: "0 0 12px",
    color: "#fff",
  },
  stepDesc: { fontSize: 15, color: "#a1a1aa", lineHeight: 1.7, margin: 0 },
  demoSection: { padding: "100px 0", background: "#111" },
  demoCard: {
    background:
      "linear-gradient(135deg, rgba(99,102,241,0.1), rgba(139,92,246,0.05))",
    border: "1px solid rgba(99,102,241,0.2)",
    borderRadius: 24,
    padding: "64px 48px",
    textAlign: "center",
    maxWidth: 720,
    margin: "0 auto",
  },
  demoTitle: {
    fontSize: 36,
    fontWeight: 800,
    color: "#fff",
    margin: "0 0 16px",
  },
  demoDesc: {
    fontSize: 16,
    color: "#a1a1aa",
    lineHeight: 1.7,
    maxWidth: 520,
    margin: "0 auto 28px",
  },
  demoFeatures: {
    display: "flex",
    flexWrap: "wrap",
    gap: 10,
    justifyContent: "center",
    marginBottom: 36,
  },
  demoFeatureBadge: {
    background: "rgba(255,255,255,0.06)",
    border: "1px solid rgba(255,255,255,0.08)",
    padding: "6px 14px",
    borderRadius: 100,
    fontSize: 13,
    fontWeight: 500,
    color: "#d4d4d8",
  },
  footer: {
    padding: "40px 0",
    borderTop: "1px solid rgba(255,255,255,0.06)",
  },
  footerInner: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
  },
  footerText: { fontSize: 14, color: "#52525b", margin: 0 },
};
