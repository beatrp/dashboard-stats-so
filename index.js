
const express = require("express");
const os = require("os");
const fs = require("fs");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

/* =========================
   Funções auxiliares
========================= */
function gb(v) {
  return (v / 1024 / 1024 / 1024).toFixed(2);
}

function mb(v) {
  return (v / 1024 / 1024).toFixed(2);
}

function percent(part, total) {
  if (!total) return "0";
  return ((part / total) * 100).toFixed(0);
}

function formatUptime(seconds) {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return `${days}d ${hours}h ${minutes}m`;
}

function getIPs() {
  const nets = os.networkInterfaces();
  const list = [];

  for (const name in nets) {
    for (const net of nets[name]) {
      list.push({
        interface: name,
        address: net.address,
        family: net.family,
        mac: net.mac,
        internal: net.internal
      });
    }
  }

  return list;
}

function getMainIP(ips) {
  const ip = ips.find(i => !i.internal && i.family === "IPv4");
  return ip ? ip.address : "N/A";
}

function getFilesDetailed() {
  try {
    return fs.readdirSync(".").slice(0, 15).map(file => {
      const stat = fs.statSync(path.join(".", file));
      return {
        name: file,
        type: stat.isDirectory() ? "Diretório" : "Arquivo",
        size: stat.isDirectory() ? "-" : `${(stat.size / 1024).toFixed(2)} KB`,
        modified: stat.mtime.toLocaleString()
      };
    });
  } catch {
    return [];
  }
}

function cpuStats() {
  return os.cpus().map((cpu, index) => {
    const t = cpu.times;
    const total = t.user + t.nice + t.sys + t.idle + t.irq;
    const used = total - t.idle;

    return {
      core: index,
      model: cpu.model,
      speed: cpu.speed,
      usage: percent(used, total)
    };
  });
}

function healthStatus(ramUsage, loadAvg, cores) {
  if (ramUsage > 85 || loadAvg > cores) {
    return { label: "CRÍTICO", color: "#ff1e1e" };
  }

  if (ramUsage > 65 || loadAvg > cores * 0.7) {
    return { label: "ATENÇÃO", color: "#ff7b00" };
  }

  return { label: "ESTÁVEL", color: "#ff003c" };
}

/* =========================
   Rota principal
========================= */
app.get("/", (req, res) => {
  const total = os.totalmem();
  const free = os.freemem();
  const used = total - free;
  const ramPercent = Number(percent(used, total));

  const cpus = cpuStats();
  const cpuCount = cpus.length;

  const avgCpu = (
    cpus.reduce((sum, c) => sum + Number(c.usage), 0) / cpuCount
  ).toFixed(0);

  const load = os.loadavg();
  const ips = getIPs();
  const mainIP = getMainIP(ips);
  const files = getFilesDetailed();

  const user = os.userInfo();
  const uptime = os.uptime();
  const health = healthStatus(ramPercent, load[0], cpuCount);

  res.send(`
<!DOCTYPE html>
<html lang="pt-br">
<head>
<meta charset="UTF-8">
<meta http-equiv="refresh" content="5">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Dark System Dashboard</title>

<style>
*{
  margin:0;
  padding:0;
  box-sizing:border-box;
}

body{
  font-family:Segoe UI, sans-serif;
  background:#070707;
  color:#f5f5f5;
  padding:30px;
  background-image:
    radial-gradient(circle at top left, rgba(255,0,60,.15), transparent 30%),
    radial-gradient(circle at bottom right, rgba(180,0,30,.12), transparent 25%);
}

header{
  margin-bottom:30px;
}

h1{
  font-size:38px;
  color:#ff003c;
  letter-spacing:2px;
  text-shadow:0 0 18px rgba(255,0,60,.45);
}

.subtitle{
  margin-top:8px;
  color:#b5b5b5;
}

.top-grid{
  display:grid;
  grid-template-columns:repeat(auto-fit,minmax(220px,1fr));
  gap:18px;
  margin-bottom:25px;
}

.grid{
  display:grid;
  grid-template-columns:repeat(auto-fit,minmax(360px,1fr));
  gap:18px;
}

.card{
  background:rgba(20,20,20,.95);
  border:1px solid rgba(255,0,60,.18);
  border-radius:20px;
  padding:22px;
  box-shadow:
    0 0 25px rgba(255,0,60,.08),
    inset 0 0 15px rgba(255,255,255,.02);
  transition:.25s ease;
}

.card:hover{
  transform:translateY(-4px);
  border-color:#ff003c;
  box-shadow:0 0 28px rgba(255,0,60,.22);
}

.card h2{
  margin-bottom:18px;
  color:#ff003c;
  font-size:22px;
}

.kpi{
  text-align:center;
}

.kpi h3{
  color:#a3a3a3;
  font-size:14px;
  letter-spacing:1px;
}

.kpi .value{
  font-size:32px;
  margin-top:12px;
  font-weight:bold;
  color:#ffffff;
}

.bar{
  width:100%;
  height:24px;
  background:#1c1c1c;
  border-radius:999px;
  overflow:hidden;
  margin-top:10px;
  border:1px solid rgba(255,255,255,.05);
}

.fill{
  height:100%;
  background:linear-gradient(90deg,#7a001d,#ff003c);
  display:flex;
  align-items:center;
  justify-content:center;
  color:white;
  font-size:12px;
  font-weight:bold;
}

.small{
  margin-top:10px;
  font-size:12px;
  color:#8b8b8b;
}

.badge{
  display:inline-block;
  padding:8px 16px;
  border-radius:999px;
  color:white;
  font-weight:bold;
  letter-spacing:1px;
  box-shadow:0 0 14px rgba(255,0,60,.35);
}

.core{
  margin-bottom:14px;
}

p{
  margin-bottom:10px;
  color:#d1d1d1;
}

strong, b{
  color:#ffffff;
}

table{
  width:100%;
  border-collapse:collapse;
  margin-top:10px;
}

th{
  background:#180008;
  color:#ff4d6d;
  padding:10px;
  text-align:left;
  border-bottom:1px solid rgba(255,0,60,.2);
}

td{
  padding:10px;
  border-bottom:1px solid rgba(255,255,255,.05);
  color:#d8d8d8;
}

tr:hover{
  background:rgba(255,0,60,.06);
}

.footer{
  text-align:center;
  margin-top:35px;
  color:#7a7a7a;
  font-size:13px;
}

.glow{
  color:#ff003c;
  text-shadow:0 0 12px rgba(255,0,60,.5);
}
</style>
</head>

<body>

<header>
  <h1>⚡ DARK SYSTEM DASHBOARD</h1>
  <div class="subtitle">
    Monitoramento avançado do sistema • Atualizado em ${new Date().toLocaleString()}
  </div>
</header>

<div class="top-grid">

  <div class="card kpi">
    <h3>USO DE RAM</h3>
    <div class="value">${ramPercent}%</div>
  </div>

  <div class="card kpi">
    <h3>CPU MÉDIA</h3>
    <div class="value">${avgCpu}%</div>
  </div>

  <div class="card kpi">
    <h3>UPTIME</h3>
    <div class="value">${formatUptime(uptime)}</div>
  </div>

  <div class="card kpi">
    <h3>IP PRINCIPAL</h3>
    <div class="value" style="font-size:18px">${mainIP}</div>
  </div>

  <div class="card kpi">
    <h3>STATUS</h3>
    <div class="value" style="font-size:18px">
      <span class="badge" style="background:${health.color}">
        ${health.label}
      </span>
    </div>
  </div>

</div>

<div class="grid">

<div class="card">
<h2>🖥️ Sistema</h2>
<p><b>Hostname:</b> ${os.hostname()}</p>
<p><b>Sistema:</b> ${os.type()}</p>
<p><b>Release:</b> ${os.release()}</p>
<p><b>Plataforma:</b> ${os.platform()}</p>
<p><b>Arquitetura:</b> ${os.arch()}</p>
<p><b>Node.js:</b> ${process.version}</p>
<p class="small">Informações principais do ambiente operacional.</p>
</div>

<div class="card">
<h2>👤 Usuário</h2>
<p><b>Usuário:</b> ${user.username}</p>
<p><b>Home:</b> ${os.homedir()}</p>
<p><b>Temp:</b> ${os.tmpdir()}</p>
<p><b>Shell:</b> ${user.shell || "N/A"}</p>
<p><b>PID:</b> ${process.pid}</p>
</div>

<div class="card">
<h2>🧠 Memória RAM</h2>
<p><b>Total:</b> ${gb(total)} GB</p>
<p><b>Usada:</b> ${gb(used)} GB</p>
<p><b>Livre:</b> ${gb(free)} GB</p>

<div class="bar">
  <div class="fill" style="width:${ramPercent}%">
    ${ramPercent}%
  </div>
</div>

<p class="small">Uso atual da memória do sistema.</p>
</div>

<div class="card">
<h2>⚙️ Processador</h2>
<p><b>Núcleos:</b> ${cpuCount}</p>
<p><b>Load Avg:</b> ${load.map(v => v.toFixed(2)).join(" | ")}</p>
<p><b>Modelo:</b> ${cpus[0].model}</p>

${cpus.map(c => `
<div class="core">
  <div>Core ${c.core} — ${c.usage}%</div>
  <div class="bar">
    <div class="fill" style="width:${c.usage}%">
      ${c.usage}%
    </div>
  </div>
</div>
`).join("")}
</div>

<div class="card">
<h2>🌐 Rede</h2>
<p><b>IP Principal:</b> ${mainIP}</p>
<p><b>Interfaces:</b> ${ips.length}</p>

<table>
<tr>
<th>Interface</th>
<th>IP</th>
<th>Família</th>
</tr>

${ips.map(ip => `
<tr>
<td>${ip.interface}</td>
<td>${ip.address}</td>
<td>${ip.family}</td>
</tr>
`).join("")}
</table>
</div>

<div class="card">
<h2>📂 Arquivos</h2>

<table>
<tr>
<th>Nome</th>
<th>Tipo</th>
<th>Tamanho</th>
</tr>

${files.map(f => `
<tr>
<td>${f.name}</td>
<td>${f.type}</td>
<td>${f.size}</td>
</tr>
`).join("")}
</table>
</div>

<div class="card">
<h2>☁️ Ambiente</h2>
<p><b>Status:</b> ${process.env.RENDER ? "Render" : "Local"}</p>
<p><b>PORT:</b> ${process.env.PORT || "3000"}</p>
<p><b>NODE_ENV:</b> ${process.env.NODE_ENV || "development"}</p>
<p><b>Executável:</b> ${process.execPath}</p>
</div>

</div>

<div class="footer">
  DARK SYSTEM DASHBOARD • DevOps • Sistemas Operacionais • Cloud Computing
</div>

</body>
</html>
  `);
});

/* =========================
   Inicialização
========================= */
app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});
```
