import { getCsrfToken } from '../utils/helpers.js';

/**
 * Только загрузка данных с сервера - никаких статических данных
 */
export async function analyzeEvolutionCMS() {
    try {
        console.log('Загрузка данных Evolution CMS с сервера...');
        
        const headers = {
            'X-CSRF-TOKEN': getCsrfToken(),
            'X-Requested-With': 'XMLHttpRequest',
            'Accept': 'application/json'
        };
        
        const response = await fetch('/consolevo/analysis/unified-data', {
            method: 'GET',
            headers: headers,
            credentials: 'include'
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const result = await response.json();
        
        if (result.success) {
            console.log('Данные загружены:', {
                source: result.source,
                methods: result.data.methods?.length || 0
            });
            return result.data;
        } else {
            throw new Error(result.error || 'Unknown server error');
        }
        
    } catch (error) {
        console.error('Ошибка загрузки данных:', error);
        // Если не удалось загрузить, возвращаем пустой объект
        return {
            methods: [],
            properties: [],
            constants: [],
            functions: [],
            snippets: [],
            source: 'error',
            error: error.message
        };
    }
}

/**
 * Генерация данных для автодополнения ТОЛЬКО из полученных данных
 */
export function generateEvoCompletionsFromAnalysis(analysis) {
    const completions = [];

    // Методы
    if (analysis.methods && Array.isArray(analysis.methods)) {
        analysis.methods.forEach(method => {
            if (method.name) {
                const methodName = method.name.replace(/.*::/, '');
                completions.push({
                    name: `$evo->${methodName}`,
                    value: `$evo->${methodName}`,
                    score: 1000,
                    meta: 'evo method',
                    description: method.full_signature || `Метод ${methodName}`,
                    params: method.params || [],
                    docHTML: generateMethodDocHTML(methodName, method.params, method.full_signature)
                });
            }
        });
    }

    // Свойства
    if (analysis.properties && Array.isArray(analysis.properties)) {
        analysis.properties.forEach(property => {
            completions.push({
                name: `$evo->${property}`,
                value: `$evo->${property}`,
                score: 900,
                meta: 'evo property',
                description: `Свойство Evolution CMS`
            });
        });
    }

    // Функции
    if (analysis.functions && Array.isArray(analysis.functions)) {
        analysis.functions.forEach(func => {
            if (func.name) {
                completions.push({
                    name: func.name,
                    value: func.name,
                    score: 800,
                    meta: 'evo function',
                    description: func.full_signature || `Функция ${func.name}`,
                    params: func.params || []
                });
            }
        });
    }

    // Константы
    if (analysis.constants && Array.isArray(analysis.constants)) {
        analysis.constants.forEach(constant => {
            completions.push({
                name: constant,
                value: constant,
                score: 700,
                meta: 'evo constant',
                description: `Константа Evolution CMS`
            });
        });
    }

    return completions;
}

/**
 * Генерация сниппетов ТОЛЬКО из полученных данных
 */
export function generateEvoSnippetsFromAnalysis(analysis) {
    const snippets = [];

    // Сниппеты с сервера
    if (analysis.snippets && Array.isArray(analysis.snippets)) {
        analysis.snippets.forEach(snippet => {
            snippets.push({
                name: snippet.name,
                content: snippet.content,
                tabTrigger: snippet.tabTrigger || snippet.name.toLowerCase(),
                description: snippet.description || snippet.name,
                meta: snippet.meta || 'evo'
            });
        });
    }

    return snippets;
}

/**
 * Вспомогательные функции (минимальные)
 */
function generateMethodDocHTML(methodName, params, fullSignature) {
    let html = `<div class="ace_doc-tooltip">
        <div class="ace_doc-title">${methodName}</div>`;
    
    if (fullSignature) {
        html += `<div class="ace_doc-signature">${fullSignature}</div>`;
    }
    
    if (params && params.length > 0) {
        html += `<div class="ace_doc-section">
            <div class="ace_doc-section-title">Параметры:</div>`;
        
        params.forEach((param) => {
            html += `<div class="ace_doc-param">
                <span class="ace_doc-param-name">${param.name}</span>
                ${param.default ? `<span class="ace_doc-param-default"> = ${param.default}</span>` : ''}
            </div>`;
        });
        
        html += `</div>`;
    }
    
    html += `</div>`;
    return html;
}