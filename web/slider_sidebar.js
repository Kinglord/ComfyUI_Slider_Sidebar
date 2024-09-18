import { app } from "../../../scripts/app.js";
import { $el } from "../../../scripts/ui.js";
import { ComfyDialog } from "../../../scripts/ui/dialog.js";
import { api } from "../../../scripts/api.js";
import { ComfyAsyncDialog } from "../../../scripts/ui/components/asyncDialog.js";

class SliderSidebar {
    constructor(app) {
        console.log("Initializing SliderSidebar");
        this.app = app;
        this.sliderHooks = [];
        this.customCategories = {};
        this.defaultCategories = ["Favorites", "Custom", "Face", "Body", "Image"];
        this.searchInput = this.createSearchInput();
        this.randomizeButton = this.createRandomizeButton();
        this.hideInactiveCheckbox = this.createHideInactiveCheckbox();
        this.accordion = $el("div.slider-accordion");
        this.controlsRow = $el("div.controls-row", [
            this.randomizeButton,
            this.hideInactiveCheckbox
        ]);
        this.element = $el("div.slider-sidebar", [
            $el("h3", "Slider Sidebar"),
            this.searchInput,
            this.controlsRow,
            this.accordion
        ]);
        this.loadSliderData(); // Load slider data from all JSON files
        this.addSliderButton = this.createAddSliderButton();
        this.element.appendChild(this.addSliderButton);
        this.initializeCategories();
        this.categoryOrder = [];
        this.loadCategoryOrder();
        this.favorites = new Set();
        this.loadFavorites();
        this.processSliderHooks();
        this.fixReverseSliders = app.ui.settings.getSettingValue("Slider Sidebar.Sliders.unreversed", false);
        this.nsfwEnabled = app.ui.settings.getSettingValue("Slider Sidebar.General.nsfw", false);
        this.hideMissing = app.ui.settings.getSettingValue("Slider Sidebar.Visual.hideMissing", false);
        this.sliderStep = app.ui.settings.getSettingValue("Slider Sidebar.Sliders.sliderStep", 0.25);
        this.popupMaxWidth = app.ui.settings.getSettingValue("Slider Sidebar.Visual.popupMaxWidth", 70);
        this.showPills = app.ui.settings.getSettingValue("Slider Sidebar.Visual.showPills", true);
        this.smartWiring = app.ui.settings.getSettingValue("Slider Sidebar.General.smartWires", true);
        this.modelFilter = app.ui.settings.getSettingValue("Slider Sidebar.Visual.showModels", "All");
        this.ignoreSliderLimits = app.ui.settings.getSettingValue("Slider Sidebar.Sliders.sliderLimits", false);
        this.showFavorites = app.ui.settings.getSettingValue("Slider Sidebar.Visual.showFavorites", true);
        this.hideInactive = false;
        this.availableLoras = [];
        this.loadAvailableLoras();
        this.apiKey = app.ui.settings.getSettingValue("Slider Sidebar.General.apiKey", "");
        this.imageCache = new Map();
        this.loraDetails = [];
        this.loadCustomSliders();
        this.updatePopupMaxWidth(this.popupMaxWidth);
        this.updatePillVisibility(this.showPills);
        this.debug = true; // Set this to true to enable debug logging

        // cramming in css, proabbly doing it wrong lol
        this.addCustomStyles();
    }

    addCustomStyles() {
        const style = document.createElement('style');
        style.textContent = `
            .slider-sidebar h3 {
                display: flex;
                justify-content: space-around;
            }
            .slider-sidebar-search {
                display: block;
                width: 90%;
                margin: 0 auto 15px;
                padding: 10px;
                border: 1px solid var(--border-color-light, #4B5563);
                border-radius: 5px;
                background-color: var(--input-background-color, #2a2e33);
                color: var(--input-text-color, #E2E8F0);
                font-size: 14px;
                transition: all 0.3s ease;
            }
            .slider-sidebar-search:focus {
                outline: none;
                box-shadow: 0 0 0 2px rgba(75, 85, 99, 0.5);
            }
            .slider-sidebar-search::placeholder {
                color: var(--input-text-color-muted, #6B7280);
            }
            .accordion-section {
                transition: all 0.3s ease;
                position: relative;
            }
            .accordion-section:not(:last-child)::after {
                content: '';
                position: absolute;
                bottom: 0;
                left: 0;
                right: 0;
                height: 2px;
                background-color: transparent;
                transition: background-color 0.3s ease;
            }
            .accordion-section:not(:last-child):hover::after {
                background-color: var(--border-color-light, #4B5563);
            }
            .accordion-section.dragging {
                opacity: 0.5;
                border: 2px dashed #4a6da7;
            }
            .accordion-section:not(.dragging) {
                cursor: grab;
            }
            .accordion-section:not(.dragging):active {
                cursor: grabbing;
            }
            .accordion-section.new {
                opacity: 0;
                transform: translateY(-10px);
                transition: all 0.3s ease;
            }
            .accordion-section.new.show {
                opacity: 1;
                transform: translateY(0);
            }
            .accordion-header {
                display: flex;
                justify-content: space-between; /* This pushes the content to the edges */
                align-items: center;
                font-size: 1.1rem;
                font-weight: bold;
                padding: 10px;
                background-color: rgba(60, 60, 60, 0.5);
                border-bottom: 2px solid var(--border-color-light, #4B5563);
                cursor: grab;
                transition: background-color 0.3s ease;
                position: relative;
                z-index: 1;
                user-select: none;
            }
            .accordion-header i {
                font-size: 1.2rem;
                margin-left: auto;
                transition: transform 0.3s ease;
                cursor: auto;
            }
            .accordion-header:hover {
                background-color: rgba(80, 80, 80, 0.5);
            }
            .accordion-header:active {
                cursor: grabbing;
            }
            .drop-indicator {
                position: absolute;
                height: 2px;
                background-color: #4a6da7; /* Changed to visible color */
                box-shadow: 0 0 5px rgba(74, 109, 167, 0.7); /* Add a glow effect */
                pointer-events: none;
                z-index: 1000;
            }
            .accordion-content {
                padding: 10px 0;
            }
            .slider-container {
                position: relative;
                padding: 0.5rem 0.25rem;
                border-bottom: 1px solid var(--border-color-light, #444);
                cursor: auto;
            }
            .slider-container span {
                user-select: none;
            }
            .slider-container.disabled {
                position: relative;
                cursor: move;
            }
            .slider-container.disabled::after {
                content: '';
                position: absolute;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background-color: rgba(0, 0, 0, 0.35);
                pointer-events: none;
                z-index: 1;
                border-radius: inherit;
            }
            .slider-container.disabled input[type="range"],
            .slider-container.disabled input[type="checkbox"] {
                pointer-events: none;
            }
            .slider-container.disabled input[type="range"] {
                background: #ccc;
                filter: grayscale(100%);
            }
            .slider-container.disabled input[type="range"]::-webkit-slider-thumb {
                background: #999;
                filter: grayscale(100%);
            }
            .slider-container.disabled input[type="range"]::-moz-range-thumb {
                background: #999;
                filter: grayscale(100%);
            }
            .slider-container.disabled input[type="checkbox"] {
                filter: grayscale(100%);
            }
            .pill {
                font-size: 0.65rem;
                padding: 0.1rem 0.3rem;
                border-radius: 12px;
                display: inline-flex;
                opacity: var(--slider-pill-opacity);
                align-items: center;
                gap: 0.2rem;
                margin-left: 0.25rem;
                white-space: nowrap;
                height: 1.2rem;
                border: 1px solid var(--border-color-light, #4B5563);
            }
            .author-pill {
                background-color: var(--input-background-color, #3B82F6);
                color: var(--input-text-color, white);
            }
            .slider-second-row {
            flex-wrap: wrap;
            }
            .chkpt-pill {
                background-color: #FFA500;
                color: black;
                margin-top: 1px;
                margin-bottom: 1px;
            }
            .pill i {
                font-size: 0.65rem;
            }
            .pill-text {
                overflow: hidden;
                text-overflow: ellipsis;
            }
            .slider-first-row {
                display: flex;
                align-items: center;
                justify-content: flex-start;
                margin-bottom: 0.25rem;
                flex-wrap: wrap;
            }
            .slider-first-row label {
                font-size: 0.85rem;
                margin-right: auto;
                display: flex;
                align-items: center;
            }
            .label-container {
                display: flex;
                align-items: center;
                gap: 7px;
                cursor: pointer;
            }
            .label-text {
                font-size: 1.0rem;
            }
            .slider-second-row {
                display: flex;
                align-items: center;
            }
            .slider-second-row input[type="range"] {
                flex-grow: 1;
                margin-right: 0.5rem;
                height: 4px;
                -webkit-appearance: none;
                background: var(--input-background-color, #cfe0fc);
                outline: none;
                border-radius: 2px;
            }
            .slider-second-row input[type="range"]::-webkit-slider-thumb {
                -webkit-appearance: none;
                appearance: none;
                width: 12px;
                height: 12px;
                border-radius: 50%;
                background: #3B82F6;
                cursor: pointer;
            }
            .slider-second-row input[type="range"]::-moz-range-thumb {
                width: 12px;
                height: 12px;
                border-radius: 50%;
                background: #3B82F6;
                cursor: pointer;
            }
            .slider-value {
                font-size: 0.75rem;
                min-width: 3rem;
                text-align: center;
                border: 1px solid var(--border-color-light, #4B5563);
                border-radius: 4px;
                padding: 0.1rem;
                margin-right: 0.5rem;
            }
            .slider-container.missing-lora {
                background-color: rgba(255, 0, 0, 0.1);
                cursor: not-allowed;
            }
            .slider-container .download-button {
                position: relative;
                z-index: 2;
                margin-left: 8px;
                padding: 4px 8px;
                opacity: 1 !important; /* Ensure full opacity */
                cursor: pointer;
                background-color: #4a6da7;
                color: #fff;
                border: none;
                border-radius: 4px;
                font-weight: bold;
                transition: all 0.3s ease;
                box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
            }
            .slider-container .download-button:hover {
                background-color: #5a7db7; /* Slightly lighter blue on hover */
                box-shadow: 0 4px 8px rgba(0, 0, 0, 0.3);
            }
            .slider-container .download-button:active {
                background-color: #3a5d97; /* Darker blue when clicked */
                box-shadow: 0 1px 2px rgba(0, 0, 0, 0.2);
                transform: translateY(1px);
            }
            .slider-container .download-button:focus {
                outline: none;
                box-shadow: 0 0 0 3px rgba(74, 109, 167, 0.5); /* Focus ring */
            }
            .slider-container .downloading .download-button {
                cursor: progress;
            }
            .model-info-popup {
                position: absolute;
                z-index: 1000;
                background-color: #222;
                border: 1px solid #444;
                padding: 10px;
                border-radius: 5px;
                color: #fff;
                object-fit: contain;
                max-width: var(--slider-popup-max-width);
                max-height: var(--slider-popup-max-height);
                overflow: clip;
                transition: opacity 0.3s ease, transform 0.3s ease;
                opacity: 0;
                transform: translateY(-10px);
            }
            .model-info-popup img {
                display: block;
                max-width: 100%;
                max-height: 100%;
                width: auto;
                height: auto;
                border-radius: 5px;
                margin-bottom: 10px;
            }
            .model-info-popup.show {
                opacity: 1;
                transform: translateY(0);
            }
            .add-slider-button {
                display: block;
                margin: 15px auto;
                padding: 10px 20px;
                font-size: 16px;
                width: 88%;
                color: white;
                background-color: #4a6da7;
                border: none;
                border-radius: 20px;
                cursor: pointer;
                transition: background-color 0.3s;
            }
            .add-slider-button:hover {
                background-color: #5a7db7;
            }
            .lora-file-list {
                max-height: 300px;
                z-index:1000;
                overflow-y: auto;
                list-style-type: none;
                padding: 0;
            }
            .lora-file-list li {
                padding: 10px;
                cursor: pointer;
                border-bottom: 1px solid #ddd;
            }
            .lora-file-list li:hover {
                background-color: #f0f0f0;
            }
            .lora-file-list li.selected {
                background-color: #e0e0e0;
                font-weight: bold;
            }
                
            /* Dialog Container Styles */
            .comfy-dialog.comfyui-dialog {
                background-color: var(--input-background-color, #2a2e33);
                color: var(--input-text-color, #E2E8F0);
                padding: 20px;
                border: none;
                border-radius: 8px;
                box-shadow: 0 4px 16px rgba(0, 0, 0, 0.3);
                max-width: 660px; /* Increased from 500px to 660px */
                width: 95%; /* Increased from 90% to 95% */
                display: flex;
                flex-direction: column;
                font-family: inherit;
                overflow-x: hidden; /* Prevent horizontal scrollbar */
            }

            /* Dialog Header Styles */
            .comfy-dialog.comfyui-dialog h3 {
                font-size: 1.2rem;
                margin-bottom: 15px;
                color: var(--input-text-color, #E2E8F0);
            }

            /* Search Input within Dialog */
            .comfy-dialog.comfyui-dialog input[type="text"] {
                display: block;
                width: 100%;
                margin-bottom: 15px;
                padding: 10px;
                border: 1px solid var(--border-color-light, #4B5563);
                border-radius: 5px;
                background-color: var(--input-background-color, #2a2e33);
                color: var(--input-text-color, #E2E8F0);
                font-size: 14px;
                box-sizing: border-box; /* Ensure padding is included in width */
            }
            .comfy-dialog.comfyui-dialog input[type="text"]:focus {
                outline: none;
                box-shadow: 0 0 0 2px rgba(75, 85, 99, 0.5);
            }
            .comfy-dialog.comfyui-dialog input[type="text"]::placeholder {
                color: var(--input-text-color-muted, #6B7280);
            }

        /* LoRA File List within Dialog */
        .comfy-dialog.comfyui-dialog .lora-file-list {
            max-height: 300px;
            z-index: 1000;
            overflow-y: auto;
            overflow-x: hidden; /* Prevent horizontal scrollbar */
            list-style-type: none;
            padding: 0;
            margin: 0 0 15px 0;
            border: 1px solid var(--border-color-light, #4B5563);
            border-radius: 5px;
            background-color: var(--input-background-color, #2a2e33);
            box-sizing: border-box; /* Ensure padding is included in width */
        }
        .comfy-dialog.comfyui-dialog .lora-file-list li {
            padding: 10px;
            cursor: pointer;
            border-bottom: 1px solid #444;
        }
        .comfy-dialog.comfyui-dialog .lora-file-list li:hover {
            background-color: #3a3a3a;
        }
        .comfy-dialog.comfyui-dialog .lora-file-list li.selected {
            background-color: #555;
            color: #fff;
            font-weight: bold;
        }
        .comfy-dialog.comfyui-dialog .lora-file-list li:last-child {
            border-bottom: none;
        }

        /* Buttons within Dialog */
        .comfy-dialog.comfyui-dialog button.comfyui-button {
            padding: 10px 20px;
            margin: 5px;
            border: none;
            border-radius: 5px;
            background-color: #4a6da7;
            color: #fff;
            cursor: pointer;
            font-size: 1rem;
            transition: background-color 0.3s ease, transform 0.1s ease;
            box-sizing: border-box; /* Ensure padding is included in width */
        }
        .comfy-dialog.comfyui-dialog button.comfyui-button:hover {
            background-color: #5a7db7;
        }
        .comfy-dialog.comfyui-dialog button.comfyui-button:active {
            transform: scale(0.98);
            background-color: #3a5d97;
        }

        /* Button Container Alignment */
        .comfy-dialog.comfyui-dialog .button-container {
            display: flex;
            justify-content: flex-end;
        }

        /* Scrollbar Styling (optional) */
        .comfy-dialog.comfyui-dialog .lora-file-list::-webkit-scrollbar {
            width: 8px;
        }
        .comfy-dialog.comfyui-dialog .lora-file-list::-webkit-scrollbar-track {
            background: var(--input-background-color, #2a2e33);
        }
        .comfy-dialog.comfyui-dialog .lora-file-list::-webkit-scrollbar-thumb {
            background-color: #4B5563;
            border-radius: 4px;
        }
        .category-name {
            width: fit-content;
            min-width: 0;
            cursor: text;
        }
        .editable-label {
            cursor: text;
        }
        .editable-label input {
            font-size: 1.0rem;
            border: none;
            background: transparent;
            color: inherit;
            width: 100%;
        }
        .controls-row {
            display: flex;
            justify-content: space-between;
            align-items: stretch;
            margin-bottom: 15px;
        }
        .randomize-button {
            display: block;
            margin: 15px auto;
            padding: 10px 20px;
            font-size: 16px;
            width: 48%;
            color: white;
            background-color: #FFA500;
            border: none;
            border-radius: 20px;
            cursor: pointer;
            transition: background-color 0.3s;
        }
        .randomize-button:hover {
            background-color: #FFB52E;
        }
        .hide-inactive-container {
            display: flex;
            align-items: center;
            width: 38%;
            border-radius: 5px;
            padding: 5px;
        }
        .hide-inactive-container .label-container {
            display: flex;
            flex-direction: column;
            gap: 0px;
        }
        .large-checkbox {
            width: 24px;
            height: 24px;
            margin-right: 10px;
            cursor: pointer;
        }
        .label-text {
            font-weight: bold;
            line-height: 1.2;
        }
        `;
        document.head.appendChild(style);
    }

    async loadSliderData() {
        try {
            const response = await fetch('/slider_sidebar/data');
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const data = await response.json();
            this.sliderHooks = data.sliders;
            this.processSliderHooks(); // Make sure to process the hooks after loading
        } catch (error) {
            console.error("Could not load slider data:", error);
        }
    }

    setupNodeCreatedListener() {
        app.graph.addNodeListener("node_created", (node) => {
            console.log("Node created:", node.type);
            if (node.type === "LoraLoaderModelOnly") {
                this.onWorkflowLoaded();
            }
        });
    }

    setupNodeListeners() {
        const onNodeChange = (node) => {
            if (node.comfyClass === "LoraLoaderModelOnly") {
                this.updateAllSliders();
                app.graph.setDirtyCanvas(true, true);
            }
        };

        app.graph.onNodeAdded = (node) => {
            if (node.comfyClass === "LoraLoaderModelOnly") {
                this.setupLoraNodeListeners(node);
                onNodeChange(node);
            }
        };

        app.graph.onNodeRemoved = onNodeChange;

        // Set up listeners for existing LoraLoaderModelOnly nodes
        app.graph._nodes.forEach(node => {
            if (node.comfyClass === "LoraLoaderModelOnly") {
                this.setupLoraNodeListeners(node);
            }
        });
    }

    setupLoraNodeListeners(node) {
        const loraNameWidget = node.widgets.find(w => w.name === "lora_name");
        if (loraNameWidget) {
            this.setupLoraNameCallback(loraNameWidget, node);
        }

        // listen for widget changes
        node.onWidgetChanged = (name, value) => {
            if (name === "strength_model") {
                const hook = this.sliderHooks.find(h => h.loraName === loraNameWidget.value);
                if (hook) {
                    this.updateSliderState(hook, node);
                }
            }
        };

        this.setupModePropertyOverride(node, loraNameWidget);

        this.debugLog(`Lora node listener set up for node ${node.id}`);
    }

    setupLoraNameCallback(widget, node) {
        const originalCallback = widget.callback;
        widget.callback = (value) => {
            if (originalCallback) {
                originalCallback(value);
            }
            this.onLoraNameChanged(node, value);
        };
    }

    setupModePropertyOverride(node, loraNameWidget) {
        let nodeMode = node.mode;
        Object.defineProperty(node, 'mode', {
            get: () => nodeMode,
            set: (value) => {
                this.debugLog(`Mode change detected for node ${node.id}: ${value}`);
                nodeMode = value;
                this.updateSliderForNode(node, loraNameWidget);
            },
            enumerable: true,
            configurable: true
        });
    }

    updateSliderForNode(node, loraNameWidget) {
        if (loraNameWidget) {
            const hook = this.sliderHooks.find(h => h.loraName === loraNameWidget.value);
            if (hook) {
                this.debugLog(`Updating slider for Lora ${hook.name}`);
                this.updateSliderState(hook, node);
            } else {
                this.debugLog(`No matching hook found for Lora: ${loraNameWidget.value}`);
            }
        } else {
            this.debugLog(`No lora_name widget found for node ${node.id}`);
        }
    }
    
    updateFixReverseSlidersSettings(newValue) {
        this.fixReverseSliders = newValue;
        this.updateAllSliders();
    }

    onLoraNameChanged(node, newLoraName) {
        console.log(`Lora name changed to: ${newLoraName}`);
        this.updateAllSliders();
    }

    createSearchInput() {
        const input = $el("input.slider-sidebar-search", {
            type: "text",
            placeholder: "Search sliders...",
            oninput: () => this.handleSearch(input.value)
        });
        return input;
    }

    createAddSliderButton() {
        return $el("button.add-slider-button", {
            textContent: "Add Slider",
            onclick: () => this.showAddSliderDialog()
        });
    }

    ///ACTIVE TOGGLE STUFF
    createHideInactiveCheckbox() {
        const container = $el("div.hide-inactive-container");
        const checkbox = $el("input", {
            type: "checkbox",
            id: "hide-inactive-checkbox",
            className: "large-checkbox",
            onchange: () => this.toggleInactiveSliders(checkbox.checked)
        });
        const labelContainer = $el("div.label-container");
        const labelTop = $el("div.label-text", { textContent: "Hide" });
        const labelBottom = $el("div.label-text", { textContent: "Inactive" });
        labelContainer.appendChild(labelTop);
        labelContainer.appendChild(labelBottom);
        container.appendChild(checkbox);
        container.appendChild(labelContainer);
        return container;
    }

    toggleInactiveSliders(hide) {
        this.hideInactive = hide;
        this.applyHideInactive();
        this.updateAllSliders();
    }
    ///////

    handleSearch(searchTerm) {
        if (!this.accordion) return;
        searchTerm = searchTerm.toLowerCase();
        this.currentSearchTerm = searchTerm;
    
        const allSections = [...this.accordion.querySelectorAll('.accordion-section')];
        
        allSections.forEach(section => {
            const sliders = [...section.querySelectorAll('.slider-container')];
            let visibleSliders = 0;
    
            sliders.forEach(slider => {
                const sliderName = slider.querySelector('label')?.textContent.toLowerCase() || "";
                const sliderCategory = section.querySelector('.accordion-header')?.textContent.toLowerCase() || "";
                const authorPill = slider.querySelector('.author-pill .pill-text')?.textContent.toLowerCase() || "";
                const chkptPill = slider.querySelector('.chkpt-pill .pill-text')?.textContent.toLowerCase() || "";
    
                if (sliderName.includes(searchTerm) || 
                    sliderCategory.includes(searchTerm) || 
                    authorPill.includes(searchTerm) || 
                    chkptPill.includes(searchTerm)) {
                    slider.style.display = 'block';
                    visibleSliders++;
                } else {
                    slider.style.display = 'none';
                }
            });
    
            // Show/hide the entire section based on whether it has visible sliders
            section.style.display = visibleSliders > 0 ? 'block' : 'none';
        });
        // Apply hide inactive after search
        this.applyHideInactive();
    }

    applyHideInactive() {
        if (!this.accordion) return;
    
        const allSliders = [...this.accordion.querySelectorAll('.slider-container')];
        
        allSliders.forEach(slider => {
            // Only process sliders that passed the search filter
            if (slider.style.display !== 'none') {
                const isActive = !slider.classList.contains('disabled');
                const isFavorite = slider.querySelector('.pi-heart-fill');
    
                if (this.hideInactive) {
                    // When hiding inactive sliders
                    if (!isActive && !(this.showFavorites && isFavorite)) {
                        slider.style.display = 'none';
                    } else {
                        slider.style.display = '';
                    }
                } else {
                    // When not hiding inactive sliders, show all
                    slider.style.display = '';
                }
            }
        });
    
        // Hide empty sections
        const allSections = [...this.accordion.querySelectorAll('.accordion-section')];
        allSections.forEach(section => {
            const visibleSliders = [...section.querySelectorAll('.slider-container')].filter(s => s.style.display !== 'none');
            section.style.display = visibleSliders.length > 0 ? '' : 'none';
        });
    }

    async loadData() {
        try {
            const response = await api.fetchApi('/userdata/slider_sidebar_data.json');
            if (response.ok) {
                return await response.json();
            }
        } catch (error) {
            console.error('Error loading data:', error);
        }
        return {};
    }

    async saveData(data) {
        try {
            const response = await api.fetchApi('/userdata/slider_sidebar_data.json?overwrite=true', {
                method: 'POST',
                body: JSON.stringify(data),
                headers: {
                    'Content-Type': 'application/json'
                }
            });
            
            if (!response.ok) {
                throw new Error('Failed to save data');
            }
        } catch (error) {
            console.error('Error saving data:', error);
        }
    }    


    /// LORA CHECKER STUFF
    async loadAvailableLoras() {
        await this.initializeCategories();
        this.availableLoras = await this.fetchAvailableLoras();
        this.update(); // Re-render the sliders to reflect the availability
    } 

    async fetchAvailableLoras() {
        try {
            const response = await api.fetchApi('/loras/list');
            if (response.ok) {
                const data = await response.json();
                // Filter out files without extensions and then extract filenames and normalize them
                const loraFiles = data
                    .filter(item => /\.(safetensors|ckpt|pt)$/i.test(item.filename)) // Ensure valid extensions
                    .map(item => 
                        item.filename.replace(/\.(safetensors|ckpt|pt)$/i, '').toLowerCase()
                    );
                return loraFiles;
            } else {
                console.error('Failed to fetch LoRAs:', response.statusText);
            }
        } catch (error) {
            console.error('Error fetching available LoRAs:', error);
        }
        return [];
    }

    updateHideMissingSetting(newVal) {
        this.hideMissing = newVal;
        this.update();
    }

    async downloadLoraModel(modelId, container) {
        // Indicate that the download is starting
        container.classList.add('downloading');
        const downloadButton = container.querySelector('.download-button');
        if (downloadButton) {
            downloadButton.disabled = true;
            downloadButton.textContent = 'Downloading...';
        }
    
        try {
            const response = await api.fetchApi('/loras/download', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    modelId,
                    apiKey: this.apiKey || null, // Include the API key if provided
                }),
            });
    
            if (response.ok) {
                // Refresh the list of available LoRAs
                await this.loadAvailableLoras();
                // Re-render the sliders
                this.update();

                // Show success toast
                app.extensionManager.toast.add({
                    severity: "success",
                    summary: "LoRA Downloaded",
                    detail: "LoRA model was successfully downloaded and is now available.",
                    life: 3000
                });
            } else {
                const errorData = await response.json();
                console.error('Download failed:', errorData.message);
                alert(`Failed to download LoRA model: ${errorData.message}`);
            }
        } catch (error) {
            console.error('Error downloading LoRA model:', error);
            alert('An error occurred while downloading the LoRA model.');
        } finally {
            // Remove downloading state
            container.classList.remove('downloading');
            if (downloadButton) {
                downloadButton.disabled = false;
                downloadButton.textContent = 'Download';
            }
        }
    }

    updateApiKey(newApiKey) {
        this.apiKey = newApiKey;
    }
    
    ///////

    createRandomizeButton() {
        return $el("button.randomize-button", {
            textContent: "Randomize!",
            onclick: () => this.randomizeSliders()
        });
    }

    randomizeSliders() {
        this.sliderHooks.forEach(hook => {
            const sliderContainer = this.accordion.querySelector(`[data-lora-name="${hook.loraName}"]`);
            if (sliderContainer && !sliderContainer.classList.contains('disabled')) {
                const slider = sliderContainer.querySelector('input[type="range"]');
                const valueInput = sliderContainer.querySelector('input[type="number"]');
                if (slider && valueInput && !slider.disabled) {
                    const sliderConfig = this.getSliderConfig(hook);
                    const randomValue = Math.random() * (sliderConfig.max - sliderConfig.min) + sliderConfig.min;
                    const roundedValue = Math.round(randomValue / this.sliderStep) * this.sliderStep;
                    
                    // Update the slider and input value
                    slider.value = roundedValue;
                    valueInput.value = roundedValue.toFixed(2);
    
                    // Trigger the existing update mechanism
                    this.handleSliderChange(hook, roundedValue);
                }
            }
        });
    }

    /// CATEGORY ORDER STUFF

    async initializeCategories() {
        await this.loadCategoryOrder();
        await this.loadFavorites();
    
        // Load custom category names
        const data = await this.loadData();
        this.categoryNames = data.categoryNames || {};
    
        // Check if categoryOrder is empty
        if (!this.categoryOrder || this.categoryOrder.length === 0) {
            this.categoryOrder = [...this.defaultCategories];
            await this.saveCategoryOrder(); // Save the default order
            this.debugLog("Initialized categoryOrder with defaults:", this.categoryOrder);
        }
    
        // Proceed to process slider hooks and update the UI
        this.processSliderHooks();
        this.update(); // Render the UI after initialization
    }

    async loadCategoryOrder() {
        try {
            const data = await this.loadData();
            if (data.categoryOrder && Array.isArray(data.categoryOrder)) {
                this.categoryOrder = data.categoryOrder;
            } else {
                this.categoryOrder = [];
            }
            this.debugLog("Loaded category order:", this.categoryOrder);
        } catch (error) {
            console.error('Error loading category order:', error);
            this.categoryOrder = []; // Initialize as empty on error
        }
    }
    
    async saveCategoryOrder() {
        try {
            const data = await this.loadData(); // Load existing data
            data.categoryOrder = this.categoryOrder; // Update categoryOrder
            await this.saveData(data); // Save back to JSON
            this.debugLog("Saved category order:", data.categoryOrder);
        } catch (error) {
            console.error('Error saving category order:', error);
        }
    }

    setupDragAndDropForCategory() {
        let draggedElement = null;
        let dropIndicator = document.createElement('div');
        dropIndicator.className = 'drop-indicator';
        const OFFSET = 161; // dirty css hack
    
        this.accordion.addEventListener('dragstart', (e) => {
            if (e.target.classList.contains('accordion-header')) {
                const category = e.target.dataset.category;
                const fixedOrder = app.ui.settings.getSettingValue("Slider Sidebar.Visual.fixedOrder", true);
                if (fixedOrder && (category === "Favorites" || category === "Custom")) {
                    e.preventDefault(); // Prevent dragging of 'Favorites' and 'Custom' when fixedOrder is true
                    return;
                }
    
                draggedElement = e.target.closest('.accordion-section');
                e.dataTransfer.setData('text/plain', category);
                
                // Add dragging class for visual feedback
                draggedElement.classList.add('dragging');
    
                // Create a custom drag image
                const dragImage = e.target.cloneNode(true);
                dragImage.style.width = `${e.target.offsetWidth}px`;
                dragImage.style.backgroundColor = 'rgba(60, 60, 60, 0.8)';
                dragImage.style.position = 'absolute';
                dragImage.style.top = '-1000px';
                document.body.appendChild(dragImage);
                
                e.dataTransfer.setDragImage(dragImage, 0, 0);
                
                setTimeout(() => {
                    document.body.removeChild(dragImage);
                }, 0);
            }
        });
    
        this.accordion.addEventListener('dragover', (e) => {
            e.preventDefault();
            const header = e.target.closest('.accordion-header');
            if (header && draggedElement && header.parentNode !== draggedElement) {
                const category = header.dataset.category;
                const fixedOrder = app.ui.settings.getSettingValue("Slider Sidebar.Visual.fixedOrder", true);
                if (fixedOrder && (category === "Favorites" || category === "Custom")) {
                    // Do not allow dropping before 'Favorites' or 'Custom' when fixedOrder is true
                    return;
                }
    
                const rect = header.getBoundingClientRect();
                const accordionRect = this.accordion.getBoundingClientRect();
                
                dropIndicator.style.width = `${rect.width}px`;
                dropIndicator.style.left = `${rect.left - accordionRect.left}px`;
                dropIndicator.style.top = `${rect.top - accordionRect.top + OFFSET}px`;
                
                this.accordion.appendChild(dropIndicator);
            }
        });
    
        this.accordion.addEventListener('dragleave', (e) => {
            if (!e.target.closest('.accordion-header')) {
                dropIndicator.remove();
            }
        });
    
        this.accordion.addEventListener('dragend', () => {
            if (draggedElement) {
                draggedElement.classList.remove('dragging'); // Remove dragging class
                draggedElement = null;
                dropIndicator.remove();
                this.updateCategoryOrder();
            }
        });
    
        this.accordion.addEventListener('drop', (e) => {
            e.preventDefault();
            dropIndicator.remove();
            const header = e.target.closest('.accordion-header');
            if (header && draggedElement && header.parentNode !== draggedElement) {
                const category = header.dataset.category;
                const fixedOrder = app.ui.settings.getSettingValue("Slider Sidebar.Visual.fixedOrder", true);
                if (fixedOrder && (category === "Favorites" || category === "Custom")) {
                    // Do not allow dropping before 'Favorites' or 'Custom' when fixedOrder is true
                    return;
                }
    
                header.parentNode.parentNode.insertBefore(draggedElement, header.parentNode);
                this.updateCategoryOrder();
            }
        });
    }
    
    async updateCategoryOrder() {
        const sections = this.accordion.querySelectorAll('.accordion-section');
        this.categoryOrder = Array.from(sections).map(section => section.dataset.category);
        // Debounce the save operation to reduce frequency
        if (this.saveTimeout) clearTimeout(this.saveTimeout);
        this.saveTimeout = setTimeout(() => {
            this.saveCategoryOrder();
        }, 500);
    }

    
    ///////

    /// ALL TEH FAVORITES STUFF
    async loadFavorites() {
        try {
            const response = await api.fetchApi('/userdata/slider_sidebar_data.json');
            if (response.ok) {
                const data = await response.json();
                this.favorites = new Set(data.favorites);
            }
        } catch (error) {
            console.error('Error loading favorites:', error);
        }
    }
    
    async saveFavorites() {
        try {
            const data = await this.loadData();
            data.favorites = Array.from(this.favorites);
            await this.saveData(data);
        } catch (error) {
            console.error('Error saving favorites:', error);
        }
    }
    
    
    toggleFavorite(hook) {
        if (this.favorites.has(hook.name)) {
            this.favorites.delete(hook.name);
        } else {
            this.favorites.add(hook.name);
        }
        this.saveFavorites();
        this.update();
    }

    ///////


    processSliderHooks() {
        this.categories = {};
        this.sliderHooks.forEach(hook => {
            if (this.nsfwEnabled || hook.type !== "NSFW") {
                // Use original category name for internal structure
                const categoryName = hook.type;
                if (!this.categories[categoryName]) {
                    this.categories[categoryName] = [];
                }
                this.categories[categoryName].push(hook);
            }
        });
    }

    getSliderConfig(hook) {
        if (this.ignoreSliderLimits) {
            return{
                min: -20,
                max: 20,
                defaultValue: 0
            }
        } else {
            if (this.fixReverseSliders && hook.reversed) {
                return {
                    min: -hook.maxValue,
                    max: -hook.minValue,
                    defaultValue: -hook.defaultValue
                };
            } else {
            return {
                min: hook.minValue,
                max: hook.maxValue,
                defaultValue: hook.defaultValue
                };
            }
        }
    }

    getSliderLabel(hook) {
        if (this.fixReverseSliders || !hook.reversed) {
            return hook.name;
        }
        return `${hook.name} (Reversed)`;
    }

    createAuthorPill(author) {
        return $el("span.pill.author-pill", [
            $el("i.pi.pi-user"),
            $el("span.pill-text", { textContent: author })
        ]);
    }

    createChkptPills(chkpt) {
        const chkpts = chkpt.split(',').map(c => c.trim());
        return chkpts.map(c => 
            $el("span.pill.chkpt-pill", [
                $el("i.pi.pi-verified"),
                $el("span.pill-text", { textContent: c })
            ])
        );
    }

    showModelInfoPopup(hook, iconElement) {
        // Check if a popup already exists and remove it
        if (this.currentPopup) {
            this.currentPopup.remove();
        }
    
        // Create the popup container
        const popup = $el("div.model-info-popup", { className: "model-info-popup" });
    
        // Create the close button
        const closeButton = $el("i", {
            className: "pi pi-times",
            style: {
                position: "absolute",
                top: "5px",
                right: "5px",
                cursor: "pointer",
                fontSize: "1.2em"
            },
            onclick: () => {
                popup.remove();
                document.removeEventListener("click", closePopup);
                this.currentPopup = null;
            }
        });
    
        // Create the content container
        const contentContainer = $el("div", {
            style: {
                marginTop: "25px" // Add margin to avoid overlap with close button
            }
        });

        const civitAiLink = $el("a", {
            href: `https://civitai.com/models/${hook.modelId}`,
            textContent: `View Model on CivitAI`,
            target: "_blank",
            style: {
                display: "block",
                fontSize: "1em",
                marginBottom: "10px",
                color: "#4a6da7",
                textDecoration: "underline",
            }
        });
        contentContainer.appendChild(civitAiLink);

        let currentIndex = 0; // Index to track the current image being shown
        let images = []; // Array to hold the fetched images

        // Declare updateImage as a placeholder function
        let updateImage = () => {};

        const prevButton = $el("button", {
            textContent: "< Prev Image",
            style: {
                marginLeft: "10px",
                fontSize: "0.9em",
                cursor: "pointer",
            },
            onclick: () => {
                if (currentIndex > 0) {
                    currentIndex--;
                    updateImage(images[currentIndex]);
                }
            }
        });

        const nextButton = $el("button", {
            textContent: "Next Image >",
            style: {
                marginLeft: "10px",
                fontSize: "0.9em",
                cursor: "pointer",
            },
            onclick: () => {
                if (currentIndex < images.length - 1) {
                    currentIndex++;
                    updateImage(images[currentIndex]);
                }
            }
        });

        // Add buttons to the same line as the CivitAI link
        contentContainer.appendChild(prevButton);
        contentContainer.appendChild(nextButton);

        // Add enhance keywords if available
        if (hook.enhanceKeywords) {
            const keywordsText = $el("p", {
                style: {
                    fontSize: "0.9em",
                    marginBottom: "10px",
                    lineHeight: "1.4"
                }
            });
        
            keywordsText.innerHTML = `For stronger results try using <span class="enhance-keywords">${hook.enhanceKeywords}</span> in your prompts.`;
        
            const keywordStyle = $el("style", {
                textContent: `
                    .enhance-keywords {
                        font-weight: bold;
                        color: #4a90e2;
                        background-color: rgba(74, 144, 226, 0.1);
                        padding: 2px 4px;
                        border-radius: 3px;
                        display: inline-block;
                        margin: 2px 0;
                    }
                `
            });
        
            contentContainer.appendChild(keywordStyle);
            contentContainer.appendChild(keywordsText);
        }
    
        // Add a loading indicator
        const loadingText = $el("p", { textContent: "Loading image..." });
        contentContainer.appendChild(loadingText);
    
        // Append the close button and content container to popup
        popup.appendChild(closeButton);
        popup.appendChild(contentContainer);
    
        // Position the popup relative to the icon
        const rect = iconElement.getBoundingClientRect();
        let top = rect.bottom + window.scrollY;
        let left = rect.left + window.scrollX;
    
        // Append the popup to the body first to measure its size later
        document.body.appendChild(popup);
    
        // Adjust the position to ensure it's within the viewport
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;

        // Apply the initial position
        popup.style.top = `${top}px`;
        popup.style.left = `${left}px`;

        // Class to trigger CSS transitions
        setTimeout(() => {
            popup.classList.add('show');
        }, 0);
        
        // Fetch the image from Civitai
        this.fetchModelImages(hook.modelId)
        .then((fetchedImages) => {
            images = fetchedImages; // Store the fetched images
            currentIndex = 0; // Start with the first image

            // Remove the loading text
            loadingText.remove();

            if (images.length > 0) {
                // Function to update the displayed image with your existing logic
                updateImage = (imageUrl) => {
                    // Remove the old image if it exists
                    const oldImage = contentContainer.querySelector("img");
                    if (oldImage) {
                        oldImage.remove();
                    }

                    // Create the new image element
                    const image = $el("img", {
                        src: imageUrl,
                        classname: "model-info-popup",
                        onload: function() {
                            const isWidthLarger = this.width > this.height;
                            document.documentElement.style.setProperty('--slider-popup-max-width', 
                                isWidthLarger ? `${app.sliderSidebar.popupMaxWidth}%` : `${app.sliderSidebar.popupMaxWidth / 2.1}%`);
                            document.documentElement.style.setProperty('--slider-popup-max-height', 
                                isWidthLarger ? '100%' : `${app.sliderSidebar.popupMaxWidth}%`);
                        
                            // After the image has loaded, we calculate the actual popup height
                            const popupHeight = popup.offsetHeight;
                            const popupWidth = popup.offsetWidth;

                            // Check if the popup fits below the icon, if not, place it above
                            if (top + popupHeight > viewportHeight) {

                                // Calculate the new top position (above the icon)
                                top = rect.top + window.scrollY - popupHeight;

                                // Check if the popup now goes above the viewport (cut off at the top)
                                if (top < 0) {
                                    top = 0; // Reposition so it stays fully in the viewport
                                }
                            }

                            // Ensure the popup doesn't overflow horizontally
                            if (left + popupWidth > viewportWidth) {
                                left = Math.max(0, viewportWidth - popupWidth);
                            }

                            // Apply the adjusted position after recalculating
                            popup.style.top = `${top}px`;
                            popup.style.left = `${left}px`;

                            // If the image is vertical, set the width to 5% less than the popupMaxWidth
                            if (!isWidthLarger) {
                                //this.style.width = `${app.sliderSidebar.popupMaxWidth - 5}%`;
                            }
                        
                    }
                });
    
                // Append the image to the content container
                contentContainer.appendChild(image);
            };

                    // Show the first image
                    updateImage(images[currentIndex]);
                } else {
                    const noImagesText = $el("p", { textContent: "No images available." });
                    contentContainer.appendChild(noImagesText);
                }
            })
            .catch((error) => {
                // Remove the loading text and show an error message
                loadingText.textContent = "Failed to load images.";
                console.error("Error fetching model images:", error);
            });

    
        // Update the current popup reference
        this.currentPopup = popup;
    
        // Close the popup when clicking outside
        const closePopup = (event) => {
            if (!popup.contains(event.target) && event.target !== iconElement) {
                popup.remove();
                document.removeEventListener("click", closePopup);
                this.currentPopup = null;
            }
        };
        setTimeout(() => {
            document.addEventListener("click", closePopup);
        }, 0);
    }      

    async fetchModelImages(modelId) {
        if (this.imageCache.has(modelId)) {
            return this.imageCache.get(modelId); // Return the cached array of images
        }
    
        try {
            const response = await fetch(`https://civitai.com/api/v1/models/${modelId}`);
            if (!response.ok) {
                throw new Error(`HTTP error! Status: ${response.status}`);
            }
            const data = await response.json();
    
            // Extract all image URLs from modelVersions
            const images = data.modelVersions[0]?.images.map(image => {
                const originalUrl = image.url;
                return originalUrl.replace(/\/width=\d+\//, '/'); // Correct the URL
            }) || [];
    
            if (images.length > 0) {
                this.imageCache.set(modelId, images); // Cache the array of images
                return images;
            } else {
                throw new Error("No images found for this model.");
            }
        } catch (error) {
            console.error("Error fetching model images:", error);
            throw error;
        }
    }

    confirmDeleteSlider(slider) {
        return new Promise((resolve) => {
            const buttons = [
                $el('button', {
                    type: 'button',
                    textContent: 'Yes',
                    onclick: () => {
                        dialog.close();
                        resolve(true);
                    }
                }),
                $el('button', {
                    type: 'button',
                    textContent: 'No',
                    onclick: () => {
                        dialog.close();
                        resolve(false);
                    }
                })
            ];
            const dialog = new ComfyDialog('div', buttons);
            dialog.show(`Are you sure you want to delete the slider "${slider.name}"?`);
        });
    }

    async deleteSlider(slider) {
        try {
            // Read the JSON data file
            const data = await this.loadData();
    
            // Remove the slider from customSliders
            if (data.customSliders && Array.isArray(data.customSliders)) {
                data.customSliders = data.customSliders.filter(
                    (s) => s.loraName !== slider.loraName
                );
                // Save the updated data back to the JSON file
                await this.saveData(data);
                this.debugLog("Custom sliders after deletion:", data.customSliders);
            }
    
            // Reload the custom sliders
            await this.loadCustomSliders();
    
            // Update the UI
            this.update();
        } catch (error) {
            console.error('Error deleting custom slider:', error);
        }
    }    

    createSlider(hook) {
        const container = $el("div.slider-container");
        container.dataset.loraName = hook.loraName; // this is vital to all slider listeners so don't remove it
    
        // First row: checkbox, name with info icon, author pill, and favorite icon
        const firstRow = $el("div.slider-first-row");
        firstRow.style.display = "flex";
        firstRow.style.alignItems = "center";
        firstRow.style.gap = "8px"; // Adjust spacing as needed
    
        const toggleCheckbox = $el("input", {
            type: "checkbox",
            onchange: () => this.handleToggle(hook, toggleCheckbox.checked)
        });
    
        // Label container with info icon
        const labelContainer = $el("label", { className: "label-container" });
    
        // Introduce a <span> for the label text
        const labelText = $el("span", { 
            textContent: this.getSliderLabel(hook),
            className: "label-text editable-label", // For easy selection in updateSliderState
            ondblclick: (e) => this.makeEditable(e.target, hook)
        });
    
        // Create the info icon
        const infoIcon = $el("i", {
            className: "pi pi-info-circle",
            style: {
                cursor: "pointer",
                fontSize: "0.9em"
            },
            onclick: (e) => {
                e.stopPropagation();
                this.showModelInfoPopup(hook, infoIcon);
            }
        });
    
        // Append labelText and infoIcon to labelContainer
        labelContainer.appendChild(labelText);
        labelContainer.appendChild(infoIcon);

        if (hook.type === "Custom") {
            const deleteIcon = $el("i", {
                className: "pi pi-trash slider-delete-icon",
                style: {
                    cursor: "pointer",
                    marginLeft: "10px",
                    color: "#dc3545" // Red color for delete
                },
                title: "Delete Slider",
                onclick: (e) => {
                    e.stopPropagation(); // Prevent triggering other click events
                    this.confirmDeleteSlider(hook).then((confirmed) => {
                        if (confirmed) {
                            this.deleteSlider(hook);
                        }
                    });
                }
            });
            labelContainer.appendChild(deleteIcon);
        }
    
        const authorPill = this.createAuthorPill(hook.author);
    
        // Add favorite icon
        const favoriteIcon = $el("i", {
            className: this.favorites.has(hook.name) ? "pi pi-heart-fill" : "pi pi-heart",
            style: {
                cursor: "pointer",
                marginLeft: "5px"
            },
            onclick: (e) => {
                e.stopPropagation();
                this.toggleFavorite(hook);
            }
        });
    
        // Append elements to firstRow in the correct order
        firstRow.appendChild(toggleCheckbox);
        firstRow.appendChild(labelContainer);
        firstRow.appendChild(authorPill);
        firstRow.appendChild(favoriteIcon);
    
        // Second row: slider, value input, and chkpt pill
        const secondRow = $el("div.slider-second-row");
        secondRow.style.display = "flex";
        secondRow.style.alignItems = "center";
        secondRow.style.gap = "1px"; // Adjust spacing as needed
    
        const sliderConfig = this.getSliderConfig(hook);
        const slider = $el("input", {
            type: "range",
            min: sliderConfig.min,
            max: sliderConfig.max,
            step: this.sliderStep,
            value: sliderConfig.defaultValue,
            oninput: (e) => this.updateSliderAndInput(hook, slider, valueInput, e.target.value)
        });
        const valueInput = $el("input.slider-value", {
            type: "number",
            value: sliderConfig.defaultValue,
            step: this.sliderStep,
            onchange: (e) => this.updateSliderAndInput(hook, slider, valueInput, e.target.value),
            style: {
                width: "60px"
            }
        });
        const chkptPills = this.createChkptPills(hook.chkpt);
    
        secondRow.appendChild(slider);
        secondRow.appendChild(valueInput);
        chkptPills.forEach(pill => secondRow.appendChild(pill));

    
        // Append both rows to the container
        container.appendChild(firstRow);
        container.appendChild(secondRow);

        const normalizedHookName = hook.loraName.replace(/\.(safetensors|ckpt|pt)$/, '').toLowerCase();
        const isAvailable = this.availableLoras.map(name => name.toLowerCase()).includes(normalizedHookName);

        // Set initial state
        const node = this.findLoraNode(hook.loraName);

        if (isAvailable) {
            if (node) {
                // LoRA is available and node exists in the graph
                toggleCheckbox.checked = !node.mode;
                slider.disabled = node.mode;
                valueInput.disabled = node.mode;
            } else {
                // LoRA is available but node does not exist
                // Set up drag-and-drop
                this.setupDragAndDrop(container, hook);
                container.classList.add('disabled');
                // Enable UI elements
                slider.disabled = false;
                valueInput.disabled = true;
                toggleCheckbox.checked = true;
            }
        } else {
            container.classList.add('missing-lora', 'disabled');
            // Disable drag and drop
            container.draggable = false;
            container.ondragstart = null;
        
            // Disable UI elements
            slider.disabled = true;
            valueInput.disabled = true;
            toggleCheckbox.disabled = true;

            // Create Download button
            const downloadButton = document.createElement('button');
            downloadButton.innerHTML = 'Download <i class="pi pi-download" style="margin-left: 5px;"></i>';
            downloadButton.classList.add('download-button');
            
            // Append the download button inside the container
            container.appendChild(downloadButton);

            // Add click event listener
            downloadButton.addEventListener('click', () => {
                this.downloadLoraModel(hook.modelId, container);
            });           
        }

        return container;
    }

    updateSliderAndInput(hook, slider, input, value) {
        // Ensure the value is within the slider's range
        value = Math.max(slider.min, Math.min(slider.max, value));
        
        // Update both slider and input
        slider.value = value;
        input.value = value;

        // Call the original handleSliderChange method
        this.handleSliderChange(hook, value);
    }

    handleSliderChange(hook, value) {
        const node = this.findLoraNode(hook.loraName);
        if (node) {
            const strengthWidget = node.widgets.find(w => w.name === "strength_model");
            if (strengthWidget) {
                let adjustedValue = parseFloat(value);
                if (this.fixReverseSliders && hook.reversed) {
                    adjustedValue = -adjustedValue;
                }
                strengthWidget.value = adjustedValue;
                if (node.onWidgetChanged) {
                    node.onWidgetChanged("strength_model", adjustedValue);
                }
                app.graph.setDirtyCanvas(true, true);
            }
        }
    }

    handleToggle(hook, checked) {
        const node = this.findLoraNode(hook.loraName);
        if (node) {
            node.mode = checked ? 0 : 4; // 0 for active, 4 for bypassed
            this.debugLog(`Toggle changed for node ${node.id}: mode = ${node.mode}`);
            app.graph.setDirtyCanvas(true, true);
        } else {
            this.debugLog(`No node found for Lora: ${hook.loraName}`);
        }
    }

    updateSliderState(hook, node) {
        const sliderContainer = this.accordion.querySelector(`[data-lora-name="${hook.loraName}"]`);
        if (!sliderContainer) return;
    
        const toggleCheckbox = sliderContainer.querySelector('input[type="checkbox"]');
        const label = sliderContainer.querySelector('label');
        const labelText = label.querySelector('.label-text'); // Target the <span> with class 'label-text'
        const slider = sliderContainer.querySelector('input[type="range"]');
        const valueSpan = sliderContainer.querySelector('.slider-value');
        const valueInput = sliderContainer.querySelector('input[type="number"]');
    
        // Update label text without affecting the info icon
        if (labelText) {
            labelText.textContent = this.getSliderLabel(hook);
        }
    
        if (node) {
            // Node is present
            sliderContainer.classList.remove('disabled');
            slider.disabled = false; // Always enable the slider when node is present
            valueInput.disabled = false;  // Enable the numerical input
            toggleCheckbox.checked = node.mode === 0; // Checked when mode is 0 (active)
            toggleCheckbox.disabled = false; // Enable the checkbox
/*             if (this.hideInactive && node.mode !== 0) {
                // Hide inactive sliders, but show favorites if the setting is enabled
                if (this.showFavorites && this.favorites.has(hook.name)) {
                    sliderContainer.style.display = '';
                } else {
                    sliderContainer.style.display = 'none';
                }
            } else {
                sliderContainer.style.display = '';
            }     */

            // Update slider configuration
            const sliderConfig = this.getSliderConfig(hook);
            slider.min = sliderConfig.min;
            slider.max = sliderConfig.max;
    
            const strengthWidget = node.widgets.find(w => w.name === "strength_model");
            if (strengthWidget && slider && valueInput) {
                let displayValue = strengthWidget.value;
                if (this.fixReverseSliders && hook.reversed) {
                    displayValue = -displayValue;
                }
                slider.value = displayValue;
                valueInput.value = displayValue.toFixed(2);
                if (valueSpan) valueSpan.textContent = displayValue;  // Only update if found
            }
    
            this.disableDragAndDrop(sliderContainer);
        } else {
            // No node present
            sliderContainer.classList.add('disabled');
            toggleCheckbox.checked = false;
            toggleCheckbox.disabled = true; // Disable the checkbox when no node
            slider.disabled = true;
            valueInput.disabled = true;
            slider.value = hook.defaultValue;
            if (valueSpan) {
                valueSpan.textContent = hook.defaultValue;
            }
/*             if (this.hideInactive) {
                // Hide inactive sliders, but show favorites if the setting is enabled
                if (this.showFavorites && this.favorites.has(hook.name)) {
                    sliderContainer.style.display = '';
                } else {
                    sliderContainer.style.display = 'none';
                }
            } else {
                sliderContainer.style.display = '';
            } */

            this.enableDragAndDrop(sliderContainer, hook);
        }
    }
    
    updateAllSliders() {
        this.sliderHooks.forEach(hook => {
            const node = this.findLoraNode(hook.loraName);
            this.updateSliderState(hook, node);
            // Reapply the current search after updating the accordion
            this.handleSearch(this.currentSearchTerm || '');
            // Then apply hide inactive
            this.applyHideInactive();
        });
    }

    findLoraNode(loraName) {
        return app.graph._nodes.find(node => 
            node.comfyClass === "LoraLoaderModelOnly" && 
            node.widgets.some(w => w.name === "lora_name" && w.value === loraName)
        );
    }

    setupDragAndDrop(container, hook) {
        container.draggable = true;
        container.ondragstart = (e) => {
            e.stopPropagation(); // Prevent event bubbling
            console.log("Drag started for:", hook.name);
            e.dataTransfer.setData("application/json", JSON.stringify(hook));
            e.dataTransfer.effectAllowed = "copy";
        };
    }

    enableDragAndDrop(container, hook) {
        container.draggable = true;
        container.ondragstart = (e) => {
            e.stopPropagation();
            console.log("Drag started for:", hook.name);
            e.dataTransfer.setData("application/json", JSON.stringify(hook));
            e.dataTransfer.effectAllowed = "copy";
        };
    }

    disableDragAndDrop(container) {
        container.draggable = false;
        container.ondragstart = null;
    }

    setupCanvasDropHandling() {
        const canvas = this.app.canvas.canvas;
        canvas.ondragover = (e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = "copy";
        };
        canvas.ondrop = (e) => {
            e.preventDefault();
            e.stopPropagation();
            const hookData = e.dataTransfer.getData("application/json");
            if (hookData) {
                const hook = JSON.parse(hookData);
                console.log("Dropped hook:", hook);
                const canvasRect = canvas.getBoundingClientRect();
                const x = (e.clientX - canvasRect.left) / this.app.canvas.ds.scale - this.app.canvas.ds.offset[0];
                const y = (e.clientY - canvasRect.top) / this.app.canvas.ds.scale - this.app.canvas.ds.offset[1];
                this.createLoraNode(hook, x, y);
            }
        };
    }

    createLoraNode(hook, x, y) {
        console.log("Creating Lora node at:", x, y);
        
        const node = LiteGraph.createNode("LoraLoaderModelOnly");
        if (!node) {
            console.error("Failed to create LoraLoaderModelOnly node");
            return;
        }
        node.pos = [x, y];
        
        // Set node title
        node.title = `Lora - ${hook.name} Slider`;
        
        // Set widget values
        for (const widget of node.widgets) {
            if (widget.name === "lora_name") {
                widget.value = hook.loraName;
            } else if (widget.name === "strength_model") {
                widget.value = hook.defaultValue; // Use the new default value
            }
        }

        // Add the node to the graph
        app.graph.add(node);
        
        // Find an existing nodes to connect to
        if (this.smartWiring) {
            const existingLoraNode = this.findExistingLoraNode();
            if (existingLoraNode) {
                this.wireNewLoraNode(node, existingLoraNode);
            }
        }
        
        console.log("Node created and added to graph:", node);

        // Ensure the canvas is updated
        app.graph.setDirtyCanvas(true, true);
        
        // Update the sidebar
        this.updateAllSliders();
    }


    createAccordionSection(category, sliders) {
        const section = $el("div.accordion-section");
        section.dataset.category = category;
        const header = $el("div.accordion-header", {
            draggable: true,
            dataset: { category: category },
            onclick: (e) => {
                if (e.target === header || e.target.tagName === 'I') {
                    this.toggleAccordion(section);
                }
            }
        });

        // Safely handle custom names: if no custom name, fall back to original category name
        const displayName = this.categoryNames[category] || category;

        // Create editable span for category name
        const categoryNameSpan = $el("span.category-name.editable-label", {
            textContent: displayName,
            ondblclick: (e) => this.makeEditableCategory(e.target, category)
        });
        header.appendChild(categoryNameSpan);

        // Create icon element and add to the header
        const icon = $el("i.pi.pi-caret-down"); //default
        icon.style.marginLeft = "auto"; // Ensures it is aligned to the right
        header.appendChild(icon); // Append the icon to the header

        const content = $el("div.accordion-content");

        sliders.forEach(slider => {
            if (!slider || !slider.loraName) {
                console.warn('Invalid slider or missing loraName:', slider);
                return; // Skip this slider
            }
    
            const normalizedLoraName = slider.loraName.replace(/\.(safetensors|ckpt|pt)$/, '').toLowerCase();
            const isAvailable = this.availableLoras.includes(normalizedLoraName);
    
            if (this.hideMissing && !isAvailable) {
                return; // Skip adding this slider
            }
    
            const sliderElement = this.createSlider(slider);
            content.appendChild(sliderElement);
        });
    
        section.appendChild(header);
        section.appendChild(content);

        // update carets as needed, placegholder until we save toggle state
        // data.load.togglestate
    
        return section;
    }

    toggleAccordion(section) {
        const content = section.querySelector(".accordion-content");
        const icon = section.querySelector("i");
    
        if (content.style.display === "none") {
            content.style.display = "block";
            icon.classList.remove("pi-caret-left");
            icon.classList.add("pi-caret-down");
        } else {
            content.style.display = "none";
            icon.classList.remove("pi-caret-down");
            icon.classList.add("pi-caret-left");
        }
    }

    handleEnhance(hook, checked) {
        console.log(`Enhance ${hook.name} changed to ${checked}`);
        // Implement enhance logic here, possibly using hook.enhanceKeywords
    }

    onWorkflowLoaded() {
        if (!this.accordion) return;
        // Update all sliders to reflect the current state of nodes
        this.sliderHooks.forEach(hook => {
            const node = this.findLoraNode(hook.loraName);
            if (node) {
                const sliderContainer = this.accordion.querySelector(`[data-lora-name="${hook.loraName}"]`);
                if (sliderContainer) {
                    const toggleCheckbox = sliderContainer.querySelector('input[type="checkbox"]');
                    const slider = sliderContainer.querySelector('input[type="range"]');
                    const strengthWidget = node.widgets.find(w => w.name === "strength_model");
                    
                    if (toggleCheckbox) toggleCheckbox.checked = node.mode === 0; // Checked when mode is 0 (active)
                    if (slider) slider.disabled = node.mode === 4; // Disabled when mode is 4 (bypassed)
                    if (strengthWidget && slider) {
                        slider.value = strengthWidget.value;
                        const valueSpan = sliderContainer.querySelector('span');
                        if (valueSpan) valueSpan.textContent = strengthWidget.value;
                    }
                }
            }
        });
    }

    filterSlidersByModel(sliders) {
        if (this.modelFilter === "All") {
            return sliders;
        }
    
        return sliders.filter(slider => {
            const chkpts = (slider.chkpt || "").toLowerCase().split(',').map(c => c.trim());
            switch (this.modelFilter) {
                case "Pony":
                    return chkpts.some(c => c.includes("pony"));
                case "SDXL":
                    return chkpts.some(c => c.includes("sdxl"));
                case "Flux":
                    return chkpts.some(c => c.includes("flux"));
                case "SD1.5":
                    return chkpts.some(c => c.includes("sd") && c.includes("1.5"));
                case "Other":
                    return chkpts.every(c => !c.includes("pony") && !c.includes("sdxl") && 
                                             !c.includes("flux") && !(c.includes("sd") && c.includes("1.5")));
                default:
                    return true;
            }
        });
    }

    //LORA AUTO WIRING TEST, MADNESS
    findExistingLoraNode() {
        return app.graph._nodes.find(node => 
            node.comfyClass === "LoraLoaderModelOnly" && 
            node.outputs && 
            node.outputs.length > 0 && 
            node.outputs[0].links && 
            node.outputs[0].links.length > 0
        );
    }

    wireNewLoraNode(newNode, existingNode) {
        if (!existingNode.outputs || !existingNode.outputs[0] || !existingNode.outputs[0].links) {
            console.log("Existing node has no valid output connections");
            return;
        }
    
        const existingOutputLinks = existingNode.outputs[0].links.map(linkId => app.graph.links[linkId]).filter(Boolean);
        if (existingOutputLinks.length === 0) {
            console.log("No valid output links found for existing node");
            return;
        }
    
        // Connect the model input of the new node to the model output of the existing node
        if (newNode.inputs && newNode.inputs[0] && existingNode.outputs && existingNode.outputs[0]) {
            existingNode.connect(0, newNode, 0);
        }
    
        // Connect the output of the new node to all nodes the existing node was connected to
        if (newNode.outputs && newNode.outputs[0]) {
            existingOutputLinks.forEach(link => {
                const targetNode = app.graph.getNodeById(link.target_id);
                if (targetNode) {
                    newNode.connect(0, targetNode, link.target_slot);
                }
            });
        }
    
        // Remove all original connections from the existing node
        existingOutputLinks.forEach(link => {
            existingNode.disconnectOutput(0, link.target_id);
        });
    
        console.log(`New Lora node wired into the workflow, connected to ${existingOutputLinks.length} target(s)`);
    }

    ///////

    // NSFW STUFF BECAUSE I CARE
    // Commented out dialog until it can go over settings, RIP
    /*
    showNSFWConfirmationDialog(newVal) {
        const dialog = new ComfyDialog();
        dialog.show($el("div", {}, [
            $el("h3", {}, "Enable NSFW Content"),
            $el("p", {}, "Are you sure you want to enable NSFW content? This may include adult or sensitive material."),
            $el("p", {}, "Please ensure you are allowed to view this content and are in an appropriate setting."),
            $el("div", {}, [
                $el("button", { 
                    type: "button", 
                    textContent: "Cancel",
                    onclick: () => {
                        app.ui.settings.setSettingValue("Slider Sidebar.General.nsfw", false);
                        dialog.close();
                    }
                }),
                $el("button", { 
                    type: "button", 
                    textContent: "Confirm",
                    onclick: () => {
                        this.updateNSFWSetting(newVal);
                        dialog.close();
                    }
                })
            ])
        ]));
    }
    */

    ///CUSTOM SLIDERS OH MY!!!
    async fetchLoraDetails() {
        try {
            const response = await api.fetchApi('/loras/list');
            if (response.ok) {
                const data = await response.json();
                // You can use the entire object as needed
                const loraDetails = data.map(item => ({
                    name: item.filename.replace(/\.(safetensors|ckpt|pt)$/, '').toLowerCase(),
                    path: item.path
                }));
                return loraDetails;
            } else {
                console.error('Failed to fetch LoRAs:', response.statusText);
            }
        } catch (error) {
            console.error('Error fetching LoRAs:', error);
        }
        return [];
    }

    async showAddSliderDialog() {
        try {
            // Step 1: Fetch available LoRA files and their details
            const loraFiles = await this.fetchAvailableLoras(); // Array of strings: filenames without extensions, all lowercase
            this.loraDetails = await this.fetchLoraDetails(); // Assuming this remains unchanged
    
            // Step 2: Extract existing LoRA filenames from sliderHooks (both custom and pre-packaged)
            // Strip extensions from loraName and convert to lowercase to match loraFiles
            const existingLoraNames = this.sliderHooks
                .map(slider => {
                    if (typeof slider.loraName === 'string') {
                        return slider.loraName.replace(/\.(safetensors|pt)$/i, '').toLowerCase();
                    }
                    return null; // Handle unexpected types
                })
                .filter(name => name !== null); // Remove any null entries
    
            // Step 3: Apply Filters to loraFiles
            const filteredLoraFiles = loraFiles.filter(file => {
                // No need to check extensions as fetchAvailableLoras already filters them
                // Check if the file is not already present in sliderHooks
                return !existingLoraNames.includes(file);
            });
    
            // Step 4: Initialize selection variables
            let selectedFile = null;
            let filteredFiles = [...filteredLoraFiles]; // Start with the filtered list
    
            // Step 5: Create Search Input Element
            const searchInput = $el("input", {
                type: "text",
                placeholder: "Search LoRAs...",
                oninput: (e) => {
                    const searchTerm = e.target.value.toLowerCase();
                    filteredFiles = filteredLoraFiles.filter(file => 
                        file.toLowerCase().includes(searchTerm)
                    );
                    updateLoraList();
                }
            });
    
            // Step 6: Create LoRA List Element
            const loraList = $el("ul.lora-file-list");
    
            // Step 7: Update LoRA List Display
            const updateLoraList = () => {
                loraList.innerHTML = "";
                filteredFiles.forEach(file => {
                    const li = $el("li", {
                        textContent: file, // 'file' is a string
                        onclick: (e) => {
                            // Remove 'selected' class from all list items
                            loraList.querySelectorAll('li').forEach(li => li.classList.remove('selected'));
                            // Add 'selected' class to the clicked item
                            e.currentTarget.classList.add('selected');
                            // Set the selected file
                            selectedFile = file;
                        }
                    });
                    loraList.appendChild(li);
                });
            };
    
            // Step 8: Initial Population of the List
            updateLoraList();
    
            // Step 9: Create Dialog Content
            const content = $el("div", [
                $el("h3", { textContent: "Select a LoRA file" }),
                searchInput,
                loraList
            ]);
    
            // Step 10: Initialize Dialog
            const dialog = new ComfyAsyncDialog([
                { value: "add", text: "Add Slider" },
                { value: "cancel", text: "Cancel" }
            ]);
    
            // Step 11: Show Modal and Handle Result
            try {
                const result = await dialog.showModal(content);
                if (result === "add" && selectedFile) {
                    await this.handleLoraFileSelection(selectedFile);
                }
            } catch (error) {
                console.error("Error in file selection:", error);
            } finally {
                dialog.element.remove();
            }
        } catch (error) {
            console.error("Error in showAddSliderDialog:", error);
        }
    }
       
    async saveCustomSlider(customSlider) {
        const data = await this.loadData();
        if (!data.customSliders) {
            data.customSliders = [];
        }
        data.customSliders.push(customSlider);
        await this.saveData(data);
    }
    
    async loadCustomSliders() {
        const data = await this.loadData();
        if (data.customSliders && Array.isArray(data.customSliders)) {
            this.sliderHooks = this.sliderHooks.filter(hook => hook.type !== "Custom");
            this.sliderHooks = [...this.sliderHooks, ...data.customSliders];
        }
        if (data.sliderNames) {
            this.sliderHooks.forEach(hook => {
                if (data.sliderNames[hook.loraName]) {
                    hook.name = data.sliderNames[hook.loraName];
                }
            });
        }
    }

    async handleLoraFileSelection(selectedName) {
        try {
            const selectedLora = this.loraDetails.find(lora => lora.name === selectedName);
            if (!selectedLora) {
                console.error("Selected LoRA not found:", selectedName);
                return;
            }
        
            const filepath = selectedLora.path;
            const filename = selectedLora.path.split(/[/\\]/).pop(); 
    
            const hashResponse = await api.fetchApi('/hash_lora', {
                method: 'POST',
                body: JSON.stringify({ filepath }),
            });
            
            if (!hashResponse.ok) {
                console.error("Error hashing LoRA file. Status:", hashResponse.status);
                return;
            }
            
            const { hash } = await hashResponse.json();

            const civitaiResponse = await fetch(`https://civitai.com/api/v1/model-versions/by-hash/${hash}`);
            
            if (!civitaiResponse.ok) {
                console.error("Error fetching model from Civitai. Status:", civitaiResponse.status);
                return;
            }
            
            const modelData = await civitaiResponse.json();
    
            const modelId = modelData.modelId;
            if (!modelId) {
                console.error("modelId not found in modelData:", modelData);
                return;
            }
      
            // do ANOTHER call because Civit is super dumb and doesn't put the author in the hash API
            const creatorResponse = await fetch(`https://civitai.com/api/v1/models/${modelId}`);
            
            if (!creatorResponse.ok) {
                console.error("Error fetching creator information from Civitai. Status:", creatorResponse.status);
                return;
            }
            
            const creatorData = await creatorResponse.json();
    
            const authorUsername = creatorData.creator?.username || "Unknown";

            // Extract trained words from the latest model version
            let enhanceKeywords = "";
            if (creatorData.modelVersions && creatorData.modelVersions.length > 0) {
                const latestVersion = creatorData.modelVersions[0];
                if (latestVersion.trainedWords && latestVersion.trainedWords.length > 0) {
                    enhanceKeywords = latestVersion.trainedWords.join(", ");
                }
            }
    
            const customSlider = {
                name: creatorData.name || selectedName,
                loraName: filename,
                type: "Custom",
                subtype: null,
                minValue: -5,
                maxValue: 5,
                defaultValue: 0,
                reversed: false,
                enhanceKeywords: enhanceKeywords,
                author: authorUsername,
                modelId: modelId || "",
                chkpt: modelData.baseModel || "Unknown"
            };
        
            this.sliderHooks.push(customSlider);
    
            await this.saveCustomSlider(customSlider);
    
            this.update();
            
            console.log("Custom slider added successfully:", customSlider);
        } catch (error) {
            console.error("Error in handleLoraFileSelection:", error);
        }
    }   
    
    ///////

    /// Edit Name Stuff

    makeEditable(element, hook) {
        const currentText = element.textContent;
        const input = $el("input", {
            type: "text",
            value: currentText,
            onblur: (e) => this.saveEdit(e.target, element, hook),
            onkeydown: (e) => {
                if (e.key === "Enter") {
                    e.target.blur();
                }
            }
        });
        element.textContent = "";
        element.appendChild(input);
        input.focus();
    }
    
    async saveEdit(input, element, hook) {
        const newName = input.value.trim();
        if (newName && newName !== hook.name) {
            hook.name = newName;
            await this.saveCustomSliderName(hook);
        }
        element.textContent = this.getSliderLabel(hook);
    }
    
    async saveCustomSliderName(updatedHook) {
        const data = await this.loadData();
        if (!data.sliderNames) {
            data.sliderNames = {};
        }
        data.sliderNames[updatedHook.loraName] = updatedHook.name;
        await this.saveData(data);
    }

    makeEditableCategory(element, originalCategory) {
        const currentText = element.textContent;
        const input = $el("input", {
            type: "text",
            value: currentText,
            onblur: (e) => this.saveEditCategory(e.target, element, originalCategory),
            onkeydown: (e) => {
                if (e.key === "Enter") {
                    e.target.blur();
                }
            }
        });
        element.textContent = "";
        element.appendChild(input);
        input.focus();
    }

    async saveEditCategory(input, element, originalCategory) {
        const newCategoryName = input.value.trim();
        if (newCategoryName && newCategoryName !== originalCategory) {
            await this.saveCategoryName(originalCategory, newCategoryName);
            this.updateCategoryName(originalCategory, newCategoryName);
        }
        element.textContent = newCategoryName || originalCategory;
    }
    
    async saveCategoryName(originalCategory, newCategoryName) {
        const data = await this.loadData();
        if (!data.categoryNames) {
            data.categoryNames = {};
        }
        data.categoryNames[originalCategory] = newCategoryName;
        await this.saveData(data);
    
        // Update local categoryNames
        this.categoryNames[originalCategory] = newCategoryName;
    
        // Update UI
        this.update();
    }
    
    updateCategoryName(originalCategory, newCategoryName) {
        // Update the category name in the UI and internal data structures
        const section = this.accordion.querySelector(`[data-category="${originalCategory}"]`);
        if (section) {
            section.dataset.category = newCategoryName;
            section.querySelector('.category-name').textContent = newCategoryName;
        }
        if (this.categories[originalCategory]) {
            this.categories[newCategoryName] = this.categories[originalCategory];
            delete this.categories[originalCategory];
        }
        this.update();
    }

    applyCategoryNames(categoryNames) {
        for (const [originalName, newName] of Object.entries(categoryNames)) {
            if (this.categories[originalName]) {
                this.categories[newName] = this.categories[originalName];
                delete this.categories[originalName];
            }
        }
    }

    ///////

    updateNSFWSetting(newVal) {
        this.nsfwEnabled = newVal;
        this.update();
    }

    updateSliderStep(newVal) {
        this.sliderStep = newVal;
        this.update();
    }

    updatePopupMaxWidth(newVal) {
        this.popupMaxWidth = newVal;
        document.documentElement.style.setProperty('--slider-popup-max-width', `${this.popupMaxWidth}%`);
    }
    
    updatePillVisibility(newVal) {
        this.showPills = newVal;
        document.documentElement.style.setProperty('--slider-pill-opacity', this.showPills ? '1' : '0');
    }

    updateSmartWiring(newVal) {
        this.smartWiring = newVal;
    }

    updateModelFilter(newVal) {
        this.modelFilter = newVal;
        this.update();
    }

    updateSliderLimits(newVal) {
        this.ignoreSliderLimits = newVal;
        this.update();
    }

    updateShowFavorites(newVal) {
        this.showFavorites = newVal;
        this.update();
    }

    ///////

    debugLog(message) {
        if (this.debug) {
            console.log(`[SliderSidebar Debug] ${message}`);
        }
    }

    update() {
        if (!this.accordion) return;
        this.accordion.innerHTML = "";
        this.processSliderHooks();
        const allCategories = { ...this.categories, ...this.customCategories };
    
        // Retrieve the 'fixedOrder' setting value
        const fixedOrder = app.ui.settings.getSettingValue("Slider Sidebar.Visual.fixedOrder", true);
    
        let orderedCategories;
    
        if (fixedOrder) {
            // Ensure 'Favorites' and 'Custom' are at the top in that order
            orderedCategories = [
                "Favorites",
                "Custom",
                ...this.categoryOrder.filter(cat => cat !== "Favorites" && cat !== "Custom")
            ];
        } else {
            // Use the user-defined categoryOrder as is
            orderedCategories = [...this.categoryOrder];
        }
    
        // Include any additional categories not specified in categoryOrder
        const additionalCategories = Object.keys(allCategories).filter(cat => !orderedCategories.includes(cat));
        orderedCategories = [...orderedCategories, ...additionalCategories];
    
        const uniqueCategories = Array.from(new Set(orderedCategories));
    
        for (const category of uniqueCategories) {
            let sliders = [];
    
            if (category === "Favorites") {
                if (this.favorites.size === 0) continue; // Skip if no favorites
                sliders = this.sliderHooks.filter(hook => this.favorites.has(hook.name));
            } else if (category === "Custom") {
                sliders = this.sliderHooks.filter(hook => hook.type === "Custom");
                if (sliders.length === 0) continue; // Skip if no custom sliders
            } else {
                sliders = allCategories[category];
                if (!sliders || sliders.length === 0) continue; // Skip if no sliders in category
                // Exclude favorites from other categories
                sliders = sliders.filter(hook => !this.favorites.has(hook.name));
                if (sliders.length === 0) continue; // Skip if all sliders are favorites
            }

            // Apply model filter
            sliders = this.filterSlidersByModel(sliders);
            if (sliders.length === 0) continue;
    
            const section = this.createAccordionSection(category, sliders);
            this.accordion.appendChild(section);
    
            // Trigger fade-in animation
            setTimeout(() => {
                section.classList.add('show');
            }, 0);
        }
    
        // Setup drag and drop
        this.setupDragAndDropForCategory();
    
        // Update slider states after creating them
        this.updateAllSliders();
        
        // Setup canvas drop handling
        this.setupCanvasDropHandling();
    
        // Apply current search after updating the accordion
        this.handleSearch(this.searchInput.value);
    }
    
    
}

app.registerExtension({
    name: "comfy.slider.sidebar",
    async setup() {

        const sliderSidebar = new SliderSidebar(app);
        app.sliderSidebar = sliderSidebar;

        app.ui.settings.addSetting({
            id: "Slider Sidebar.Sliders.unreversed",
            name: "'Fix' Reverse Sliders",
            type: "boolean",
            defaultValue: false,
            onChange: (newVal, oldVal) => {
                if (app.sliderSidebar) {
                    app.sliderSidebar.updateFixReverseSlidersSettings(newVal);
                }
            }
        });

        app.ui.settings.addSetting({
            id: "Slider Sidebar.Visual.hideMissing",
            name: "Hide Sliders Missing Model Files",
            type: "boolean",
            defaultValue: false,
            onChange: (newVal, oldVal) => {
                if (app.sliderSidebar) {
                    app.sliderSidebar.updateHideMissingSetting(newVal);
                }
            }
        });

        app.ui.settings.addSetting({
            id: "Slider Sidebar.General.apiKey",
            name: "Civitai API Key (for Downloading)",
            type: "text",
            defaultValue: "",
            placeholder: "Enter your Civitai API Key",
            onChange: (newVal, oldVal) => {
                if (app.sliderSidebar) {
                    app.sliderSidebar.updateApiKey(newVal);
                }
            }
        });

        app.ui.settings.addSetting({
            id: "Slider Sidebar.General.nsfw",
            name: "NSFW Sliders",
            type: "boolean",
            defaultValue: false,
            onChange: (newVal, oldVal) => {
                app.sliderSidebar.updateNSFWSetting(newVal);
/*                 if (newVal && !this.nsfwEnabled) {
                    app.sliderSidebar.showNSFWConfirmationDialog(newVal);
                } else {
                    app.sliderSidebar.updateNSFWSetting(newVal);
                } */
            }
        });

        app.ui.settings.addSetting({
            id: "Slider Sidebar.Visual.fixedOrder",
            name: "Keep 'Favorites' and 'Custom' At Top",
            type: "boolean",
            defaultValue: true, // Default to fixed order
            onChange: (newVal, oldVal) => {
                if (app.sliderSidebar) {
                    app.sliderSidebar.update();
                }
            }
        });

        app.ui.settings.addSetting({
            id: "Slider Sidebar.General.smartWires",
            name: "Smart Node Wiring",
            type: "boolean",
            defaultValue: true, // Default to fixed order
            onChange: (newVal, oldVal) => {
                if (app.sliderSidebar) {
                    app.sliderSidebar.updateSmartWiring(newVal);
                }
            }
        });

        app.ui.settings.addSetting({
            id: "Slider Sidebar.Sliders.sliderLimits",
            name: "Ingore Set Slider Limits",
            type: "boolean",
            defaultValue: false, // Default to fixed order
            onChange: (newVal, oldVal) => {
                if (app.sliderSidebar) {
                    app.sliderSidebar.updateSliderLimits(newVal);
                }
            }
        });

        app.ui.settings.addSetting({
            id: "Slider Sidebar.Visual.showModels",
            name: "Base Models to Show",
            type: 'combo',
            options: ['All', 'Pony', 'Flux', 'SDXL', 'SD1.5', 'Other'],
            defaultValue: 'All',
            onChange: (newVal, oldVal) => {
                if (app.sliderSidebar) {
                    app.sliderSidebar.updateModelFilter(newVal);
                }
            }
        });

        app.ui.settings.addSetting({
            id: "Slider Sidebar.Visual.showFavorites",
            name: "Always Show Favorites",
            type: 'boolean',
            defaultValue: true,
            onChange: (newVal, oldVal) => {
                if (app.sliderSidebar) {
                    app.sliderSidebar.updateShowFavorites(newVal);
                }
            }
        });

        app.ui.settings.addSetting({
            id: "Slider Sidebar.Visual.popupMaxWidth",
            name: "Popup Max Size (%)",
            type: "slider",
            defaultValue: 70,
            attrs: { min: 1, max: 100, step: 5, },
            onChange: (newVal) => {
                if (app.sliderSidebar) {
                    app.sliderSidebar.updatePopupMaxWidth(newVal);
                }
            }
        });

        app.ui.settings.addSetting({
            id: "Slider Sidebar.Sliders.sliderStep",
            name: "Slider Increment",
            type: "slider",
            defaultValue: 0.25,
            attrs: { min: 0.01, max: 1, step: 0.01, },
            onChange: (newVal) => {
                if (app.sliderSidebar) {
                    app.sliderSidebar.updateSliderStep(newVal);
                }
            }
        });

        app.ui.settings.addSetting({
            id: "Slider Sidebar.Visual.showPills",
            name: "Show Author and Checkpoint Tags",
            type: "boolean",
            defaultValue: true,
            onChange: (newVal) => {
                if (app.sliderSidebar) {
                    app.sliderSidebar.updatePillVisibility(newVal);
                }
            }
        });

        app.extensionManager.registerSidebarTab({
            id: "slider.sidebar",
            title: "Slider Sidebar",
            icon: "pi pi-sliders-h",
            tooltip: "Slider Sidebar",
            type: "custom",
            render: (el) => {
                el.appendChild(sliderSidebar.element);
                sliderSidebar.update();
                sliderSidebar.setupNodeListeners();
            }
        });
    },    
});