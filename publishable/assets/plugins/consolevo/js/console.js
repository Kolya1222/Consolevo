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
        
        window.addEventListener('message', function(event) {
            if (event.data.type === 'DESTROY_CONSOLE') {
                console.log('Получена команда уничтожения консоли');
                
                if (window.consoleManager) {
                    window.consoleManager.destroy();
                    window.consoleManager = null;
                }

                if (event.source) {
                    event.source.postMessage({
                        type: 'CONSOLE_DESTROYED',
                        status: 'success'
                    }, '*');
                }
            }
        });
        
        window.addEventListener('unload', function() {
            if (window.consoleManager) {
                window.consoleManager.destroy();
                window.consoleManager = null;
            }
        });
        
    } catch (error) {
        console.error('Ошибка инициализации ConsoleManager:', error);
        
        if (window.consoleManager) {
            try {
                window.consoleManager.destroy();
            } catch (e) {
                console.error('Ошибка при уничтожении после сбоя:', e);
            }
            window.consoleManager = null;
        }

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