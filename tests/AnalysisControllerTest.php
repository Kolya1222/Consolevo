<?php
use PHPUnit\Framework\TestCase;
use roilafx\Consolevo\Controllers\AnalysisController;

class AnalysisControllerTest extends TestCase
{
    public function testMethodExists()
    {
        $controller = new AnalysisController();
        $this->assertTrue(method_exists($controller, 'getUnifiedData'));
    }
}