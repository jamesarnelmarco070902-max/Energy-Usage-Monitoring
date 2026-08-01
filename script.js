/* ==========================================================
   Energy Usage Monitoring App
   ========================================================== */

"use strict";

/* ==========================================================
   Configuration
   ========================================================== */

const APP_CONFIG = {
    storageKey: "energy-monitor-data",
    settingsKey: "energy-monitor-settings",
    statsInterval: 5000,
    version: "2.0.0"
};

/* ==========================================================
   Default Data
   ========================================================== */

const DEFAULT_DEVICES = [
    {
        id: crypto.randomUUID(),
        name: "Refrigerator",
        type: "appliance",
        power: 150,
        status: true,
        usage: 3.2
    },
    {
        id: crypto.randomUUID(),
        name: "Living Room TV",
        type: "electronics",
        power: 120,
        status: false,
        usage: 1.5
    },
    {
        id: crypto.randomUUID(),
        name: "AC Unit",
        type: "heating",
        power: 1500,
        status: true,
        usage: 8.7
    },
    {
        id: crypto.randomUUID(),
        name: "Kitchen Lights",
        type: "lighting",
        power: 60,
        status: true,
        usage: 2.1
    }
];

const DEFAULT_SETTINGS = {
    energyRate: 12.50,
    carbonIntensity: 450,
    monthlyBudget: 5000,
    currency: "₱"
};

/* ==========================================================
   Storage Manager
   ========================================================== */

class StorageManager {
    static loadDevices() {
        const data = localStorage.getItem(APP_CONFIG.storageKey);
        if (!data) {
            this.saveDevices(DEFAULT_DEVICES);
            return [...DEFAULT_DEVICES];
        }
        try {
            return JSON.parse(data);
        } catch (err) {
            console.error(err);
            return [...DEFAULT_DEVICES];
        }
    }

    static saveDevices(devices) {
        localStorage.setItem(APP_CONFIG.storageKey, JSON.stringify(devices));
    }

    static loadSettings() {
        const data = localStorage.getItem(APP_CONFIG.settingsKey);
        if (!data) {
            this.saveSettings(DEFAULT_SETTINGS);
            return { ...DEFAULT_SETTINGS };
        }
        try {
            return JSON.parse(data);
        } catch (err) {
            console.error(err);
            return { ...DEFAULT_SETTINGS };
        }
    }

    static saveSettings(settings) {
        localStorage.setItem(APP_CONFIG.settingsKey, JSON.stringify(settings));
    }
}

/* ==========================================================
   Utility Functions
   ========================================================== */

const Utils = {
    currency(value) {
        return `₱${Number(value).toFixed(2)}`;
    },
    random(min, max) {
        return Math.random() * (max - min) + min;
    },
    clamp(value, min, max) {
        return Math.min(Math.max(value, min), max);
    },
    formatPower(power) {
        return `${power} W`;
    },
    formatUsage(value) {
        return `${Number(value).toFixed(2)} kWh`;
    },
    byId(id) {
        return document.getElementById(id);
    }
};

/* ==========================================================
   Main Application
   ========================================================== */

class EnergyMonitor {
    constructor() {
        this.devices = StorageManager.loadDevices();
        this.settings = StorageManager.loadSettings();
        this.consumptionChart = null;
        this.deviceChart = null;
        this.currentPeriod = "day";
        this.history = [];
        this.schedules = [];
        this.preferences = {};
        this.logs = [];
    }

    // ---------- DOM & Event Binding ----------

    cacheDOM() {
        this.deviceContainer = Utils.byId("devices-container");
        this.currentUsage = Utils.byId("current-usage");
        this.todayUsage = Utils.byId("today-usage");
    }

    bindEvents() {
        document.addEventListener("click", this.handleClick.bind(this));
        document.addEventListener("change", this.handleChange.bind(this));
    }

    // ---------- Click / Change Handlers ----------

    handleClick(e) {
        const addBtn = e.target.closest("#add-device-btn");
        if (addBtn) {
            Utils.byId("add-device-modal").style.display = "flex";
            return;
        }

        const deleteBtn = e.target.closest(".delete-device");
        if (deleteBtn) {
            const id = deleteBtn.dataset.id;
            this.deleteDevice(id);
            return;
        }

        const editBtn = e.target.closest(".edit-device");
        if (editBtn) {
            const id = editBtn.dataset.id;
            this.editDevice(id);
            return;
        }

        if (e.target.classList.contains("close-modal")) {
            document
                .querySelectorAll(".modal")
                .forEach(modal => (modal.style.display = "none"));
        }
    }

    handleChange(e) {
        if (e.target.classList.contains("device-toggle")) {
            this.toggleDevice(e.target.dataset.id);
            return;
        }
        if (e.target.id === "device-filter") {
            this.filterDevices(e.target.value);
        }
    }

    // ---------- Device CRUD ----------

    toggleDevice(id) {
        const device = this.devices.find(d => d.id === id);
        if (!device) return;
        device.status = !device.status;
        StorageManager.saveDevices(this.devices);
        this.renderDashboard();
        this.renderDevices();
        if (this.deviceChart) this.updateDeviceChart();
    }

    deleteDevice(id) {
        if (!confirm("Delete this device?")) return;
        this.devices = this.devices.filter(device => device.id !== id);
        StorageManager.saveDevices(this.devices);
        this.renderDevices();
        this.renderDashboard();
        if (this.deviceChart) this.updateDeviceChart();
    }

    editDevice(id) {
        const device = this.devices.find(d => d.id === id);
        if (!device) return;
        const newName = prompt("Device name:", device.name);
        if (newName === null) return;
        const newPower = prompt("Power (Watts):", device.power);
        if (newPower === null) return;
        device.name = newName.trim();
        device.power = Number(newPower);
        StorageManager.saveDevices(this.devices);
        this.renderDevices();
        this.renderDashboard();
        if (this.deviceChart) this.updateDeviceChart();
    }

   filterDevices(filterValue) {
        if (filterValue === "all") {
            this.renderDevices();
            return;
        }

        // Temporarily store the original devices array
        const allDevices = this.devices;
        
        // Filter based on the HTML dropdown values
        if (filterValue === "active") {
            this.devices = allDevices.filter(device => device.status === true);
        } else if (filterValue === "high-usage") {
            // Let's define "high usage" as anything over 5 kWh
            this.devices = allDevices.filter(device => device.usage >= 5.0);
        }

        // Use the main render method so we keep our toggle/edit/delete buttons
        this.renderDevices();

        // Restore the original array so we don't lose our data!
        this.devices = allDevices;
    }
    // ---------- Device Rendering ----------

    renderDevices() {
        if (!this.deviceContainer) return;
        this.deviceContainer.innerHTML = "";
        this.devices.forEach(device => {
            const card = document.createElement("div");
            card.className = "device-card";
            card.innerHTML = `
                <div class="device-icon icon-${this.getDeviceColor(device.type)}">
                    <i class="fas ${this.getDeviceIcon(device.type)}"></i>
                </div>
                <div class="device-info">
                    <div class="device-name">${device.name}</div>
                    <div class="device-status">
                        ${device.status ? "Active" : "Inactive"} • ${device.power}W
                    </div>
                </div>
                <div class="device-power">${device.usage.toFixed(2)} kWh</div>
                <div class="device-actions">
                    <label class="toggle-switch">
                        <input type="checkbox" class="device-toggle" data-id="${device.id}" ${device.status ? "checked" : ""}>
                        <span class="slider"></span>
                    </label>
                    <button class="btn btn-outline edit-device" data-id="${device.id}">
                        <i class="fas fa-pen"></i>
                    </button>
                    <button class="btn btn-danger delete-device" data-id="${device.id}">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            `;
            this.deviceContainer.appendChild(card);
        });
    }

    getDeviceIcon(type) {
        switch (type) {
            case "appliance": return "fa-blender";
            case "electronics": return "fa-tv";
            case "lighting": return "fa-lightbulb";
            case "heating": return "fa-temperature-high";
            default: return "fa-plug";
        }
    }

    getDeviceColor(type) {
        switch (type) {
            case "appliance": return "primary";
            case "electronics": return "secondary";
            case "lighting": return "success";
            case "heating": return "warning";
            default: return "gray";
        }
    }

    renderDeviceList(devices) {
        if (!this.deviceContainer) return;
        this.deviceContainer.innerHTML = "";
        devices.forEach(device => {
            const card = document.createElement("div");
            card.className = "device-card";
            card.innerHTML = `
                <div class="device-icon icon-${this.getDeviceColor(device.type)}">
                    <i class="fas ${this.getDeviceIcon(device.type)}"></i>
                </div>
                <div class="device-info">
                    <div class="device-name">${device.name}</div>
                    <div class="device-status">
                        ${device.status ? "Active" : "Inactive"} • ${device.power}W
                    </div>
                </div>
                <div class="device-power">${device.usage.toFixed(2)} kWh</div>
            `;
            this.deviceContainer.appendChild(card);
        });
    }

    // ---------- Dashboard ----------

    renderDashboard() {
        const power = this.calculateCurrentPower();
        const usage = this.calculateDailyUsage();
        const cost = this.calculateMonthlyCost();
        const carbon = this.calculateCarbonEmission();

        const currentUsage = document.getElementById("current-usage");
        if (currentUsage) currentUsage.textContent = (power / 1000).toFixed(2) + " kW";

        const todayUsage = document.getElementById("today-usage");
        if (todayUsage) todayUsage.textContent = usage.toFixed(2) + " kWh";

        const costCard = document.getElementById("monthly-cost");
        if (costCard) costCard.textContent = Utils.currency(cost);

        const carbonCard = document.getElementById("carbon-footprint");
        if (carbonCard) carbonCard.textContent = carbon.toFixed(2) + " kg";
    }

    calculateCurrentPower() {
        return this.devices
            .filter(device => device.status)
            .reduce((sum, device) => sum + device.power, 0);
    }

    calculateDailyUsage() {
        return this.devices.reduce((sum, device) => sum + device.usage, 0);
    }

    calculateMonthlyCost() {
        return this.calculateDailyUsage() * 30 * this.settings.energyRate;
    }

    calculateCarbonEmission() {
        return (this.calculateDailyUsage() * this.settings.carbonIntensity) / 1000;
    }

    // ---------- Realtime Simulation ----------

    startRealtimeUpdates() {
        setInterval(() => {
            this.simulateUsage();
        }, APP_CONFIG.statsInterval);
    }

    simulateUsage() {
        this.devices.forEach(device => {
            if (!device.status) return;
            const change = Math.random() * 0.20 - 0.08;
            device.usage = Math.max(0, Number((device.usage + change).toFixed(2)));
        });
        StorageManager.saveDevices(this.devices);
        this.renderDashboard();
        this.updateAnalytics();
        this.updateDeviceChart();
    }

    // ---------- Charts ----------

    initCharts() {
        const consumptionCanvas = document.getElementById("consumption-chart");
        const deviceCanvas = document.getElementById("device-chart");
        if (!consumptionCanvas || !deviceCanvas) return;

        const dayData = this.getConsumptionData("day");
        this.consumptionChart = new Chart(consumptionCanvas.getContext("2d"), {
            type: "line",
            data: {
                labels: dayData.labels,
                datasets: [
                    {
                        label: "Energy Consumption",
                        data: dayData.data,
                        borderWidth: 2,
                        tension: 0.4,
                        fill: true
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false
            }
        });

        this.deviceChart = new Chart(deviceCanvas.getContext("2d"), {
            type: "doughnut",
            data: {
                labels: [],
                datasets: [{ data: [] }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { position: "bottom" } }
            }
        });

        this.updateDeviceChart();
    }

    getConsumptionData(period = "day") {
        switch (period) {
            case "week":
                return {
                    labels: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
                    data: [18, 20, 17, 22, 19, 16, 21]
                };
            case "month":
                return {
                    labels: Array.from({ length: 30 }, (_, i) => i + 1),
                    data: [
                        420, 435, 418, 440, 451, 460, 445, 438, 429, 441,
                        452, 463, 455, 448, 442, 437, 431, 426, 435, 441,
                        450, 459, 468, 462, 455, 447, 439, 432, 428, 436
                    ]
                };
            default:
                return {
                    labels: Array.from({ length: 24 }, (_, i) => `${i}:00`),
                    data: [
                        1.2, 1.1, 1.0, 0.9, 0.8, 0.8, 1.0, 1.3,
                        1.8, 2.2, 2.4, 2.6, 2.5, 2.4, 2.3, 2.0,
                        1.8, 1.7, 2.0, 2.4, 2.6, 2.3, 1.9, 1.5
                    ]
                };
        }
    }

    updateDeviceChart() {
        if (!this.deviceChart) return;
        const active = this.devices.filter(d => d.status);
        this.deviceChart.data.labels = active.map(d => d.name);
        this.deviceChart.data.datasets[0].data = active.map(d => Number(d.usage.toFixed(2)));
        this.deviceChart.data.datasets[0].backgroundColor = [
            "#2E86AB", "#A23B72", "#FF9800", "#4CAF50",
            "#9C27B0", "#607D8B", "#E91E63", "#00BCD4"
        ];
        this.deviceChart.update();
    }

    updateConsumptionChart(period) {
        if (!this.consumptionChart) return;
        this.currentPeriod = period;
        const chartData = this.getConsumptionData(period);
        this.consumptionChart.data.labels = chartData.labels;
        this.consumptionChart.data.datasets[0].data = chartData.data;
        this.consumptionChart.update();
    }

    bindChartButtons() {
        document.querySelectorAll(".chart-action").forEach(button => {
            button.addEventListener("click", () => {
                document.querySelectorAll(".chart-action").forEach(btn => btn.classList.remove("active"));
                button.classList.add("active");
                this.updateConsumptionChart(button.dataset.period);
            });
        });
    }

    refreshCharts() {
        this.renderDashboard();
        this.updateDeviceChart();
        this.updateConsumptionChart(this.currentPeriod);
    }

    // ---------- Forms ----------

    bindForms() {
        const addForm = document.getElementById("add-device-form");
        if (addForm) addForm.addEventListener("submit", this.handleAddDevice.bind(this));

        const settingsForm = document.getElementById("settings-form");
        if (settingsForm) settingsForm.addEventListener("submit", this.handleSettings.bind(this));
    }

    handleAddDevice(event) {
        event.preventDefault();
        const name = document.getElementById("device-name").value.trim();
        const type = document.getElementById("device-type").value;
        const power = Number(document.getElementById("device-power").value);
        if (!name || power <= 0) {
            alert("Please enter valid information.");
            return;
        }
        const device = {
            id: crypto.randomUUID(),
            name,
            type,
            power,
            status: true,
            usage: Number((Math.random() * 2).toFixed(2))
        };
        this.devices.push(device);
        StorageManager.saveDevices(this.devices);
        event.target.reset();
        const modal = document.getElementById("add-device-modal");
        if (modal) modal.style.display = "none";
        this.renderDevices();
        this.renderDashboard();
        this.refreshCharts();
    }

    handleSettings(event) {
        event.preventDefault();
        this.settings.energyRate = Number(document.getElementById("energy-rate").value);
        this.settings.carbonIntensity = Number(document.getElementById("carbon-intensity").value);
        this.settings.monthlyBudget = Number(document.getElementById("budget-alert").value);
        StorageManager.saveSettings(this.settings);
        const modal = document.getElementById("settings-modal");
        if (modal) modal.style.display = "none";
        this.renderDashboard();
        alert("Settings saved successfully.");
    }

    // ---------- Search & Sort ----------

    searchDevices(keyword = "") {
        keyword = keyword.toLowerCase().trim();
        if (!keyword) {
            this.renderDevices();
            return;
        }
        const results = this.devices.filter(
            device => device.name.toLowerCase().includes(keyword) || device.type.toLowerCase().includes(keyword)
        );
        this.renderDeviceList(results);
    }

    sortDevices(method = "name") {
        switch (method) {
            case "power":
                this.devices.sort((a, b) => b.power - a.power);
                break;
            case "usage":
                this.devices.sort((a, b) => b.usage - a.usage);
                break;
            case "status":
                this.devices.sort((a, b) => Number(b.status) - Number(a.status));
                break;
            default:
                this.devices.sort((a, b) => a.name.localeCompare(b.name));
        }
        this.renderDevices();
    }

    // ---------- Analytics ----------

    getHighestUsageDevice() {
        if (!this.devices.length) return null;
        return this.devices.reduce((highest, current) => (current.usage > highest.usage ? current : highest));
    }

    getLowestUsageDevice() {
        if (!this.devices.length) return null;
        return this.devices.reduce((lowest, current) => (current.usage < lowest.usage ? current : lowest));
    }

    getAverageUsage() {
        if (!this.devices.length) return 0;
        const total = this.devices.reduce((sum, device) => sum + device.usage, 0);
        return total / this.devices.length;
    }

    updateAnalytics() {
        const highest = this.getHighestUsageDevice();
        const lowest = this.getLowestUsageDevice();
        const average = this.getAverageUsage();

        const highestCard = document.getElementById("highest-device");
        if (highestCard && highest) highestCard.textContent = `${highest.name} (${highest.usage.toFixed(2)} kWh)`;

        const lowestCard = document.getElementById("lowest-device");
        if (lowestCard && lowest) lowestCard.textContent = `${lowest.name} (${lowest.usage.toFixed(2)} kWh)`;

        const averageCard = document.getElementById("average-usage");
        if (averageCard) averageCard.textContent = average.toFixed(2) + " kWh";
    }

    getTopConsumers(limit = 5) {
        return [...this.devices].sort((a, b) => b.usage - a.usage).slice(0, limit);
    }

    getLeastConsumers(limit = 5) {
        return [...this.devices].sort((a, b) => a.usage - b.usage).slice(0, limit);
    }

    getDeviceStatistics() {
        const stats = {
            total: this.devices.length,
            active: 0,
            inactive: 0,
            power: {},
            usage: {}
        };
        this.devices.forEach(device => {
            if (device.status) stats.active++;
            else stats.inactive++;
            stats.power[device.name] = device.power;
            stats.usage[device.name] = Number(device.usage.toFixed(2));
        });
        return stats;
    }

    calculateTrend() {
        if (!this.history) this.history = this.loadHistory();
        if (this.history.length < 2) return 0;
        const latest = this.history[this.history.length - 1];
        const previous = this.history[this.history.length - 2];
        return Number((latest.totalUsage - previous.totalUsage).toFixed(2));
    }

    calculateEfficiencyScore() {
        const usage = this.calculateDailyUsage();
        const power = this.calculateCurrentPower();
        if (power === 0) return 100;
        let score = 100 - ((usage * 1000) / power) * 10;
        score = Math.max(0, Math.min(100, score));
        return Number(score.toFixed(1));
    }

    updateSummaryCards() {
        const report = this.generateDailyReport();
        const efficiency = this.calculateEfficiencyScore();
        const trend = this.calculateTrend();

        const efficiencyCard = document.getElementById("efficiency-score");
        if (efficiencyCard) efficiencyCard.textContent = efficiency + "%";

        const trendCard = document.getElementById("usage-trend");
        if (trendCard) trendCard.textContent = trend >= 0 ? "+" + trend.toFixed(2) + " kWh" : trend.toFixed(2) + " kWh";

        const reportCard = document.getElementById("daily-report");
        if (reportCard) {
            reportCard.innerHTML = `
                <strong>${report.activeDevices}</strong> Active Devices<br>
                <strong>${report.energyUsed.toFixed(2)}</strong> kWh Today
            `;
        }
    }

    generateDailyReport() {
        const active = this.devices.filter(d => d.status);
        return {
            date: new Date().toLocaleDateString(),
            activeDevices: active.length,
            totalDevices: this.devices.length,
            currentPower: this.calculateCurrentPower(),
            energyUsed: this.calculateDailyUsage(),
            estimatedCost: this.calculateMonthlyCost(),
            carbon: this.calculateCarbonEmission()
        };
    }

    // ---------- Budget & Notifications ----------

    checkBudget() {
        const monthlyCost = this.calculateMonthlyCost();
        if (monthlyCost >= this.settings.monthlyBudget) {
            this.showNotification("Monthly energy budget exceeded!", "danger");
        } else if (monthlyCost >= this.settings.monthlyBudget * 0.9) {
            this.showNotification("Warning: Budget is almost reached.", "warning");
        }
    }

    showNotification(message, type = "info") {
        let container = document.getElementById("notification-container");
        if (!container) {
            container = document.createElement("div");
            container.id = "notification-container";
            document.body.appendChild(container);
        }
        const notification = document.createElement("div");
        notification.className = `notification ${type}`;
        notification.innerHTML = `<span>${message}</span>`;
        container.appendChild(notification);
        setTimeout(() => notification.classList.add("show"), 50);
        setTimeout(() => {
            notification.classList.remove("show");
            setTimeout(() => notification.remove(), 300);
        }, 4000);
    }

    // ---------- Import / Export ----------

    exportDevices() {
        const json = JSON.stringify(this.devices, null, 2);
        const blob = new Blob([json], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "devices.json";
        a.click();
        URL.revokeObjectURL(url);
    }

    importDevices(file) {
        if (!file) return;
        const reader = new FileReader();
        reader.onload = e => {
            try {
                const data = JSON.parse(e.target.result);
                if (!Array.isArray(data)) throw new Error();
                this.devices = data;
                StorageManager.saveDevices(this.devices);
                this.refreshUI();
                this.showNotification("Devices imported successfully.", "success");
            } catch {
                this.showNotification("Invalid JSON file.", "danger");
            }
        };
        reader.readAsText(file);
    }

    exportCSV() {
        const rows = [];
        rows.push(["Name", "Type", "Power", "Status", "Usage"]);
        this.devices.forEach(device => {
            rows.push([device.name, device.type, device.power, device.status ? "Active" : "Inactive", device.usage]);
        });
        const csv = rows.map(row => row.join(",")).join("\n");
        const blob = new Blob([csv], { type: "text/csv" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "devices.csv";
        a.click();
        URL.revokeObjectURL(url);
    }

    backupData() {
        const backup = {
            version: APP_CONFIG.version,
            exportedAt: new Date().toISOString(),
            settings: this.settings,
            devices: this.devices
        };
        const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "energy-monitor-backup.json";
        a.click();
        URL.revokeObjectURL(url);
    }

    restoreBackup(file) {
        if (!file) return;
        const reader = new FileReader();
        reader.onload = e => {
            try {
                const backup = JSON.parse(e.target.result);
                this.devices = backup.devices || [];
                this.settings = backup.settings || DEFAULT_SETTINGS;
                this.sync();
                this.showNotification("Backup restored successfully.", "success");
            } catch {
                this.showNotification("Unable to restore backup.", "danger");
            }
        };
        reader.readAsText(file);
    }

    // ---------- History ----------

    loadHistory() {
        const history = localStorage.getItem("energy-history");
        if (!history) return [];
        try {
            return JSON.parse(history);
        } catch {
            return [];
        }
    }

    saveHistory() {
        localStorage.setItem("energy-history", JSON.stringify(this.history));
    }

    recordUsageSnapshot() {
        if (!this.history) this.history = this.loadHistory();
        this.history.push({
            timestamp: new Date().toISOString(),
            totalPower: this.calculateCurrentPower(),
            totalUsage: this.calculateDailyUsage(),
            monthlyCost: this.calculateMonthlyCost(),
            carbon: this.calculateCarbonEmission()
        });
        if (this.history.length > 1000) this.history.shift();
        this.saveHistory();
    }

    // ---------- Scheduling ----------

    initializeSchedules() {
        this.schedules = JSON.parse(localStorage.getItem("energy-schedules") || "[]");
    }

    saveSchedules() {
        localStorage.setItem("energy-schedules", JSON.stringify(this.schedules));
    }

    addSchedule(deviceId, startTime, endTime) {
        this.schedules.push({
            id: crypto.randomUUID(),
            deviceId,
            startTime,
            endTime,
            enabled: true
        });
        this.saveSchedules();
    }

    removeSchedule(scheduleId) {
        this.schedules = this.schedules.filter(schedule => schedule.id !== scheduleId);
        this.saveSchedules();
    }

    runSchedules() {
        if (!this.schedules) return;
        const now = new Date();
        const current = now.toTimeString().substring(0, 5);
        this.schedules.forEach(schedule => {
            if (!schedule.enabled) return;
            const device = this.devices.find(d => d.id === schedule.deviceId);
            if (!device) return;
            if (current >= schedule.startTime && current < schedule.endTime) {
                device.status = true;
            } else {
                device.status = false;
            }
        });
        StorageManager.saveDevices(this.devices);
    }

    // ---------- Peak Hour & Forecast ----------

    isPeakHour() {
        const hour = new Date().getHours();
        return (hour >= 18 && hour <= 22) || (hour >= 7 && hour <= 9);
    }

    forecastMonthlyBill() {
        return Number((this.calculateDailyUsage() * 30 * this.settings.energyRate).toFixed(2));
    }

    forecastYearlyBill() {
        return Number((this.forecastMonthlyBill() * 12).toFixed(2));
    }

    // ---------- Recommendations ----------

    generateRecommendations() {
        const tips = [];
        if (this.isPeakHour()) {
            tips.push("Peak-hour electricity pricing may apply. Reduce appliance usage.");
        }
        this.devices.forEach(device => {
            if (device.status && device.power > 1000) {
                tips.push(`${device.name} has high power consumption (${device.power}W).`);
            }
            if (!device.status && device.usage > 5) {
                tips.push(`${device.name} has unusually high recorded usage.`);
            }
        });
        if (tips.length === 0) tips.push("System is operating efficiently.");
        return tips;
    }

    updateRecommendations() {
        const container = document.getElementById("recommendations");
        if (!container) return;
        container.innerHTML = "";
        this.generateRecommendations().forEach(message => {
            const item = document.createElement("li");
            item.textContent = message;
            container.appendChild(item);
        });
    }

    // ---------- Automation ----------

    runAutomation() {
        this.runSchedules();
        this.checkBudget();
        this.updateRecommendations();
        this.renderDashboard();
        this.updateDeviceChart();
    }

    startAutomation() {
        setInterval(() => this.runAutomation(), 60000);
    }

    startMonitoring() {
        setInterval(() => {
            this.simulateUsage();
            this.recordUsageSnapshot();
            this.updateSummaryCards();
            this.checkBudget();
        }, APP_CONFIG.statsInterval);
    }

    // ---------- Theme & Preferences ----------

    initializeTheme() {
        const savedTheme = localStorage.getItem("energy-theme") || "light";
        document.documentElement.setAttribute("data-theme", savedTheme);
    }

    toggleTheme() {
        const current = document.documentElement.getAttribute("data-theme") || "light";
        const next = current === "light" ? "dark" : "light";
        document.documentElement.setAttribute("data-theme", next);
        localStorage.setItem("energy-theme", next);
    }

    loadPreferences() {
        this.preferences = JSON.parse(localStorage.getItem("energy-preferences") || "{}");
    }

    savePreferences() {
        localStorage.setItem("energy-preferences", JSON.stringify(this.preferences));
    }

    // ---------- Logging ----------

    initializeLogs() {
        this.logs = JSON.parse(localStorage.getItem("energy-logs") || "[]");
    }

    addLog(action, details = "") {
        this.logs.unshift({
            id: crypto.randomUUID(),
            action,
            details,
            timestamp: new Date().toISOString()
        });
        if (this.logs.length > 500) this.logs.length = 500;
        localStorage.setItem("energy-logs", JSON.stringify(this.logs));
    }

    getLogs(limit = 20) {
        return this.logs.slice(0, limit);
    }

    // ---------- Utility (debounce, throttle, shortcuts) ----------

    debounce(callback, delay = 300) {
        let timer;
        return (...args) => {
            clearTimeout(timer);
            timer = setTimeout(() => callback.apply(this, args), delay);
        };
    }

    throttle(callback, limit = 200) {
        let waiting = false;
        return (...args) => {
            if (waiting) return;
            callback.apply(this, args);
            waiting = true;
            setTimeout(() => (waiting = false), limit);
        };
    }

    registerKeyboardShortcuts() {
        document.addEventListener("keydown", event => {
            if (event.ctrlKey && event.key === "s") {
                event.preventDefault();
                this.sync();
                this.showNotification("Data saved.", "success");
            }
            if (event.ctrlKey && event.key === "e") {
                event.preventDefault();
                this.exportDevices();
            }
            if (event.ctrlKey && event.key === "b") {
                event.preventDefault();
                this.backupData();
            }
            if (event.ctrlKey && event.key === "d") {
                event.preventDefault();
                this.toggleTheme();
            }
        });
    }

    enableAutoSave() {
        setInterval(() => {
            StorageManager.saveDevices(this.devices);
            StorageManager.saveSettings(this.settings);
            this.savePreferences();
        }, 30000);
    }

    refreshUI() {
        this.renderDevices();
        this.renderDashboard();
        this.updateAnalytics();
        this.updateDeviceChart();
    }

    refreshDashboard() {
        this.renderDashboard();
        this.updateAnalytics();
        this.updateSummaryCards();
        this.updateRecommendations();
        this.updateDeviceChart();
    }

    // ---------- Validation & Safety ----------

    validateDevice(device) {
        if (!device) return false;
        if (typeof device.name !== "string") return false;
        if (!device.name.trim()) return false;
        if (isNaN(device.power)) return false;
        if (device.power <= 0) return false;
        return true;
    }

    validateSettings(settings) {
        if (!settings) return false;
        return !isNaN(settings.energyRate) && !isNaN(settings.carbonIntensity) && !isNaN(settings.monthlyBudget);
    }

    sync() {
        StorageManager.saveDevices(this.devices);
        StorageManager.saveSettings(this.settings);
        if (this.history) this.saveHistory();
        if (this.preferences) this.savePreferences();
        if (this.schedules) this.saveSchedules();
        this.renderDevices();
        this.renderDashboard();
        this.refreshCharts();
    }

    saveAll() {
        this.sync();
    }

    handleError(error) {
        console.error(error);
        this.addLog("Error", error.message || String(error));
        this.showNotification("An unexpected error occurred.", "danger");
    }

    resetRuntime() {
        this.deviceChart = null;
        this.consumptionChart = null;
        this.currentPeriod = "day";
    }

    destroy() {
        if (this.deviceChart) this.deviceChart.destroy();
        if (this.consumptionChart) this.consumptionChart.destroy();
        this.resetRuntime();
    }

    resetApplication() {
        if (!confirm("Reset all saved data?")) return;
        this.devices = structuredClone(DEFAULT_DEVICES);
        this.settings = structuredClone(DEFAULT_SETTINGS);
        this.sync();
    }

    // ---------- Startup ----------

    startup() {
        this.initializeTheme();
        this.loadPreferences();
        this.initializeLogs();
        this.initializeSchedules();
        this.history = this.loadHistory();
        this.bindForms();
        this.bindChartButtons();
        this.registerKeyboardShortcuts();
        this.enableAutoSave();
        this.refreshDashboard();
        this.addLog("Application Started");
    }

    start() {
        try {
            this.cacheDOM();
            this.startup();
            this.initCharts();
            this.renderDevices();
            this.renderDashboard();
            this.updateAnalytics();
            this.updateSummaryCards();
            this.updateRecommendations();
            this.startMonitoring();
            this.startAutomation();
            this.addLog("Monitoring Started");
            this.showNotification("Energy Monitor Ready", "success");
        } catch (error) {
            this.handleError(error);
        }
    }
}

/* ==========================================================
   Global Utilities
   ========================================================== */

window.energyMonitorVersion = APP_CONFIG.version;

window.resetEnergyMonitor = () => {
    if (window.app) window.app.resetApplication();
};

window.exportEnergyData = () => {
    if (window.app) window.app.exportDevices();
};

window.backupEnergyData = () => {
    if (window.app) window.app.backupData();
};

window.toggleEnergyTheme = () => {
    if (window.app) window.app.toggleTheme();
};

/* ==========================================================
   DOM Ready
   ========================================================== */

document.addEventListener("DOMContentLoaded", () => {
    try {
        window.app = new EnergyMonitor();
        app.start();
    } catch (error) {
        console.error(error);
        alert("Application failed to start. Check the browser console.");
    }
});
