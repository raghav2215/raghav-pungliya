* {
  box-sizing: border-box;
}

:root {
  --bg: #091a1f;
  --panel: #122a32;
  --panel-2: #163642;
  --success: #2ecc71;
  --warning: #f5b700;
  --danger: #ff5f57;
  --primary: #1ec7b5;
  --text: #ebf7ff;
  --muted: #a7c6d8;
  --border: rgba(255,255,255,0.08);
}

body {
  margin: 0;
  font-family: Inter, 'Segoe UI', sans-serif;
  background: linear-gradient(135deg, #06181d, #102d37 40%, #091a1f);
  color: var(--text);
}

button,
input,
select {
  font: inherit;
}

.hidden {
  display: none !important;
}

#appShell {
  min-height: 100vh;
}

#loginScreen {
  min-height: 100vh;
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 24px;
}

.login-card {
  width: min(480px, 100%);
  background: rgba(18, 42, 50, 0.9);
  border: 1px solid var(--border);
  border-radius: 20px;
  padding: 32px;
  box-shadow: 0 16px 40px rgba(0,0,0,0.2);
}

.brand-box {
  text-align: center;
  margin-bottom: 24px;
}

.brand-badge {
  width: 72px;
  height: 72px;
  margin: 0 auto 14px;
  background: linear-gradient(135deg, var(--primary), #5eead4);
  color: #06181d;
  border-radius: 18px;
  display: grid;
  place-items: center;
  font-size: 2rem;
  font-weight: 700;
}

.brand-box h1 {
  margin: 0;
  font-size: clamp(1.7rem, 4vw, 2.5rem);
}

.brand-box p {
  margin: 8px 0 0;
  color: var(--muted);
}

#loginForm,
.inline-form,
.grid-form {
  display: grid;
  gap: 14px;
}

label {
  display: grid;
  gap: 8px;
  color: var(--muted);
}

input,
select,
button {
  border-radius: 12px;
  border: 1px solid var(--border);
}

input,
select {
  background: rgba(255,255,255,0.02);
  color: var(--text);
  padding: 12px 14px;
}

button {
  background: linear-gradient(135deg, var(--primary), #51d1c1);
  color: #062228;
  border: none;
  padding: 12px 18px;
  cursor: pointer;
  font-weight: 700;
}

.secondary-btn {
  background: rgba(255,255,255,0.05);
  color: var(--text);
  border: 1px solid var(--border);
}

#mainApp {
  max-width: 1400px;
  margin: 0 auto;
  padding: 20px;
}

.topbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 20px;
  padding: 18px 20px;
  background: rgba(18,42,50,0.8);
  border: 1px solid var(--border);
  border-radius: 16px;
  margin-bottom: 20px;
}

.topbar h2 {
  margin: 0;
}

.topbar-actions {
  display: flex;
  align-items: center;
  gap: 12px;
}

.main-nav {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-bottom: 20px;
}

.nav-button {
  background: rgba(255,255,255,0.04);
  color: var(--text);
  border: 1px solid var(--border);
}

.nav-button.active {
  background: linear-gradient(135deg, #1ec7b5, #59d9c0);
  color: #041b20;
}

.page {
  display: none;
}

.page.active {
  display: block;
}

.section-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 16px;
  margin-bottom: 18px;
}

.dashboard-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 16px;
  margin-bottom: 18px;
}

.stat-card,
.panel {
  background: rgba(18,42,50,0.9);
  border: 1px solid var(--border);
  border-radius: 16px;
  padding: 18px;
}

.stat-card {
  display: grid;
  gap: 8px;
}

.stat-card .label {
  color: var(--muted);
  font-size: 0.85rem;
  text-transform: uppercase;
  letter-spacing: 0.08em;
}

.stat-card .value {
  font-size: clamp(1.4rem, 2vw, 2rem);
  font-weight: 700;
}

.message {
  min-height: 22px;
  margin-top: 14px;
  color: var(--warning);
}

.table-panel {
  overflow: auto;
}

table {
  width: 100%;
  border-collapse: collapse;
  margin-top: 12px;
}

th,
td {
  padding: 12px 10px;
  text-align: left;
  border-bottom: 1px solid var(--border);
}

th {
  color: var(--muted);
  font-weight: 600;
}

.badge {
  padding: 6px 10px;
  border-radius: 999px;
  display: inline-block;
  font-size: 0.75rem;
  font-weight: 700;
}

.badge.green {
  background: rgba(46,204,113,0.18);
  color: var(--success);
}

.badge.orange {
  background: rgba(245,183,0,0.18);
  color: var(--warning);
}

.badge.red {
  background: rgba(255,95,87,0.18);
  color: var(--danger);
}

.grid-form {
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
}

.inline-form {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
}

.ai-list {
  display: grid;
  gap: 12px;
}

.ai-item {
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 14px;
  background: rgba(255,255,255,0.02);
}

.ai-item h5 {
  margin: 0 0 6px;
}

.report-box {
  display: grid;
  gap: 16px;
}

@media (max-width: 720px) {
  #mainApp {
    padding: 12px;
  }

  .topbar,
  .section-head {
    flex-direction: column;
    align-items: flex-start;
  }
}
