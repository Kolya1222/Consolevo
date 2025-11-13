<?php
namespace roilafx\Consolevo\Controllers;

use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;

class PhpConsoleController
{
    public function index()
    {
        // Проверяем права администратора
        if (!$this->isManager()) {
            return response()->json([
                'success' => false,
                'error' => 'Доступ запрещен. Только для администраторов.'
            ], 403);
        }
        
        return view('consolevo::php-console');
    }

    public function execute(Request $request): JsonResponse
    {
        // Проверяем права администратора
        if (!$this->isManager()) {
            return response()->json([
                'success' => false,
                'error' => 'Доступ запрещен. Только для администраторов.'
            ], 403);
        }
        
        $code = $request->input('code');
        
        if (empty($code)) {
            return response()->json([
                'success' => false,
                'error' => 'Пустой код'
            ], 400);
        }
        
        try {
            $result = $this->executeAsManager($code);
            
            return response()->json([
                'success' => true,
                'output' => $result['output'],
                'result' => $result['result'],
                'execution_time' => $result['execution_time'],
                'memory_usage' => $result['memory_usage']
            ]);
            
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'error' => $e->getMessage(),
                'line' => $e->getLine()
            ], 500);
        }
    }

    /**
     * Проверяем что пользователь - менеджер
     */
    private function isManager(): bool
    {
        return evolutionCMS()->getLoginUserType() === 'manager';
    }

    /**
     * Выполнение кода с правами менеджера (минимальные ограничения)
     */
    private function executeAsManager(string $code): array
    {
        $startTime = microtime(true);
        $startMemory = memory_get_usage(true);
        
        try {
            // Нормализуем код
            $normalizedCode = $this->normalizePhpCode($code);
            
            // Базовая проверка синтаксиса
            $this->validatePhpSyntax($normalizedCode);
            
            // Проверяем только КРИТИЧЕСКИ опасные операции
            if ($this->containsCriticalDanger($normalizedCode)) {
                throw new \Exception('Обнаружен критически опасный код');
            }
            
            ob_start();
            
            // Выполняем с доступом ко всем функциям Evolution CMS
            $result = $this->executeWithEvoAccess($normalizedCode);
            $output = ob_get_clean();
            
            $executionTime = round(microtime(true) - $startTime, 4);
            $memoryUsage = memory_get_usage(true) - $startMemory;
            
            return [
                'output' => $output ?: 'Код выполнен успешно',
                'result' => $this->formatResult($result),
                'execution_time' => $executionTime,
                'memory_usage' => $memoryUsage
            ];
            
        } catch (\ParseError $e) {
            throw new \Exception("Ошибка синтаксиса: " . $e->getMessage());
        } catch (\Throwable $e) {
            throw new \Exception("Ошибка выполнения: " . $e->getMessage());
        }
    }

    /**
     * Проверяем только КРИТИЧЕСКИ опасные операции
     */
    private function containsCriticalDanger(string $code): bool
    {
        $criticalPatterns = [
            // Критически опасные системные функции
            '/\b(eval|exec|system|shell_exec|passthru|proc_open|popen|pcntl_exec)\s*\(/i',
            
            // Потенциально опасные файловые операции с путями
            '/\b(unlink|rmdir|chmod|chown)\s*\([^)]*\.\.\//i', // с ../ путями
            
            // Сетевые операции с внешними адресами
            '/\b(fsockopen|pfsockopen|stream_socket_client)\s*\([^)]*(?:http|ftp)/i',
            
            // Изменение критических настроек PHP
            '/\b(ini_set|dl)\s*\(\s*[\'"](?:safe_mode|disable_functions|open_basedir)/i',
            
            // Создание файлов в системных путях
            '/\b(file_put_contents|fopen)\s*\([^)]*(?:\/etc|\/root|\/windows|C:\\\\windows)/i',
        ];
        
        foreach ($criticalPatterns as $pattern) {
            if (preg_match($pattern, $code)) {
                return true;
            }
        }
        
        return false;
    }

    /**
     * Выполнение кода с полным доступом к Evolution CMS
     */
    private function executeWithEvoAccess(string $code)
    {
        // Получаем объекты Evolution CMS
        $evo = evolutionCMS();
        $modx = $evo;

        // Информация о текущем пользователе
        $currentUser = [
            'id' => $_SESSION['mgrInternalKey'] ?? null,
            'username' => $_SESSION['mgrShortname'] ?? null,
            'role' => $_SESSION['mgrRole'] ?? null,
            'email' => $_SESSION['mgrEmail'] ?? null,
            'fullname' => $_SESSION['mgrFullName'] ?? null,
        ];

        // Создаем контекст с доступом к Evolution CMS
        $context = [
            'evo' => $evo,
            'modx' => $modx,
            'user' => $currentUser,
            'config' => $evo->config,
            'db' => $evo->getDatabase(),
        ];
        
        // Ограничения для безопасности (но не слишком строгие)
        set_time_limit(30); // 30 секунд вместо 5
        ini_set('memory_limit', '256M'); // 256MB вместо 128MB
        
        // Извлекаем переменные в текущую область видимости
        extract($context, EXTR_SKIP);
        
        // Выполняем код
        if (!empty($code)) {
            return eval($code);
        }
        
        return null;
    }
    
    private function normalizePhpCode(string $code): string
    {
        // Убираем все открывающие и закрывающие PHP теги
        $code = preg_replace('/^\s*<\?(?:php)?\s*/', '', $code);
        $code = preg_replace('/\?>\s*$/', '', $code);
        $code = preg_replace('/\?>\s*<\?(?:php)?\s*/', '', $code);
        
        return trim($code);
    }
    
    private function validatePhpSyntax(string $code): void
    {
        if (empty($code)) return;
        
        $tempFile = tempnam(sys_get_temp_dir(), 'php_check_');
        file_put_contents($tempFile, "<?php\n" . $code);
        
        $output = shell_exec("php -l " . escapeshellarg($tempFile) . " 2>&1");
        unlink($tempFile);
        
        if (strpos($output, 'No syntax errors') === false) {
            preg_match('/PHP\s+(?:Parse|Fatal) error:\s*(.+?)(?:\sin|$)/', $output, $matches);
            $errorMessage = $matches[1] ?? 'Неизвестная синтаксическая ошибка';
            throw new \ParseError(trim($errorMessage));
        }
    }
    
    private function formatResult($result): string
    {
        if ($result === null) return 'null';
        if ($result === true) return 'true'; 
        if ($result === false) return 'false';
        
        if (is_scalar($result)) {
            return (string)$result;
        }
        
        if (is_object($result)) {
            $class = get_class($result);
            $methods = get_class_methods($result);
            $properties = get_object_vars($result);
            
            return "[object {$class}] methods: " . count($methods) . ", properties: " . count($properties);
        }
        
        if (is_array($result)) {
            $count = count($result);
            if ($count === 0) return '[array] empty';
            if ($count > 20) return "[array] {$count} elements";
            
            return "[array] " . json_encode($result, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
        }
        
        if (is_resource($result)) {
            return "[resource] " . get_resource_type($result);
        }
        
        return print_r($result, true);
    }
}