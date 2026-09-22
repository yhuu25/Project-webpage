const processCountInput = document.getElementById("processCount");
const generateButton = document.getElementById("generateButton");
const sampleButton = document.getElementById("sampleButton");
const analyzeButton = document.getElementById("analyzeButton");
const processInputBody = document.getElementById("processInputBody");
const inputError = document.getElementById("inputError");
const resultsSection = document.getElementById("resultsSection");
const resultsBody = document.getElementById("resultsBody");
const ganttChart = document.getElementById("ganttChart");
const timeAxis = document.getElementById("timeAxis");

const sampleProcesses = [
  { id: "P1", arrival: 0, burst: 7 },
  { id: "P2", arrival: 2, burst: 4 },
  { id: "P3", arrival: 4, burst: 1 },
  { id: "P4", arrival: 5, burst: 4 }
];

const ganttColors = ["#2563eb", "#7c3aed", "#0891b2", "#059669", "#db6b13", "#be185d"];

let latestProcesses = [];
let latestTimeline = [];

function showError(message) {
  inputError.textContent = message;
  inputError.hidden = false;
}

function clearError() {
  inputError.hidden = true;
  inputError.textContent = "";
}

function createProcessRows(count, values = []) {
  processInputBody.innerHTML = "";

  for (let index = 0; index < count; index += 1) {
    const process = values[index] || { id: `P${index + 1}`, arrival: index, burst: index + 2 };
    const row = document.createElement("tr");
    row.innerHTML = `
      <td><input class="process-id" type="text" value="${process.id}" aria-label="Process ${index + 1} ID"></td>
      <td><input class="arrival-time" type="number" min="0" step="1" value="${process.arrival}" aria-label="${process.id} arrival time"></td>
      <td><input class="burst-time" type="number" min="1" step="1" value="${process.burst}" aria-label="${process.id} burst time"></td>
    `;
    processInputBody.appendChild(row);
  }

  resultsSection.hidden = true;
  clearError();
}

function generateRows() {
  const count = Number(processCountInput.value);

  if (!Number.isInteger(count) || count < 1 || count > 20) {
    showError("Enter a whole number from 1 to 20 for the number of processes.");
    return;
  }

  createProcessRows(count);
}

function loadSampleData() {
  processCountInput.value = sampleProcesses.length;
  createProcessRows(sampleProcesses.length, sampleProcesses);
}

function readAndValidateProcesses() {
  const rows = [...processInputBody.querySelectorAll("tr")];
  const processes = [];
  const usedIds = new Set();

  for (let index = 0; index < rows.length; index += 1) {
    const id = rows[index].querySelector(".process-id").value.trim();
    const arrivalText = rows[index].querySelector(".arrival-time").value;
    const burstText = rows[index].querySelector(".burst-time").value;
    const arrival = Number(arrivalText);
    const burst = Number(burstText);

    if (!id) {
      throw new Error(`Process ${index + 1}: Process ID is required.`);
    }

    if (usedIds.has(id.toLowerCase())) {
      throw new Error(`Process ID "${id}" is duplicated. Use a unique ID for every process.`);
    }

    if (arrivalText === "" || !Number.isInteger(arrival) || arrival < 0) {
      throw new Error(`${id}: Arrival Time must be a whole number of 0 or greater.`);
    }

    if (burstText === "" || !Number.isInteger(burst) || burst <= 0) {
      throw new Error(`${id}: Burst Time must be a whole number greater than 0.`);
    }

    usedIds.add(id.toLowerCase());
    processes.push({ id, arrival, burst, order: index });
  }

  return processes;
}

function runNonPreemptiveSjf(inputProcesses) {
  const remaining = inputProcesses.map(process => ({ ...process }));
  const scheduled = [];
  const timeline = [];
  let currentTime = Math.min(...remaining.map(process => process.arrival));

  if (currentTime > 0) {
    timeline.push({ id: "Idle", start: 0, end: currentTime, idle: true });
  }

  while (remaining.length > 0) {
    const ready = remaining
      .filter(process => process.arrival <= currentTime)
      .sort((a, b) =>
        a.burst - b.burst ||
        a.arrival - b.arrival ||
        a.order - b.order
      );

    if (ready.length === 0) {
      const nextArrival = Math.min(...remaining.map(process => process.arrival));
      timeline.push({ id: "Idle", start: currentTime, end: nextArrival, idle: true });
      currentTime = nextArrival;
      continue;
    }

    const selected = ready[0];
    const start = currentTime;
    const completion = start + selected.burst;
    const waiting = start - selected.arrival;
    const turnaround = completion - selected.arrival;

    scheduled.push({ ...selected, start, completion, waiting, turnaround });
    timeline.push({ id: selected.id, start, end: completion, idle: false });
    currentTime = completion;

    const selectedIndex = remaining.findIndex(process => process.order === selected.order);
    remaining.splice(selectedIndex, 1);
  }

  return { scheduled, timeline };
}

function renderResults(processes) {
  resultsBody.innerHTML = "";

  [...processes]
    .sort((a, b) => a.order - b.order)
    .forEach(process => {
      const row = document.createElement("tr");
      row.innerHTML = `
        <td><strong>${process.id}</strong></td>
        <td>${process.arrival}</td>
        <td>${process.burst}</td>
        <td>${process.start}</td>
        <td>${process.completion}</td>
        <td>${process.waiting}</td>
        <td>${process.turnaround}</td>
      `;
      resultsBody.appendChild(row);
    });

  const averageWaiting = processes.reduce((sum, process) => sum + process.waiting, 0) / processes.length;
  const averageTurnaround = processes.reduce((sum, process) => sum + process.turnaround, 0) / processes.length;
  const completionTime = Math.max(...processes.map(process => process.completion));

  document.getElementById("averageWaiting").textContent = averageWaiting.toFixed(2);
  document.getElementById("averageTurnaround").textContent = averageTurnaround.toFixed(2);
  document.getElementById("completionTime").textContent = completionTime;
}

function readyQueueAt(time, activeSegment) {
  return latestProcesses
    .filter(process => {
      const hasArrived = process.arrival <= time;
      const notCompleted = process.completion > time;
      const isNotRunning = activeSegment.id !== process.id;
      return hasArrived && notCompleted && isNotRunning;
    })
    .sort((a, b) => a.burst - b.burst || a.arrival - b.arrival || a.order - b.order)
    .map(process => process.id);
}

function updateQueuePanel(segment, time) {
  const queue = readyQueueAt(time, segment);
  document.getElementById("hoverTime").textContent = time.toFixed(2).replace(/\.00$/, "");
  document.getElementById("hoverCpu").textContent = segment.id;
  document.getElementById("hoverQueue").textContent = queue.length ? queue.join(" → ") : "Empty";
}

function renderGanttChart(timeline) {
  ganttChart.innerHTML = "";
  timeAxis.innerHTML = "";

  const finalTime = timeline[timeline.length - 1].end;
  const markedTimes = new Set();

  timeline.forEach((segment, index) => {
    const duration = segment.end - segment.start;
    const block = document.createElement("button");
    block.type = "button";
    block.className = `gantt-segment${segment.idle ? " idle" : ""}`;
    block.style.flexGrow = duration;
    block.style.flexBasis = 0;
    block.style.background = segment.idle ? "" : ganttColors[index % ganttColors.length];
    block.setAttribute("aria-label", `${segment.id}, time ${segment.start} to ${segment.end}`);
    block.innerHTML = `
      <span class="segment-name">${segment.id}</span>
      <span class="segment-range">${segment.start} - ${segment.end}</span>
    `;

    const inspectPointer = event => {
      const rectangle = block.getBoundingClientRect();
      const ratio = Math.min(1, Math.max(0, (event.clientX - rectangle.left) / rectangle.width));
      const time = segment.start + ratio * duration;
      updateQueuePanel(segment, time);
    };

    block.addEventListener("mousemove", inspectPointer);
    block.addEventListener("mouseenter", event => updateQueuePanel(segment, segment.start));
    block.addEventListener("focus", () => updateQueuePanel(segment, segment.start));
    ganttChart.appendChild(block);

    [segment.start, segment.end].forEach(time => {
      if (markedTimes.has(time)) return;
      markedTimes.add(time);
      const mark = document.createElement("span");
      mark.className = "time-mark";
      mark.style.left = `${(time / finalTime) * 100}%`;
      mark.textContent = time;
      timeAxis.appendChild(mark);
    });
  });

  updateQueuePanel(timeline[0], timeline[0].start);
}

function analyzeSchedule() {
  clearError();

  try {
    const inputProcesses = readAndValidateProcesses();
    const { scheduled, timeline } = runNonPreemptiveSjf(inputProcesses);
    latestProcesses = scheduled;
    latestTimeline = timeline;
    renderResults(scheduled);
    renderGanttChart(timeline);
    resultsSection.hidden = false;
    resultsSection.scrollIntoView({ behavior: "smooth", block: "start" });
  } catch (error) {
    resultsSection.hidden = true;
    showError(error.message);
  }
}

generateButton.addEventListener("click", generateRows);
sampleButton.addEventListener("click", loadSampleData);
analyzeButton.addEventListener("click", analyzeSchedule);
processCountInput.addEventListener("keydown", event => {
  if (event.key === "Enter") generateRows();
});

loadSampleData();
