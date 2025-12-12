// Конфигурация редактора
export const EDITOR_CONFIG = {
    fontSize: 14,
    fontFamily: "'Fira Code', 'Consolas', 'Monaco', monospace",
    showLineNumbers: true,
    showGutter: true,
    showPrintMargin: false,
    highlightActiveLine: true,
    highlightSelectedWord: true,
    highlightGutterLine: true,
    cursorStyle: "smooth",
    enableMultiselect: true,
    scrollPastEnd: 0.1,
    behavioursEnabled: true,
    wrapBehavioursEnabled: true,
    autoScrollEditorIntoView: true
};

export const THEMES = {
    default: "ace/theme/tomorrow_night",
    monokai: "ace/theme/monokai", 
    github: "ace/theme/github",
    chrome: "ace/theme/chrome"
};

export const MODES = {
    php: "ace/mode/php",
    sql: "ace/mode/sql"
};

export const API_CONFIG = {
    timeout: 30000,
    maxRetries: 3,
    retryDelay: 1000
};

export const DEFAULT_PREFERENCES = {
    theme: 'ace/theme/tomorrow_night',
    fontSize: 14,
    wrapMode: true,
    enableAutocomplete: true,
    enableSnippets: true,
    showLineNumbers: true,
    showInvisibles: false,
    highlightActiveLine: true
};

export const PREFERENCES_SCHEMA = {
    version: {
        type: 'string'
    },
    theme: {
        type: 'string',
        options: [
            'ace/theme/tomorrow_night',
            'ace/theme/monokai', 
            'ace/theme/github',
            'ace/theme/chrome'
        ]
    },
    fontSize: {
        type: 'number',
        min: 8,
        max: 24
    },
    wrapMode: {
        type: 'boolean'
    },
    enableAutocomplete: {
        type: 'boolean'
    },
    enableSnippets: {
        type: 'boolean'
    },
    showLineNumbers: {
        type: 'boolean'
    },
    showInvisibles: {
        type: 'boolean'
    },
    highlightActiveLine: {
        type: 'boolean'
    }
};

export const STATE_CONFIG = {
    autoSaveDelay: 2000,
    maxStateAge: 7 * 24 * 60 * 60 * 1000, // 7 дней
    maxStateSize: 1024 * 1024, // 1MB
    version: '1.0'
};

/**
 * Конфигурация модулей и селекторов DOM
 * @constant {Object}
 */
export const MODULES_CONFIG = {
    initializationOrder: [
        'preferences', 
        'state',
        'output',
        'api',
        'editor',
        'history'
    ],
    domSelectors: {
        themeSelector: '#theme-selector',
        fontSizeSelector: '#font-size-selector',
        wrapModeToggle: '#wrap-mode-toggle',
        executeBtn: '#execute-code',
        executeEditorBtn: '#execute-editor',
        clearConsoleBtn: '#clear-console',
        clearEditorBtn: '#clear-editor',
        showHistoryBtn: '#show-history',
        executionTime: '#execution-time',
        memoryUsage: '#memory-usage'
    }
};

/**
 * Символы промптов для разных типов сообщений с FontAwesome
 * @constant {Object}
 */
export const PROMPT_SYMBOLS = {
    info: { symbol: '<i class="fas fa-info-circle"></i>', class: 'prompt-info', isHtml: true },
    success: { symbol: '<i class="fas fa-check-circle"></i>', class: 'prompt-success', isHtml: true },
    warning: { symbol: '<i class="fas fa-exclamation-triangle"></i>', class: 'prompt-warning', isHtml: true },
    error: { symbol: '<i class="fas fa-times-circle"></i>', class: 'prompt-error', isHtml: true },
    input: { symbol: '<i class="fas fa-keyboard"></i>', class: 'prompt-input', isHtml: true }
};