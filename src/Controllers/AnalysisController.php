<?php
namespace roilafx\Consolevo\Controllers;

use roilafx\Consolevo\Analyzers\EvoAnalyzer;

class AnalysisController
{
    public function getEvoCompletionData()
    {
        try {
            $analyzer = new EvoAnalyzer();
            $data = $analyzer->generateCompletionData();
            
            // Убеждаемся, что все поля являются массивами
            $data = $this->ensureArrayStructure($data);
            
            return response()->json([
                'success' => true,
                'data' => $data,
                'source' => 'dynamic',
                'stats' => [
                    'methods' => count($data['methods']),
                    'properties' => count($data['properties']),
                    'constants' => count($data['constants']),
                    'functions' => count($data['functions'])
                ]
            ]);
            
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'error' => $e->getMessage()
            ], 500);
        }
    }

    public function getStaticCompletionData()
    {
        $staticData = $this->getStaticAnalysisData();
        
        return response()->json([
            'success' => true,
            'data' => $staticData,
            'source' => 'static',
            'stats' => [
                'methods' => count($staticData['methods']),
                'properties' => count($staticData['properties']),
                'constants' => count($staticData['constants']),
                'functions' => count($staticData['functions'])
            ]
        ]);
    }

    /**
     * Гарантирует, что все поля данных являются массивами
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

    private function getStaticAnalysisData(): array
    {
        return [
            'methods' => [
                [
                    'name' => 'DocumentParser::getConfig',
                    'params' => [['name' => '$key', 'default' => '', 'full' => '$key']],
                    'full_signature' => 'getConfig($key)'
                ],
                [
                    'name' => 'DocumentParser::getDocumentObject',
                    'params' => [['name' => '$id', 'default' => '', 'full' => '$id']],
                    'full_signature' => 'getDocumentObject($id)'
                ],
                [
                    'name' => 'DocumentParser::runSnippet',
                    'params' => [
                        ['name' => '$snippetName', 'default' => '', 'full' => '$snippetName'],
                        ['name' => '$params', 'default' => '[]', 'full' => '$params = []']
                    ],
                    'full_signature' => 'runSnippet($snippetName, $params = [])'
                ],
                [
                    'name' => 'Database::query',
                    'params' => [
                        ['name' => '$sql', 'default' => '', 'full' => '$sql'],
                        ['name' => '$bindings', 'default' => '[]', 'full' => '$bindings = []']
                    ],
                    'full_signature' => 'query($sql, $bindings = [])'
                ]
            ],
            'properties' => [
                'DocumentParser->config',
                'DocumentParser->documentObject', 
                'DocumentParser->documentIdentifier',
                'DocumentParser->documentContent'
            ],
            'constants' => [
                'MODX_BASE_PATH',
                'MODX_BASE_URL', 
                'MODX_SITE_URL',
                'MODX_MANAGER_PATH'
            ],
            'functions' => [
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
                ]
            ],
            'generated_at' => date('Y-m-d H:i:s'),
            'version' => '1.0'
        ];
    }
}