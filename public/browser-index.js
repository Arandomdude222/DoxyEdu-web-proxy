// browser-index.js - Modified for multi-tab browser
"use strict";

/**
 * Tab Manager for DoxyEdu Browser
 */
class DoxyEduTabManager {
    constructor() {
        this.tabs = new Map(); // tabId -> { frame, controller, connection }
        this.activeTabId = null;
        this.isInitialized = false;
        
        // Wait for DOM and scripts
        document.addEventListener("DOMContentLoaded", () => this.init());
    }
    
    async init() {
        console.log("DoxyEdu Tab Manager initializing...");
        
        // Load Scramjet controller
        const { ScramjetController } = $scramjetLoadController();
        this.ScramjetController = ScramjetController;
        
        // Initialize BareMux connection
        this.bareMuxConnection = new BareMux.BareMuxConnection("/baremux/worker.js");
        
        this.isInitialized = true;
        console.log("DoxyEdu Tab Manager ready");
    }
    
    /**
     * Create a new tab with DoxyEdu proxy
     */
    async createTab(tabId, url) {
        if (!this.isInitialized) {
            await this.init();
        }
        
        console.log(`Creating tab ${tabId} for URL: ${url}`);
        
        try {
            // Register service worker for this tab
            await this.registerSW();
            
            // Setup transport if needed
            const wispUrl = (location.protocol === "https:" ? "wss" : "ws") +
                "://" + location.host + "/wisp/";
            
            if ((await this.bareMuxConnection.getTransport()) !== "/epoxy/index.mjs") {
                await this.bareMuxConnection.setTransport("/epoxy/index.mjs", [{ wisp: wispUrl }]);
            }
            
            // Create Scramjet frame for this tab
            const scramjet = new this.ScramjetController({
                files: {
                    wasm: '/scram/scramjet.wasm.wasm',
                    all: '/scram/scramjet.all.js',
                    sync: '/scram/scramjet.sync.js',
                },
            });
            
            await scramjet.init();
            const frame = scramjet.createFrame();
            frame.frame.id = `sj-frame-${tabId}`;
            
            // Store tab data
            this.tabs.set(tabId, {
                frame: frame,
                controller: scramjet,
                connection: this.bareMuxConnection,
                url: url
            });
            
            // Navigate to URL
            frame.go(url);
            
            return frame.frame;
            
        } catch (err) {
            console.error(`Failed to create tab ${tabId}:`, err);
            throw err;
        }
    }
    
    /**
     * Navigate an existing tab to a new URL
     */
    async navigateTab(tabId, url) {
        const tab = this.tabs.get(tabId);
        if (!tab) {
            return this.createTab(tabId, url);
        }
        
        console.log(`Navigating tab ${tabId} to: ${url}`);
        tab.url = url;
        tab.frame.go(url);
    }
    
    /**
     * Close a tab
     */
    closeTab(tabId) {
        const tab = this.tabs.get(tabId);
        if (tab) {
            // Clean up if needed
            this.tabs.delete(tabId);
            console.log(`Closed tab ${tabId}`);
        }
    }
    
    /**
     * Set active tab
     */
    setActiveTab(tabId) {
        this.activeTabId = tabId;
    }
    
    /**
     * Get active tab's frame
     */
    getActiveFrame() {
        const tab = this.tabs.get(this.activeTabId);
        return tab ? tab.frame.frame : null;
    }
    
    /**
     * Register service worker
     */
    async registerSW() {
        if (!('serviceWorker' in navigator)) {
            throw new Error('Service workers not supported');
        }
        
        try {
            const registration = await navigator.serviceWorker.register('/sw.js', {
                scope: '/',
                updateViaCache: 'none'
            });
            
            if (registration.installing) {
                console.log('Service worker installing');
            } else if (registration.waiting) {
                console.log('Service worker installed');
            } else if (registration.active) {
                console.log('Service worker active');
            }
            
            return registration;
        } catch (err) {
            console.error('Service worker registration failed:', err);
            throw err;
        }
    }
}

// Create global tab manager instance
window.doxyEduTabs = new DoxyEduTabManager();

/**
 * Search function from search.js
 */
function search(query, searchEngine) {
    if (!query) return '';
    
    // Check if it's a URL
    try {
        new URL(query);
        return query; // It's already a valid URL
    } catch {
        // Not a URL, treat as search
        const url = new URL(searchEngine);
        return url.origin + url.pathname.replace('%s', encodeURIComponent(query));
    }
}

/**
 * Main browser interface setup
 */
document.addEventListener("DOMContentLoaded", () => {
    console.log("DoxyEdu Browser interface loading...");
    
    // Get DOM elements
    const browserForm = document.getElementById("browser-sj-form");
    const browserAddress = document.getElementById("browser-sj-address");
    const browserError = document.getElementById("browser-sj-error");
    const browserErrorCode = document.getElementById("browser-sj-error-code");
    const browserSearchEngine = document.getElementById("browser-sj-search-engine");
    
    if (!browserForm) {
        console.error("Browser form elements not found!");
        return;
    }
    
    // Tab counter
    let tabCounter = 0;
    let activeTabId = null;
    
    /**
     * Create a new browser tab
     */
    function createBrowserTab(url = 'https://doxyedu.dpdns.org') {
        tabCounter++;
        const tabId = `tab-${tabCounter}`;
        
        // Create tab element
        const tabEl = document.createElement("div");
        tabEl.className = "browser-tab";
        tabEl.dataset.tabId = tabId;
        tabEl.innerHTML = `
            <span class="tab-title">${new URL(url).hostname}</span>
            <span class="tab-close">×</span>
        `;
        
        // Add to tabs container
        document.getElementById("browser-tabs-container").appendChild(tabEl);
        
        // Create content area
        const contentEl = document.createElement("div");
        contentEl.className = "tab-content";
        contentEl.id = `tab-content-${tabId}`;
        document.getElementById("browser-content-area").appendChild(contentEl);
        
        // Set as active
        setActiveTab(tabId);
        
        // Load URL via DoxyEdu proxy
        loadTabUrl(tabId, url);
        
        return tabId;
    }
    
    /**
     * Load URL in a tab using DoxyEdu proxy
     */
    async function loadTabUrl(tabId, url) {
        try {
            // Show loading
            const contentEl = document.getElementById(`tab-content-${tabId}`);
            contentEl.innerHTML = '<div class="tab-loading">Loading via DoxyEdu proxy...</div>';
            
            // Use the tab manager to create the proxy frame
            const frame = await window.doxyEduTabs.createTab(tabId, url);
            
            // Add frame to content area
            contentEl.innerHTML = '';
            contentEl.appendChild(frame);
            
            // Update tab title
            updateTabTitle(tabId, url);
            
        } catch (err) {
            console.error(`Failed to load tab ${tabId}:`, err);
            const contentEl = document.getElementById(`tab-content-${tabId}`);
            contentEl.innerHTML = `
                <div class="tab-error">
                    <p>Failed to load: ${err.message}</p>
                </div>
            `;
        }
    }
    
    /**
     * Update tab title
     */
    function updateTabTitle(tabId, url) {
        const tabEl = document.querySelector(`.browser-tab[data-tab-id="${tabId}"] .tab-title`);
        if (tabEl) {
            tabEl.textContent = new URL(url).hostname;
        }
    }
    
    /**
     * Set active tab
     */
    function setActiveTab(tabId) {
        // Remove active class from all tabs
        document.querySelectorAll(".browser-tab").forEach(tab => {
            tab.classList.remove("active");
        });
        document.querySelectorAll(".tab-content").forEach(content => {
            content.classList.remove("active");
        });
        
        // Add active class to selected tab
        const tabEl = document.querySelector(`.browser-tab[data-tab-id="${tabId}"]`);
        const contentEl = document.getElementById(`tab-content-${tabId}`);
        
        if (tabEl && contentEl) {
            tabEl.classList.add("active");
            contentEl.classList.add("active");
            activeTabId = tabId;
            
            // Update URL bar with active tab's URL
            const tabData = window.doxyEduTabs.tabs.get(tabId);
            if (tabData && browserAddress) {
                browserAddress.value = tabData.url || '';
            }
        }
    }
    
    /**
     * Close tab
     */
    function closeTab(tabId) {
        // Remove from DOM
        const tabEl = document.querySelector(`.browser-tab[data-tab-id="${tabId}"]`);
        const contentEl = document.getElementById(`tab-content-${tabId}`);
        
        if (tabEl) tabEl.remove();
        if (contentEl) contentEl.remove();
        
        // Clean up tab manager
        window.doxyEduTabs.closeTab(tabId);
        
        // If this was the active tab, switch to another
        if (tabId === activeTabId) {
            const remainingTabs = document.querySelectorAll(".browser-tab");
            if (remainingTabs.length > 0) {
                const newTabId = remainingTabs[0].dataset.tabId;
                setActiveTab(newTabId);
            } else {
                activeTabId = null;
                browserAddress.value = '';
            }
        }
    }
    
    // Set up event listeners
    browserForm.addEventListener("submit", async (event) => {
        event.preventDefault();
        
        if (!browserAddress.value.trim()) return;
        
        try {
            // Get the URL
            const url = search(browserAddress.value, browserSearchEngine.value);
            
            if (!activeTabId) {
                // Create new tab
                createBrowserTab(url);
            } else {
                // Navigate active tab
                await window.doxyEduTabs.navigateTab(activeTabId, url);
                updateTabTitle(activeTabId, url);
            }
            
            // Clear any previous errors
            if (browserError) browserError.textContent = "";
            if (browserErrorCode) browserErrorCode.textContent = "";
            
        } catch (err) {
            console.error("Navigation error:", err);
            if (browserError) browserError.textContent = "Failed to navigate";
            if (browserErrorCode) browserErrorCode.textContent = err.toString();
        }
    });
    
    // Tab switching
    document.addEventListener("click", (e) => {
        // Tab click
        if (e.target.closest(".browser-tab")) {
            const tabEl = e.target.closest(".browser-tab");
            const tabId = tabEl.dataset.tabId;
            setActiveTab(tabId);
        }
        
        // Close button click
        if (e.target.classList.contains("tab-close")) {
            const tabEl = e.target.closest(".browser-tab");
            const tabId = tabEl.dataset.tabId;
            closeTab(tabId);
        }
    });
    
    // Create first tab
    createBrowserTab();
    
    console.log("DoxyEdu Browser interface ready");
});