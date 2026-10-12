<?php

namespace App\Filament\Resources\Sections\Schemas;

use Filament\Forms\Components\Select;
use Filament\Forms\Components\TextInput;
use Filament\Forms\Components\Toggle;
use Filament\Schemas\Schema;

class SectionForm
{
    public static function configure(Schema $schema): Schema
    {
        return $schema
            ->components([
                TextInput::make('name')
                    ->required(),
                TextInput::make('slug')
                    ->required()
                    ->helperText('Lowercase, no spaces. Example: shirts'),
                Select::make('display_style')
                    ->label('How this section is shown in 3D')
                    ->options([
                        'rack' => 'Rack (hanging clothes)',
                        'turntable' => 'Turntable (shoes)',
                        'shelf' => 'Shelf (bags and accessories)',
                    ])
                    ->default('rack')
                    ->required(),
                TextInput::make('target_height')
                    ->label('Product size in 3D')
                    ->numeric()
                    ->step(0.05)
                    ->minValue(0.1)
                    ->maxValue(3)
                    ->default(1.10)
                    ->required()
                    ->helperText('How tall products appear. Shirts about 1.1, shoes about 0.5, small bags about 0.6.'),
                TextInput::make('sort_order')
                    ->numeric()
                    ->default(0)
                    ->required()
                    ->helperText('Lower numbers appear first.'),
                Toggle::make('is_active')
                    ->default(true),
            ]);
    }
}