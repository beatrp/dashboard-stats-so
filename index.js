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
    return fs.readdirSync(".").slice(0, 20).map(file => {
      const stat = fs.statSync(path.join(".", file));
      return {
        name: file,
        type: stat.isDirectory() ? "Dir" : "Arquivo",
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
      usage: percent(used, total),
      idle: t.idle
    };
  });
}

function healthStatus(ramUsage, loadAvg, cores) {
  if (ramUsage > 85 || loadAvg > cores) {
    return { label: "ALTO USO", color: "#ef4444" };
  }

  if (ramUsage > 65 || loadAvg > cores * 0.7) {
    return { label: "ATENÇÃO", color: "#f59e0b" };
  }

  return { label: "NORMAL", color: "#22c55e" };
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
<html>
<head>
<meta charset="UTF-8">
<meta http-equiv="refresh" content="5">
<title>SO Dashboard</title>

<style>

*{
  box-sizing:border-box;
}

body{
  font-family:Arial, sans-serif;
  background:
    radial-gradient(circle at top, #3b000a 0%, #140005 45%, #080808 100%);
  color:#f3f3f3;

  margin:0;
  padding:32px;

  min-height:100vh;
}

/* =========================
   TITULOS
========================= */

h1{
  text-align:center;
  margin:0 0 10px;

  font-size:42px;
  font-weight:800;
  letter-spacing:1px;

  color:#ff4d6d;

  text-shadow:
    0 0 12px rgba(255,0,80,.35),
    0 0 25px rgba(255,0,60,.18);
}

.subtitle{
  text-align:center;
  color:#c9b6bb;

  margin-bottom:35px;
  font-size:15px;
}

h2{
  margin:0 0 22px;
  font-size:22px;
  color:#ff5c7c;

  border-bottom:1px solid rgba(255,255,255,.08);
  padding-bottom:12px;
}

/* =========================
   GRID
========================= */

.grid{
  display:grid;
  grid-template-columns:repeat(auto-fit,minmax(360px,1fr));
  gap:24px;
}

.top-grid{
  display:grid;
  grid-template-columns:repeat(auto-fit,minmax(210px,1fr));
  gap:20px;

  margin-bottom:30px;
}

/* =========================
   CARDS
========================= */

.card{
  background:rgba(20,20,20,.92);

  border:1px solid rgba(255,0,80,.15);
  border-radius:22px;

  padding:24px;

  box-shadow:
    0 0 20px rgba(255,0,70,.08),
    0 8px 24px rgba(0,0,0,.45);

  backdrop-filter:blur(5px);

  transition:.25s ease;
}

.card:hover{
  transform:translateY(-3px);

  box-shadow:
    0 0 28px rgba(255,0,70,.16),
    0 12px 30px rgba(0,0,0,.55);
}

/* =========================
   KPI
========================= */

.kpi{
  text-align:center;
  padding:28px 20px;
}

.kpi h3{
  margin:0;
  font-size:14px;
  letter-spacing:1px;
  text-transform:uppercase;

  color:#ff96aa;
}

.kpi .value{
  font-size:34px;
  font-weight:800;

  margin-top:14px;
  color:#fff;
}

/* =========================
   TEXTOS
========================= */

p{
  margin:0 0 14px;
  line-height:1.7;
  color:#dddddd;
}

strong,
b{
  color:#ffffff;
}

.small{
  margin-top:16px;
  color:#a79ba0;
  font-size:13px;
  line-height:1.6;
}

/* =========================
   BARRAS
========================= */

.bar{
  background:#262626;

  height:28px;
  border-radius:999px;

  overflow:hidden;

  margin-top:14px;
  margin-bottom:20px;

  border:1px solid rgba(255,255,255,.05);
}

.fill{
  background:
    linear-gradient(
      90deg,
      #6b0015,
      #b3002d,
      #ff1f57
    );

  height:100%;

  display:flex;
  align-items:center;
  justify-content:center;

  color:#fff;
  font-size:13px;
  font-weight:bold;

  box-shadow:0 0 14px rgba(255,0,80,.35);
}

/* =========================
   CPU CORE
========================= */

.core{
  margin-bottom:24px;
}

.core:last-child{
  margin-bottom:0;
}

/* =========================
   TABELAS
========================= */

table{
  width:100%;
  border-collapse:collapse;
  margin-top:10px;
}

th{
  color:#ff7b98;

  font-size:13px;
  font-weight:700;

  padding:14px 10px;

  border-bottom:1px solid rgba(255,255,255,.12);

  text-align:left;
}

td{
  color:#e5e5e5;

  padding:14px 10px;

  border-bottom:1px solid rgba(255,255,255,.06);

  font-size:14px;
}

tr:hover{
  background:rgba(255,255,255,.03);
}

/* =========================
   BADGE
========================= */

.badge{
  display:inline-flex;
  align-items:center;
  justify-content:center;

  padding:10px 18px;

  border-radius:999px;

  color:#fff;
  font-weight:700;
  font-size:12px;
  letter-spacing:1px;

  background:
    linear-gradient(
      135deg,
      #650012,
      #c4002f
    );

  border:1px solid #ff4068;

  box-shadow:
    0 0 14px rgba(255,0,60,.35);
}

/* =========================
   FOOTER
========================= */

.footer{
  text-align:center;

  color:#96898e;

  margin-top:40px;
  padding-top:18px;

  font-size:13px;

  border-top:1px solid rgba(255,255,255,.06);
}

/* =========================
   RESPONSIVO
========================= */

@media(max-width:768px){

  body{
    padding:18px;
  }

  h1{
    font-size:32px;
  }

  .grid{
    grid-template-columns:1fr;
  }

  .top-grid{
    grid-template-columns:1fr 1fr;
  }

  .card{
    padding:20px;
  }

}

</style>
</head>

<body>

<h1>🖥️ SO Dashboard 3.0</h1>
<div class="subtitle">
Atualizado em ${new Date().toLocaleString()}
</div>

<!-- KPIs -->
<div class="top-grid">

  <div class="card kpi">
    <h3>RAM</h3>
    <div class="value">${ramPercent}%</div>
  </div>

  <div class="card kpi">
    <h3>CPU Média</h3>
    <div class="value">${avgCpu}%</div>
  </div>

  <div class="card kpi">
    <h3>Uptime</h3>
    <div class="value">${formatUptime(uptime)}</div>
  </div>

  <div class="card kpi">
    <h3>Arquivos</h3>
    <div class="value">${files.length}</div>
  </div>

  <div class="card kpi">
    <h3>IP Principal</h3>
    <div class="value" style="font-size:18px">${mainIP}</div>
  </div>

  <div class="card kpi">
    <h3>Status</h3>
    <div class="value" style="font-size:18px">
      <span class="badge" style="background:${health.color}">
        ${health.label}
      </span>
    </div>
  </div>

</div>

<div class="grid">

<!-- Sistema -->
<div class="card">
<h2>📌 Sistema</h2>
<p><b>Host:</b> ${os.hostname()}</p>
<p><b>SO:</b> ${os.type()}</p>
<p><b>Release:</b> ${os.release()}</p>
<p><b>Plataforma:</b> ${os.platform()}</p>
<p><b>Arquitetura:</b> ${os.arch()}</p>
<p><b>Endianness:</b> ${os.endianness()}</p>
<p><b>Node:</b> ${process.version}</p>
<p class="small">Hostname = nome da máquina</p>
</div>

<!-- Usuário -->
<div class="card">
<h2>👤 Usuário</h2>
<p><b>Usuário:</b> ${user.username}</p>
<p><b>Home:</b> ${os.homedir()}</p>
<p><b>Temp:</b> ${os.tmpdir()}</p>
<p><b>Shell:</b> ${user.shell || "N/A"}</p>
<p><b>UID:</b> ${process.getuid ? process.getuid() : "N/A"}</p>
<p><b>GID:</b> ${process.getgid ? process.getgid() : "N/A"}</p>
</div>

<!-- Memória -->
<div class="card">
<h2>🧠 Memória RAM</h2>
<p><b>Total:</b> ${gb(total)} GB</p>
<p><b>Usada:</b> ${gb(used)} GB</p>
<p><b>Livre:</b> ${gb(free)} GB</p>
<p><b>Por CPU:</b> ${(total / cpuCount / 1024 / 1024 / 1024).toFixed(2)} GB</p>

<div class="bar">
  <div class="fill" style="width:${ramPercent}%">
    ${ramPercent}%
  </div>
</div>

<p class="small">RAM = memória principal usada pelos processos</p>
</div>

<!-- CPU -->
<div class="card">
<h2>⚙️ CPU</h2>
<p><b>Núcleos:</b> ${cpuCount}</p>
<p><b>Modelo:</b> ${cpus[0].model}</p>
<p><b>Load Avg:</b> ${load.map(v => v.toFixed(2)).join(" | ")}</p>
<p class="small">Load Avg = processos aguardando CPU</p>

${cpus.map(c => `
<div class="core">
  <div>Core ${c.core} - ${c.usage}%</div>
  <div class="bar">
    <div class="fill" style="width:${c.usage}%">
      ${c.usage}%
    </div>
  </div>
</div>
`).join("")}
</div>

<!-- Rede -->
<div class="card">
<h2>🌐 Rede</h2>
<p><b>IP Principal:</b> ${mainIP}</p>
<p><b>Interfaces:</b> ${ips.length}</p>

<table>
<tr>
<th>IF</th>
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

<!-- Arquivos -->
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

<!-- Tempo -->
<div class="card">
<h2>⏰ Tempo</h2>
<p><b>Uptime:</b> ${formatUptime(uptime)}</p>
<p><b>Timezone:</b> ${Intl.DateTimeFormat().resolvedOptions().timeZone}</p>
<p><b>ISO:</b> ${new Date().toISOString()}</p>
<p class="small">Uptime = tempo desde inicialização</p>
</div>

<!-- Processo -->
<div class="card">
<h2>🔐 Aplicação</h2>
<p><b>PID:</b> ${process.pid}</p>
<p><b>Diretório:</b> ${process.cwd()}</p>
<p><b>Memória Node:</b> ${mb(process.memoryUsage().rss)} MB</p>
<p><b>Exec Path:</b> ${process.execPath}</p>
</div>

<!-- Cloud -->
<div class="card">
<h2>☁️ Ambiente</h2>
<p><b>Status:</b> ${process.env.RENDER ? "Executando no Render" : "Executando Localmente"}</p>
<p><b>PORT:</b> ${process.env.PORT || "3000"}</p>
<p><b>NODE_ENV:</b> ${process.env.NODE_ENV || "development"}</p>
<p><b>Kernel AWS:</b> ${os.release().includes("aws") ? "Sim" : "Não"}</p>
</div>

</div>

<div class="footer">
SO Dashboard • Sistemas Operacionais + Cloud Computing
</div>

</body>
</html>
  `);
});

/* =========================
   Inicialização
========================= */
app.listen(PORT, () => {
  console.log("Servidor rodando na porta " + PORT);
});
