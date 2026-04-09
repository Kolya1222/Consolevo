<?php
namespace roilafx\Consolevo\Controllers;

use roilafx\Consolevo\Analyzers\EvoAnalyzer;

class AnalysisController
{
    /**
     * Единый endpoint для всех данных автодополнения
     * 
     * @return \Illuminate\Http\JsonResponse JSON ответ с данными автодополнения
     * 
     * @throws \Exception При ошибке анализа кода
     * 
     * @example
     * GET /api/unified-data
     * Response: {
     *   "success": true,
     *   "data": {...},
     *   "source": "dynamic",
     *   "timestamp": 1234567890
     * }
     */
    public function getUnifiedData()
    {
        try {
            $analyzer = new EvoAnalyzer();
            $data = $analyzer->generateCompletionData();
            
            $data = $this->ensureArrayStructure($data);
            
            return response()->json([
                'success' => true,
                'data' => $data,
                'source' => 'dynamic',
                'timestamp' => time(),
                'stats' => $this->calculateStats($data)
            ]);
            
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'error' => $e->getMessage(),
                'timestamp' => time()
            ], 500);
        }
    }
    
    /**
     * Гарантирует, что все поля данных являются массивами
     * 
     * @param array $data Входные данные для нормализации
     * @return array Нормализованные данные с гарантированными массивами
     * 
     * @internal Этот метод используется только внутри контроллера
     */
    private function ensureArrayStructure(array $data): array
    {
        return [
            'methods' => is_array($data['methods'] ?? null) ? $data['methods'] : [],
            'properties' => is_array($data['properties'] ?? null) ? $data['properties'] : [],
            'constants' => is_array($data['constants'] ?? null) ? $data['constants'] : [],
            'functions' => is_array($data['functions'] ?? null) ? $data['functions'] : [],
            'generated_at' => $data['generated_at'] ?? date('Y-m-d H:i:s'),
            'version' => $data['version'] ?? '1.0'
        ];
    }
    
    /**
     * Рассчитывает статистику по данным
     * 
     * @param array $data Данные с полями methods, properties, constants, functions
     * @return array Статистика с количеством элементов каждого типа
     * 
     * @since 1.0.0
     */
    private function calculateStats(array $data): array
    {
        return [
            'methods' => count($data['methods'] ?? []),
            'properties' => count($data['properties'] ?? []),
            'constants' => count($data['constants'] ?? []),
            'functions' => count($data['functions'] ?? [])
        ];
    }
}