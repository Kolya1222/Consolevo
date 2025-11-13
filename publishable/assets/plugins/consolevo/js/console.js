import ConsoleManager from './modules/ConsoleManager.js';

document.addEventListener('DOMContentLoaded', async function() {
    const consoleElement = document.getElementById('code-editor');
    const config = {
        executeRoute: consoleElement.dataset.executeRoute,
        consoleType: consoleElement.dataset.consoleType
    }; 
    try {
        window.consoleManager = new ConsoleManager(config);
        await window.consoleManager.init();
        
    } catch (error) {
        console.error('Ошибка инициализации ConsoleManager:', error);
        
        // ПОКАЗЫВАЕМ СООБЩЕНИЕ ОБ ОШИБКЕ
        const outputElement = document.getElementById('console-output');
        if (outputElement) {
            outputElement.innerHTML += `
                <div class="console-line fade-in">
                    <span class="prompt error">!!</span>
                    <span>Ошибка инициализации: ${error.message}</span>
                </div>
                <div class="console-line fade-in">
                    <span class="prompt info">>></span>
                    <span>Проверьте консоль браузера для подробностей</span>
                </div>
            `;
        }
    }
});