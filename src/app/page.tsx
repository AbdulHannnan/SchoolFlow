export default function Home() {
  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: "0.5rem",
        fontFamily: "var(--font-geist-sans), system-ui, sans-serif",
        textAlign: "center",
        padding: "2rem",
      }}
    >
      <h1 style={{ fontSize: "1.75rem", fontWeight: 600 }}>School Management</h1>
      <p style={{ color: "#666" }}>Foundation ready — Module 0.1. Next: PostgreSQL + Prisma.</p>
    </main>
  );
}
