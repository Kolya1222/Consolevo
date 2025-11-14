<?php
namespace roilafx\Consolevo\Analyzers;

class EvoAnalyzer
{
    public function analyzeCoreClasses()
    {
        $analysis = [
            'methods' => [],
            'properties' => [],
            'constants' => [],
            'functions' => []
        ];

        // Автоматически находим все PHP файлы в src
        $classes = $this->scanSrcDirectory(EVO_CORE_PATH . 'src');
        
        foreach ($classes as $className => $filePath) {
            if (file_exists($filePath)) {
                $this->analyzeClassWithParams($className, $filePath, $analysis);
            } else {
                error_log("File not found: {$filePath}");
            }
        }

        // Анализируем глобальные функции с параметрами
        $this->analyzeGlobalFunctionsWithParams($analysis);

        return $analysis;
    }

    /**
     * Рекурсивно сканирует папку src и находит все PHP файлы
     */
    private function scanSrcDirectory($directory)
    {
        $classes = [];
        
        if (!is_dir($directory)) {
            return $classes;
        }

        $iterator = new \RecursiveIteratorIterator(
            new \RecursiveDirectoryIterator($directory, \RecursiveDirectoryIterator::SKIP_DOTS)
        );

        foreach ($iterator as $file) {
            if ($file->isFile() && $file->getExtension() === 'php') {
                $filePath = $file->getRealPath();
                $className = $this->extractClassNameFromFile($filePath);
                
                if ($className) {
                    $classes[$className] = $filePath;
                }
            }
        }

        return $classes;
    }

    /**
     * Извлекает имя класса из файла
     */
    private function extractClassNameFromFile($filePath)
    {
        $content = file_get_contents($filePath);
        
        // Ищем namespace
        $namespace = '';
        if (preg_match('/namespace\s+([^;]+);/', $content, $matches)) {
            $namespace = $matches[1];
        }

        // Ищем имя класса
        if (preg_match('/class\s+(\w+)/', $content, $matches)) {
            $className = $matches[1];
            return $namespace ? $namespace . '\\' . $className : $className;
        }

        return null;
    }

    /**
     * Анализирует класс с параметрами методов
     */
    private function analyzeClassWithParams($className, $filePath, &$analysis)
    {
        $content = file_get_contents($filePath);
        
        // Ищем методы с параметрами
        preg_match_all('/(?:public|private|protected)\s+function\s+(\w+)\s*\(([^)]*)\)/i', $content, $matches);
        
        foreach ($matches[1] as $index => $method) {
            if (!in_array($method, ['__construct', '__destruct', '__get', '__set'])) {
                $paramsString = trim($matches[2][$index]);
                $params = $this->parseParameters($paramsString);
                
                $analysis['methods'][] = [
                    'name' => $className . '::' . $method,
                    'params' => $params,
                    'full_signature' => $className . '::' . $method . '(' . $paramsString . ')'
                ];
            }
        }

        // Извлекаем свойства
        preg_match_all('/(?:public|private|protected)\s+\$(\w+)/i', $content, $matches);
        foreach ($matches[1] as $property) {
            $analysis['properties'][] = $className . '->' . $property;
        }

        // Извлекаем константы
        preg_match_all('/const\s+(\w+)\s*=/i', $content, $matches);
        foreach ($matches[1] as $constant) {
            $analysis['constants'][] = $className . '::' . $constant;
        }
    }

    /**
     * Парсит строку параметров в массив
     */
    private function parseParameters($paramsString)
    {
        if (empty($paramsString)) {
            return [];
        }

        $params = [];
        $paramParts = explode(',', $paramsString);
        
        foreach ($paramParts as $paramPart) {
            $paramPart = trim($paramPart);
            
            // Извлекаем информацию о параметре
            preg_match('/(?:(\$\w+)\s*=?\s*([^,]*))|([^$]\w+)/', $paramPart, $matches);
            
            if (!empty($matches[1])) {
                // Параметр с переменной
                $paramName = $matches[1];
                $defaultValue = trim($matches[2] ?? '');
                
                $params[] = [
                    'name' => $paramName,
                    'default' => $defaultValue,
                    'full' => $paramPart
                ];
            } elseif (!empty($matches[3])) {
                // Тип или другой параметр
                $params[] = [
                    'name' => 'unknown',
                    'default' => '',
                    'full' => $paramPart
                ];
            }
        }
        
        return $params;
    }

    /**
     * Анализирует глобальные функции с параметрами
     */
    private function analyzeGlobalFunctionsWithParams(&$analysis)
    {
        // Базовые глобальные функции Evolution CMS с типичными параметрами
        $globalFunctions = [
            [
                'name' => 'evolutionCMS',
                'params' => [],
                'full_signature' => 'evolutionCMS()'
            ],
            [
                'name' => 'db',
                'params' => [['name' => '$sql', 'default' => '', 'full' => '$sql']],
                'full_signature' => 'db($sql)'
            ],
            [
                'name' => 'getTV',
                'params' => [
                    ['name' => '$tvName', 'default' => '', 'full' => '$tvName'],
                    ['name' => '$docId', 'default' => '', 'full' => '$docId'],
                    ['name' => '$published', 'default' => '1', 'full' => '$published = 1']
                ],
                'full_signature' => 'getTV($tvName, $docId, $published = 1)'
            ],
            [
                'name' => 'getTemplate',
                'params' => [['name' => '$templateId', 'default' => '', 'full' => '$templateId']],
                'full_signature' => 'getTemplate($templateId)'
            ],
            [
                'name' => 'getDocument',
                'params' => [['name' => '$docId', 'default' => '', 'full' => '$docId']],
                'full_signature' => 'getDocument($docId)'
            ],
            [
                'name' => 'getDocuments',
                'params' => [
                    ['name' => '$parentId', 'default' => '', 'full' => '$parentId'],
                    ['name' => '$published', 'default' => '1', 'full' => '$published = 1'],
                    ['name' => '$deleted', 'default' => '0', 'full' => '$deleted = 0']
                ],
                'full_signature' => 'getDocuments($parentId, $published = 1, $deleted = 0)'
            ]
        ];

        $analysis['functions'] = $globalFunctions;
    }

    public function generateCompletionData(): array
    {
        $analysis = $this->analyzeCoreClasses();
        
        $completionData = [
            'methods' => is_array($analysis['methods'] ?? null) ? $analysis['methods'] : [],
            'properties' => is_array($analysis['properties'] ?? null) ? array_values(array_unique($analysis['properties'])) : [],
            'constants' => is_array($analysis['constants'] ?? null) ? array_values(array_unique($analysis['constants'])) : [],
            'functions' => is_array($analysis['functions'] ?? null) ? $analysis['functions'] : [],
            'generated_at' => date('Y-m-d H:i:s'),
            'version' => '1.0'
        ];

        return $completionData;
    }
}