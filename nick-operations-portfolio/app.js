const STORAGE_KEY = "northstar-ops-v1";
const AGENDA_AREAS = ["Pro Forma & Funding", "Hampton Roads Standard", "Business Agent", "Veteran Ready Website", "CR/VR File System"];
const STATUS = { decision: "Needs decision", evidence: "Evidence open", in_progress: "In motion", done: "Closed" };
const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const clone = (value) => JSON.parse(JSON.stringify(value));
let state = loadState();
let toastTimer;

function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (saved?.decisions && saved?.objectives && saved?.projects) return saved;
  } catch (error) {
    console.warn("Could not read saved data", error);
  }
  return clone(window.NORTHSTAR_STARTER_DATA);
}

function saveState(message = "Saved") {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  renderAll();
  showToast(message);
}

function showToast(message) {
  const toast = $("#toast");
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("show"), 2200);
}

function formatDate(value) {
  if (!value) return "No date";
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }).format(new Date(`${value}T00:00:00Z`));
}

function isOverdue(item) {
  if (!item.due || item.status === "done") return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return new Date(`${item.due}T00:00:00`) < today;
}

function isDecisionRecorded(item) {
  const text = (item.decisionMade || "").trim().toLowerCase();
  return item.status === "done" || (text && !text.startsWith("pending"));
}

function uniqueProjects() {
  return [...new Set(state.decisions.map((item) => item.project).filter(Boolean))].sort();
}

function filteredDecisions(filter = $("#projectFilter").value || "all") {
  return filter === "all" ? state.decisions : state.decisions.filter((item) => item.project === filter);
}

function renderFilters() {
  const projects = uniqueProjects();
  [$("#projectFilter"), $("#boardProjectFilter")].forEach((select) => {
    const previous = select.value;
    select.innerHTML = `<option value="all">All projects</option>${projects.map((project) => `<option value="${escapeHtml(project)}">${escapeHtml(project)}</option>`).join("")}`;
    select.value = projects.includes(previous) ? previous : "all";
  });
  $("#decisionAgenda").innerHTML = AGENDA_AREAS.map((area) => `<option>${escapeHtml(area)}</option>`).join("");
}

function renderDashboard() {
  const items = filteredDecisions();
  const areas = [...new Set(items.map((item) => item.agenda))];
  const decidedAreas = areas.filter((area) => items.some((item) => item.agenda === area && isDecisionRecorded(item)));
  const coverage = areas.length ? Math.round((decidedAreas.length / areas.length) * 100) : 0;
  const evidence = items.reduce((sum, item) => sum + (item.evidence?.length || 0), 0);
  const openItems = items.filter((item) => item.status !== "done");
  const ownerCoverage = openItems.length ? Math.round((openItems.filter((item) => item.owner?.trim()).length / openItems.length) * 100) : 100;
  const risk = openItems.filter((item) => isOverdue(item) || item.priority === "High" && item.progress < 35).length;
  const readiness = items.length ? Math.round(items.reduce((sum, item) => sum + Number(item.progress || 0), 0) / items.length) : 0;
  $("#metricCoverage").textContent = `${coverage}%`;
  $("#metricCoverageNote").textContent = `${decidedAreas.length} of ${areas.length} agenda areas with a recorded decision`;
  $("#metricEvidence").textContent = evidence;
  $("#metricOwners").textContent = `${ownerCoverage}%`;
  $("#metricRisk").textContent = risk;
  $("#decisionCountBadge").textContent = `${items.filter((item) => item.status === "decision").length} decisions needed`;
  $("#readinessValue").textContent = `${readiness}%`;
  $("#readinessBar span").style.width = `${readiness}%`;
  $("#readinessBar").setAttribute("aria-label", `Average workstream readiness ${readiness} percent`);
  $("#healthBars").innerHTML = AGENDA_AREAS.map((area) => {
    const group = items.filter((item) => item.agenda === area);
    const progress = group.length ? Math.round(group.reduce((sum, item) => sum + Number(item.progress || 0), 0) / group.length) : 0;
    return `<div class="health-bar"><span title="${escapeHtml(area)}">${escapeHtml(area)}</span><div class="progress-track"><span style="width:${progress}%"></span></div><b>${progress}%</b></div>`;
  }).join("");
  const gates = [...openItems].filter((item) => item.gate).sort((a, b) => (a.due || "9999").localeCompare(b.due || "9999")).slice(0, 4);
  $("#gateCount").textContent = gates.length;
  $("#upcomingGates").innerHTML = gates.length ? gates.map((item) => `<div class="gate-item ${isOverdue(item) ? "overdue" : ""}"><i aria-hidden="true"></i><div><strong>${escapeHtml(item.gate)}</strong><small>${escapeHtml(item.owner || "Owner needed")} · ${escapeHtml(item.title)}</small></div><time datetime="${item.due || ""}">${formatDate(item.due)}</time></div>`).join("") : `<div class="empty-column">No open gates in this view.</div>`;
}

function renderBoard() {
  const filter = $("#boardProjectFilter").value || "all";
  const query = $("#boardSearch").value.trim().toLowerCase();
  const items = filteredDecisions(filter).filter((item) => !query || [item.title, item.agenda, item.owner, item.gate, item.okr].join(" ").toLowerCase().includes(query));
  $("#decisionBoard").innerHTML = Object.entries(STATUS).map(([status, label]) => {
    const cards = items.filter((item) => item.status === status);
    return `<section class="board-column" data-status="${status}" aria-labelledby="column-${status}"><div class="column-heading"><h3 id="column-${status}">${label}</h3><span>${cards.length}</span></div><div class="card-stack">${cards.length ? cards.map(decisionCard).join("") : `<div class="empty-column">No items here.</div>`}</div></section>`;
  }).join("");
  $$(".decision-card").forEach((card) => card.addEventListener("click", () => openDecision(card.dataset.id)));
}

function decisionCard(item) {
  const evidenceText = item.evidence?.length ? `${item.evidence.length} fact${item.evidence.length === 1 ? "" : "s"} still needed` : "Evidence complete";
  return `<button class="decision-card" type="button" data-id="${escapeHtml(item.id)}"><div class="card-top"><span class="agenda-tag">${escapeHtml(item.agenda)}</span><i class="priority-dot ${item.priority.toLowerCase()}" title="${item.priority} priority"></i></div><h4>${escapeHtml(item.title)}</h4><div class="okr-link">${escapeHtml(item.okr || "Objective mapping needed")}</div><div class="evidence-count">${escapeHtml(evidenceText)}</div><div class="card-owner"><strong>${escapeHtml(item.owner || "Owner needed")}</strong><time class="${isOverdue(item) ? "overdue-text" : ""}" datetime="${item.due || ""}">${formatDate(item.due)}</time></div></button>`;
}

function objectiveProgress(objective) {
  return objective.krs.length ? Math.round(objective.krs.reduce((sum, kr) => sum + Number(kr.progress || 0), 0) / objective.krs.length) : 0;
}

function renderObjectives() {
  $("#objectiveGrid").innerHTML = state.objectives.map((objective) => {
    const progress = objectiveProgress(objective);
    return `<article class="objective-card"><div class="objective-card-header"><div class="progress-ring" style="--progress:${progress}" aria-label="${progress} percent complete"><strong>${progress}%</strong></div><div><span class="eyebrow">${escapeHtml(objective.timeframe)}</span><h3>${escapeHtml(objective.name)}</h3><div class="objective-meta">Owner: ${escapeHtml(objective.owner)}</div></div></div><p class="objective-why">${escapeHtml(objective.why)}</p><ol class="kr-list">${objective.krs.map((kr, index) => `<li><b>KR${index + 1}</b><span>${escapeHtml(kr.name)}</span><em>${Number(kr.progress || 0)}%</em></li>`).join("")}</ol></article>`;
  }).join("");
}

function renderPortfolio() {
  $("#portfolioGrid").innerHTML = state.projects.map((project, index) => `<article class="project-card"><header><div><span class="eyebrow">${escapeHtml(project.category)}</span><h3>${escapeHtml(project.name)}</h3></div><span class="project-index">${String(index + 1).padStart(2, "0")}</span></header><div class="project-body"><div><span>Business problem</span><p>${escapeHtml(project.challenge)}</p></div><div><span>Operating response</span><p>${escapeHtml(project.response)}</p></div></div><div class="project-proof"><div><small>Current gate</small><strong>${escapeHtml(project.gate)}</strong></div><small>${escapeHtml(project.metric)}</small></div></article>`).join("");
}

function renderAll() {
  renderFilters();
  renderDashboard();
  renderBoard();
  renderObjectives();
  renderPortfolio();
}

function showView(name) {
  $$("[data-view-panel]").forEach((view) => view.classList.toggle("active", view.dataset.viewPanel === name));
  $$("[data-view]").forEach((link) => {
    const active = link.dataset.view === name;
    link.classList.toggle("active", active);
    active ? link.setAttribute("aria-current", "page") : link.removeAttribute("aria-current");
  });
  if (location.hash !== `#${name}`) history.replaceState(null, "", `#${name}`);
}

function openDecision(id = null) {
  const item = state.decisions.find((decision) => decision.id === id);
  $("#decisionForm").reset();
  $("#decisionId").value = item?.id || "";
  $("#decisionDialogTitle").textContent = item ? "Edit decision" : "Add decision";
  $("#deleteDecisionButton").hidden = !item;
  $("#decisionTitle").value = item?.title || "";
  $("#decisionAgenda").value = item?.agenda || AGENDA_AREAS[0];
  $("#decisionProject").value = item?.project || "Veteran Ready Operating Model";
  $("#decisionOkr").value = item?.okr || "";
  $("#decisionStatus").value = item?.status || "decision";
  $("#decisionPriority").value = item?.priority || "Medium";
  $("#decisionMade").value = item?.decisionMade || "Pending";
  $("#decisionEvidence").value = item?.evidence?.join("\n") || "";
  $("#decisionOwner").value = item?.owner || "";
  $("#decisionDue").value = item?.due || "";
  $("#decisionGate").value = item?.gate || "";
  $("#decisionProgress").value = item?.progress ?? 50;
  $("#progressOutput").textContent = `${$("#decisionProgress").value}%`;
  $("#decisionDialog").showModal();
}

function saveDecision(event) {
  event.preventDefault();
  const id = $("#decisionId").value || `decision-${Date.now()}`;
  const item = {
    id,
    title: $("#decisionTitle").value.trim(),
    agenda: $("#decisionAgenda").value,
    project: $("#decisionProject").value.trim(),
    okr: $("#decisionOkr").value.trim(),
    status: $("#decisionStatus").value,
    priority: $("#decisionPriority").value,
    decisionMade: $("#decisionMade").value.trim(),
    evidence: $("#decisionEvidence").value.split("\n").map((line) => line.trim()).filter(Boolean),
    owner: $("#decisionOwner").value.trim(),
    due: $("#decisionDue").value,
    gate: $("#decisionGate").value.trim(),
    progress: Number($("#decisionProgress").value),
  };
  const existing = state.decisions.findIndex((decision) => decision.id === id);
  existing >= 0 ? state.decisions.splice(existing, 1, item) : state.decisions.push(item);
  $("#decisionDialog").close();
  saveState(existing >= 0 ? "Decision updated" : "Decision added");
}

function addProject(event) {
  event.preventDefault();
  state.projects.push({ name: $("#projectName").value.trim(), category: $("#projectCategory").value.trim(), challenge: $("#projectChallenge").value.trim(), response: $("#projectResponse").value.trim(), gate: $("#projectGate").value.trim(), metric: $("#projectMetric").value.trim() });
  $("#projectDialog").close();
  $("#projectForm").reset();
  saveState("Project added");
}

function addObjective(event) {
  event.preventDefault();
  const krs = $("#objectiveKrs").value.split("\n").map((line) => line.trim()).filter(Boolean).map((name) => ({ name, progress: 0 }));
  state.objectives.push({ id: `objective-${Date.now()}`, name: $("#objectiveName").value.trim(), timeframe: $("#objectiveTimeframe").value.trim(), owner: $("#objectiveOwner").value.trim(), why: $("#objectiveWhy").value.trim(), krs });
  $("#objectiveDialog").close();
  $("#objectiveForm").reset();
  saveState("Objective added");
}

function exportBackup() {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `northstar-ops-backup-${new Date().toISOString().slice(0, 10)}.json`;
  link.click();
  URL.revokeObjectURL(url);
  showToast("Backup downloaded");
}

async function importBackup(event) {
  const file = event.target.files[0];
  if (!file) return;
  try {
    const incoming = JSON.parse(await file.text());
    if (!Array.isArray(incoming.decisions) || !Array.isArray(incoming.objectives) || !Array.isArray(incoming.projects)) throw new Error("Invalid backup");
    state = incoming;
    saveState("Backup restored");
  } catch (error) {
    showToast("That file is not a Northstar Ops backup");
  }
  event.target.value = "";
}

function togglePortfolioMode(enabled = !document.body.classList.contains("presentation-mode")) {
  document.body.classList.toggle("presentation-mode", enabled);
  $("#exitPortfolioMode").hidden = !enabled;
  if (enabled) showView("portfolio");
}

function escapeHtml(value = "") {
  return String(value).replace(/[&<>'"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[character]);
}

$$('[data-close-dialog]').forEach((button) => button.addEventListener("click", () => $(`#${button.dataset.closeDialog}`).close()));
$$('[data-view]').forEach((link) => link.addEventListener("click", (event) => { event.preventDefault(); showView(link.dataset.view); }));
$("#newDecisionButton").addEventListener("click", () => openDecision());
$("#newProjectButton").addEventListener("click", () => $("#projectDialog").showModal());
$("#newObjectiveButton").addEventListener("click", () => $("#objectiveDialog").showModal());
$("#decisionForm").addEventListener("submit", saveDecision);
$("#projectForm").addEventListener("submit", addProject);
$("#objectiveForm").addEventListener("submit", addObjective);
$("#decisionProgress").addEventListener("input", (event) => $("#progressOutput").textContent = `${event.target.value}%`);
$("#projectFilter").addEventListener("change", renderDashboard);
$("#boardProjectFilter").addEventListener("change", renderBoard);
$("#boardSearch").addEventListener("input", renderBoard);
$("#dataToolsButton").addEventListener("click", () => {
  const menu = $("#dataToolsMenu");
  menu.hidden = !menu.hidden;
  $("#dataToolsButton").setAttribute("aria-expanded", String(!menu.hidden));
});
$("#exportButton").addEventListener("click", exportBackup);
$("#importInput").addEventListener("change", importBackup);
$("#resetButton").addEventListener("click", () => {
  if (!confirm("Reset all local edits and restore the starter data?")) return;
  state = clone(window.NORTHSTAR_STARTER_DATA);
  saveState("Starter data restored");
});
$("#deleteDecisionButton").addEventListener("click", () => {
  const id = $("#decisionId").value;
  if (!id || !confirm("Delete this decision record?")) return;
  state.decisions = state.decisions.filter((item) => item.id !== id);
  $("#decisionDialog").close();
  saveState("Decision deleted");
});
$("#portfolioModeButton").addEventListener("click", () => togglePortfolioMode(true));
$("#exitPortfolioMode").addEventListener("click", () => togglePortfolioMode(false));

document.addEventListener("click", (event) => {
  const menu = $("#dataToolsMenu");
  if (!menu.hidden && !menu.contains(event.target) && event.target !== $("#dataToolsButton")) {
    menu.hidden = true;
    $("#dataToolsButton").setAttribute("aria-expanded", "false");
  }
});

document.addEventListener("keydown", (event) => {
  if (["INPUT", "TEXTAREA", "SELECT"].includes(document.activeElement.tagName)) return;
  const map = { "1": "dashboard", "2": "board", "3": "objectives", "4": "portfolio" };
  if (map[event.key]) showView(map[event.key]);
});

const params = new URLSearchParams(location.search);
const requestedView = params.get("view") || location.hash.slice(1);
renderAll();
showView(["dashboard", "board", "objectives", "portfolio"].includes(requestedView) ? requestedView : "dashboard");
if (params.get("mode") === "portfolio") togglePortfolioMode(true);
