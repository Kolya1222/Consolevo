<?php 
namespace roilafx\Consolevo;

use EvolutionCMS\ServiceProvider;

class ConsolevoServiceProvider extends ServiceProvider
{
    protected $namespace = 'consolevo';
    
    public function register()
    {
        $this->loadPluginsFrom(
            dirname(__DIR__) . '/plugins/'
        );
    }

    public function boot()
    {
        $this->loadRoutesFrom(__DIR__ . '/../routes.php');
        $this->loadViewsFrom(__DIR__ . '/../views', 'consolevo');
        $this->publishes([
            __DIR__ . '/../publishable/assets' => MODX_BASE_PATH . 'assets',
        ]);
    }
}