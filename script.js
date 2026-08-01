/* ==========================================================
   Energy Usage Monitoring App - Fixed & Fully Integrated
   ========================================================== */

"use strict";

const APP_CONFIG = {
    storageKey: "energy-monitor-data-v3",
    settingsKey: "energy-monitor-settings-v3",
    statsInterval: 1000,
    version: "3.0.6"
};

const Utils = {
    generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substring(2);
    },
    currency(value) {
        return `₱${Number(value).toFixed(2)}`;
    },
    byId(id) {
        return document.getElementById(id);
    }
};

const FACTORY_RESET_DEVICES = [
    {
        id: Utils.generateId(),
        name: "Refrigerator",
        type: "appliance",
        power: 150,
        status: false,
        usage: 0.0,
        runtimeSeconds: 0
    },
    {
        id: Utils.generateId(),
        name: "Living Room TV",
        type: "electronics",
        power: 120,
        status: false,
        usage: 0.0,
        runtimeSeconds: 0
    },
    {
        id: Utils.generateId(),
        name: "AC Unit",
        type: "heating",
        power: 1500,
        status: false,
        usage: 0.0,
        runtimeSeconds: 0
    },
    {
        id: Utils.generateId(),
        name: "Kitchen Lights",
        type: "lighting",
        power: 60,
        status: false,
        usage: 0.0,
        runtimeSeconds: 0
    }
];

const DEFAULT_SETTINGS = {
    energyRate: 12.50,
    monthlyBudget: 5000
};

class StorageManager {
    static loadDevices() {
        const data = localStorage.getItem(APP_CONFIG.storageKey);
        if (!data) {
            this.saveDevices(FACTORY_RESET_DEVICES);
            return [...FACTORY_RESET_DEVICES];
        }
        try {
            const parsed = JSON.parse(data);
            return parsed.map(d => ({
                ...d,
                runtimeSeconds: d.runtimeSeconds !== undefined ? d.runtimeSeconds : (d.runtimeHours ? d.runtimeHours * 3600 : 0)
            }));
        } catch (err) {
            return [...FACTORY_RESET_DEVICES];
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
            return { ...DEFAULT_SETTINGS };
        }
    }

    static saveSettings(settings) {
        localStorage.setItem(APP_CONFIG.settingsKey, JSON.stringify(settings));
    }
}

class EnergyMonitor {
    constructor() {
        this.devices = StorageManager.loadDevices();
        this.settings = StorageManager.loadSettings();
        this.consumptionChart = null;
        this.deviceChart = null;
        this.filterMode = "all";
        this.currentPeriod = "day";
    }

    cacheDOM() {
        this.deviceContainer = Utils.byId("devices-container");
    }

    bindEvents() {
        document.addEventListener("click", (e) => {
            const settingsBtn = e.target.closest("#settings-btn");
            if (settingsBtn) {
                const modal = Utils.byId("settings-modal");
                if (modal) {
                    modal.style.display = "flex";
                    Utils.byId("energy-rate").value = this.settings.energyRate;
                    Utils.byId("budget-alert").value = this.settings.monthlyBudget;
                }
                return;
            }

            const addBtn = e.target.closest("#add-device-btn");
            if (addBtn) {
                const modal = Utils.byId("add-device-modal");
                if (modal) modal.style.display = "flex";
                return;
            }

            const quickSaveRate = e.target.closest("#quick-save-rate");
            if (quickSaveRate) {
                const inputVal = Number(Utils.byId("quick-rate-input").value);
                if (inputVal > 0) {
                    this.settings.energyRate = inputVal;
                    StorageManager.saveSettings(this.settings);
                    
                    const settingsRateInput = Utils.byId("energy-rate");
                    if (settingsRateInput) settingsRateInput.value = this.settings.energyRate;

                    this.refreshDashboard();
                    this.showNotification("Energy rate updated successfully!", "success");
                }
                return;
            }

            const chartAction = e.target.closest(".chart-action") || 
                                (e.target.tagName === "BUTTON" && ["today", "week", "month", "day", "this week", "this month"].includes(e.target.textContent.toLowerCase().trim()) ? e.target : null);
            
            if (chartAction) {
                let periodVal = chartAction.dataset.period;
                if (!periodVal) {
                    const txt = chartAction.textContent.toLowerCase();
                    if (txt.includes("week")) periodVal = "week";
                    else if (txt.includes("month")) periodVal = "month";
                    else periodVal = "day";
                }

                const parentContainer = chartAction.parentElement;
                if (parentContainer) {
                    parentContainer.querySelectorAll("button").forEach(btn => btn.classList.remove("active"));
                }
                chartAction.classList.add("active");

                this.currentPeriod = periodVal;
                this.updateConsumptionChartPeriod();
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

            if (e.target.classList.contains("close-modal") || e.target.classList.contains("modal")) {
                document.querySelectorAll(".modal").forEach(modal => (modal.style.display = "none"));
            }
        });

        document.addEventListener("change", (e) => {
            if (e.target.classList.contains("device-toggle")) {
                this.toggleDevice(e.target.dataset.id, e.target.checked);
                return;
            }
            if (e.target.id === "device-filter") {
                this.filterMode = e.target.value;
                this.renderDevices();
            }
        });

        const addForm = Utils.byId("add-device-form");
        if (addForm) {
            addForm.addEventListener("submit", (e) => {
                e.preventDefault();
                this.handleAddDevice();
            });
        }

        const settingsForm = Utils.byId("settings-form");
        if (settingsForm) {
            settingsForm.addEventListener("submit", (e) => {
                e.preventDefault();
                this.handleSettings();
            });
        }
    }

    toggleDevice(id, isChecked) {
        const device = this.devices.find(d => d.id === id);
        if (!device) return;
        device.status = isChecked;
        StorageManager.saveDevices(this.devices);
        this.refreshDashboard();
        this.renderDevices();
    }

    deleteDevice(id) {
        if (!confirm("Are you sure you want to delete this device?")) return;
        this.devices = this.devices.filter(device => device.id !== id);
        StorageManager.saveDevices(this.devices);
        this.refreshDashboard();
        this.renderDevices();
    }

    editDevice(id) {
        const device = this.devices.find(d => d.id === id);
        if (!device) return;
        const newName = prompt("Update device name:", device.name);
        if (newName === null) return;
        const newPower = prompt("Update power rating (Watts):", device.power);
        if (newPower === null) return;
        
        device.name = newName.trim() || device.name;
        device.power = Number(newPower) >= 0 ? Number(newPower) : device.power;
        
        StorageManager.saveDevices(this.devices);
        this.refreshDashboard();
        this.renderDevices();
    }

    handleAddDevice() {
        const name = Utils.byId("device-name").value.trim();
        const type = Utils.byId("device-type").value;
        const power = Number(Utils.byId("device-power").value);
        if (!name || power <= 0) {
            alert("Please provide valid device data.");
            return;
        }
        const newDev = {
            id: Utils.generateId(),
            name,
            type,
            power,
            status: false,
            usage: 0.0,
            runtimeSeconds: 0
        };
        this.devices.push(newDev);
        StorageManager.saveDevices(this.devices);
        
        Utils.byId("add-device-form").reset();
        const modal = Utils.byId("add-device-modal");
        if (modal) modal.style.display = "none";

        this.refreshDashboard();
        this.renderDevices();
        this.showNotification("Device added successfully!", "success");
    }

    handleSettings() {
        const newRate = Number(Utils.byId("energy-rate").value);
        const newBudget = Number(Utils.byId("budget-alert").value);
        
        if (newRate > 0) {
            this.settings.energyRate = newRate;
        }
        if (newBudget > 0) {
            this.settings.monthlyBudget = newBudget;
        }

        StorageManager.saveSettings(this.settings);
        
        const quickInput = Utils.byId("quick-rate-input");
        if (quickInput) quickInput.value = this.settings.energyRate;

        const modal = Utils.byId("settings-modal");
        if (modal) modal.style.display = "none";

        this.refreshDashboard();
        this.showNotification("Settings updated successfully!", "success");
    }

    renderDevices() {
        if (!this.deviceContainer) return;
        this.deviceContainer.innerHTML = "";

        let displayList = this.devices;
        if (this.filterMode === "active") {
            displayList = this.devices.filter(d => d.status);
        } else if (this.filterMode === "high-usage") {
            displayList = this.devices.filter(d => d.usage >= 5.0 || d.power >= 1000);
        }

        if (displayList.length === 0) {
            this.deviceContainer.innerHTML = `<p style="text-align:center; color:var(--gray); padding:20px;">No devices found.</p>`;
            return;
        }

        displayList.forEach(device => {
            const totalSecs = device.runtimeSeconds || 0;
            const hrs = Math.floor(totalSecs / 3600);
            const mins = Math.floor((totalSecs % 3600) / 60);
            const secs = totalSecs % 60;
            
            const timeString = device.status 
                ? `${hrs}h ${mins}m ${secs}s active` 
                : `${hrs}h ${mins}m (Paused)`;

            const card = document.createElement("div");
            card.className = "device-card";
            card.innerHTML = `
                <div class="device-icon icon-${this.getDeviceColor(device.type)}">
                    <i class="fas ${this.getDeviceIcon(device.type)}"></i>
                </div>
                <div class="device-info">
                    <div class="device-name">${device.name}</div>
                    <div class="device-status">
                        ${device.status ? '<span style="color:var(--success); font-weight:600;"><i class="fas fa-circle" style="font-size:8px;"></i> Active</span>' : '<span style="color:var(--gray);">Inactive</span>'} • ${device.power}W | <i class="fas fa-clock"></i> ${timeString}
                    </div>
                </div>
                <div class="device-power">${device.usage.toFixed(4)} kWh</div>
                <div class="device-actions">
                    <label class="toggle-switch">
                        <input type="checkbox" class="device-toggle" data-id="${device.id}" ${device.status ? "checked" : ""}>
                        <span class="slider"></span>
                    </label>
                    <button class="btn btn-outline edit-device" data-id="${device.id}" title="Edit Device">
                        <i class="fas fa-pen"></i>
                    </button>
                    <button class="btn btn-danger delete-device" data-id="${device.id}" title="Delete Device">
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

    renderDashboard() {
        const powerW = this.calculateCurrentPower();
        const usageKwh = this.calculateDailyUsage();
        const monthlyCost = this.calculateMonthlyCost();

        const currentUsageEl = Utils.byId("current-usage");
        if (currentUsageEl) currentUsageEl.textContent = (powerW / 1000).toFixed(2) + " kW";

        const todayUsageEl = Utils.byId("today-usage");
        if (todayUsageEl) todayUsageEl.textContent = usageKwh.toFixed(3) + " kWh";

        const costEl = Utils.byId("monthly-cost");
        if (costEl) costEl.textContent = Utils.currency(monthlyCost);

        const quickRateInput = Utils.byId("quick-rate-input");
        if (quickRateInput && document.activeElement !== quickRateInput) {
            quickRateInput.value = this.settings.energyRate;
        }

        this.updateAnalytics();
        this.updateSummaryCards();
    }

    updateAnalytics() {
        const targetDevices = this.devices.length > 0 ? this.devices : [];
        const highestCard = Utils.byId("highest-device");
        const lowestCard = Utils.byId("lowest-device");

        if (targetDevices.length === 0) {
            if (highestCard) highestCard.textContent = "None";
            if (lowestCard) lowestCard.textContent = "None";
            return;
        }

        const highest = targetDevices.reduce((max, d) => (d.power > max.power ? d : max));
        const lowest = targetDevices.reduce((min, d) => (d.power < min.power ? d : min));

        if (highestCard) highestCard.textContent = `${highest.name} (${highest.power}W)`;
        if (lowestCard) lowestCard.textContent = `${lowest.name} (${lowest.power}W)`;
    }

    calculateEfficiencyScore() {
        const activeCount = this.devices.filter(d => d.status).length;
        if (activeCount === 0) return 100;
        let score = 100 - (activeCount * 4);
        return Math.max(20, Math.min(100, score));
    }

    updateSummaryCards() {
        const score = this.calculateEfficiencyScore();
        const scoreEl = Utils.byId("efficiency-score");
        if (scoreEl) scoreEl.textContent = score + "%";
    }

    simulateRealtimeUsage() {
        const hoursPassed = APP_CONFIG.statsInterval / 3600000;
        this.devices.forEach(device => {
            if (!device.status) return;
            const increment = (device.power / 1000) * hoursPassed;
            device.usage += increment;
            device.runtimeSeconds = (device.runtimeSeconds || 0) + 1;
        });
        StorageManager.saveDevices(this.devices);
        this.refreshDashboard();
        this.renderDevices();
        if (this.deviceChart) this.updateDeviceChart();
    }

    initCharts() {
        const consumptionCanvas = Utils.byId("consumption-chart");
        const deviceCanvas = Utils.byId("device-chart");
        if (!consumptionCanvas || !deviceCanvas) return;

        this.consumptionChart = new Chart(consumptionCanvas.getContext("2d"), {
            type: "line",
            data: {
                labels: Array.from({ length: 24 }, (_, i) => `${i}:00`),
                datasets: [{
                    label: "Today's Consumption (kWh)",
                    data: Array.from({ length: 24 }, () => 0.0),
                    borderWidth: 2,
                    tension: 0.4,
                    fill: true,
                    borderColor: "#2E86AB",
                    backgroundColor: "rgba(46, 134, 171, 0.1)"
                }]
            },
            options: { responsive: true, maintainAspectRatio: false }
        });

        this.deviceChart = new Chart(deviceCanvas.getContext("2d"), {
            type: "doughnut",
            data: { labels: [], datasets: [{ data: [] }] },
            options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: "bottom" } } }
        });

        this.updateConsumptionChartPeriod();
        this.updateDeviceChart();
    }

    updateConsumptionChartPeriod() {
        if (!this.consumptionChart) return;

        let labels = [];
        let dataValues = [];
        let labelText = "";
        const totalUsage = this.calculateDailyUsage();

        if (this.currentPeriod === "day" || this.currentPeriod === "today") {
            labels = Array.from({ length: 24 }, (_, i) => `${i}:00`);
            dataValues = Array.from({ length: 24 }, () => Number((totalUsage / 24).toFixed(2)));
            labelText = "Today's Consumption (kWh)";
        } else if (this.currentPeriod === "week") {
            labels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
            dataValues = labels.map(() => 0.0);
            labelText = "This Week's Consumption (kWh)";
        } else if (this.currentPeriod === "month") {
            labels = ["Week 1", "Week 2", "Week 3", "Week 4"];
            dataValues = labels.map(() => 0.0);
            labelText = "This Month's Consumption (kWh)";
        }

        this.consumptionChart.data.labels = labels;
        this.consumptionChart.data.datasets[0].label = labelText;
        this.consumptionChart.data.datasets[0].data = dataValues;
        this.consumptionChart.update();
    }

    updateDeviceChart() {
        if (!this.deviceChart) return;
        const active = this.devices.filter(d => d.status);
        this.deviceChart.data.labels = active.map(d => d.name);
        this.deviceChart.data.datasets[0].data = active.map(d => d.power);
        this.deviceChart.data.datasets[0].backgroundColor = [
            "#2E86AB", "#A23B72", "#FF9800", "#4CAF50", "#9C27B0", "#607D8B"
        ];
        this.deviceChart.update();
    }

    showNotification(message, type = "info") {
        let container = Utils.byId("notification-container");
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
        }, 3000);
    }

    refreshDashboard() {
        this.renderDashboard();
    }

    resetApplication() {
        if (!confirm("Are you sure you want to factory reset? All devices will be turned off and usage/costs will reset to 0.")) return;
        localStorage.removeItem(APP_CONFIG.storageKey);
        localStorage.removeItem(APP_CONFIG.settingsKey);
        this.devices = [...FACTORY_RESET_DEVICES];
        this.settings = { ...DEFAULT_SETTINGS };
        this.refreshDashboard();
        this.renderDevices();
        if (this.deviceChart) this.updateDeviceChart();
        if (this.consumptionChart) this.updateConsumptionChartPeriod();
        this.showNotification("Factory reset complete. Everything is set to zero.", "warning");
    }

    start() {
        this.cacheDOM();
        this.bindEvents();
        this.initCharts();
        this.renderDevices();
        this.refreshDashboard();

        setInterval(() => {
            this.simulateRealtimeUsage();
        }, APP_CONFIG.statsInterval);
    }
}

window.resetEnergyMonitor = () => window.app?.resetApplication();
window.exportEnergyData = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(window.app?.devices, null, 2));
    const dlAnchor = document.createElement('a');
    dlAnchor.setAttribute("href", dataStr);
    dlAnchor.setAttribute("download", "energy_devices.json");
    document.body.appendChild(dlAnchor);
    dlAnchor.click();
    dlAnchor.remove();
};
window.backupEnergyData = () => {
    const rawDevices = window.app?.devices || [];
    const humanReadableDevices = rawDevices.map(d => {
        const totalSecs = d.runtimeSeconds || 0;
        const hours = Math.floor(totalSecs / 3600);
        const minutes = Math.floor((totalSecs % 3600) / 60);
        
        return {
            "Device_Name": d.name,
            "Category": d.type,
            "Power_Consumption_Watts": d.power,
            "Is_Currently_Turned_On": d.status ? "Yes (Active)" : "No (Paused/Off)",
            "Total_Energy_Used_kWh": Number(d.usage.toFixed(4)),
            "Total_Active_Time": `${hours} hours and ${minutes} minutes`
        };
    });

    const settings = window.app?.settings || DEFAULT_SETTINGS;
    const backup = {
        "App_Name": "Energy Usage Monitoring App",
        "Backup_Date_And_Time": new Date().toLocaleString(),
        "App_Version": APP_CONFIG.version,
        "User_Settings": {
            "Electricity_Rate_Per_kWh": `₱${settings.energyRate}`,
            "Target_Monthly_Budget": `₱${settings.monthlyBudget}`
        },
        "My_Appliances_And_Devices": humanReadableDevices
    };

    const dataStr = "data:text/plain;charset=utf-8," + encodeURIComponent(JSON.stringify(backup, null, 4));
    const dlAnchor = document.createElement('a');
    dlAnchor.setAttribute("href", dataStr);
    dlAnchor.setAttribute("download", "my_energy_monitor_backup.txt");
    document.body.appendChild(dlAnchor);
    dlAnchor.click();
    dlAnchor.remove();
    window.app?.showNotification("Backup saved successfully with clear, easy-to-read labels!", "success");
};
window.toggleEnergyTheme = () => {
    const current = document.documentElement.getAttribute("data-theme") || "light";
    document.documentElement.setAttribute("data-theme", current === "light" ? "dark" : "light");
};

document.addEventListener("DOMContentLoaded", () => {
    window.app = new EnergyMonitor();
    window.app.start();
});
