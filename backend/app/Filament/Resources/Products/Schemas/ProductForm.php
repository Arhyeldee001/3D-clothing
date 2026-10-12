<?php

namespace App\Filament\Resources\Products\Schemas;

use Filament\Forms\Components\ColorPicker;
use Filament\Forms\Components\FileUpload;
use Filament\Forms\Components\Repeater;
use Filament\Forms\Components\Select;
use Filament\Forms\Components\TextInput;
use Filament\Forms\Components\Textarea;
use Filament\Forms\Components\Toggle;
use Filament\Schemas\Schema;

class ProductForm
{
    public static function configure(Schema $schema): Schema
    {
        return $schema
            ->components([
                Select::make('section_id')
                    ->relationship('section', 'name')
                    ->required(),
                TextInput::make('name')
                    ->required(),
                TextInput::make('slug')
                    ->required()
                    ->helperText('Lowercase, no spaces. Example: hooped-polo'),
                Textarea::make('description')
                    ->columnSpanFull(),
                TextInput::make('price')
                    ->required()
                    ->numeric()
                    ->default(0)
                    ->prefix('$'),
                Toggle::make('is_active')
                    ->default(true),

                Repeater::make('modelAssets')
                    ->label('3D models')
                    ->relationship()
                    ->schema([
                        FileUpload::make('file_path')
                            ->label('3D model (.glb file)')
                            ->disk('public')
                            ->directory('models')
                            ->maxSize(8192)
                            ->required()
                            ->helperText('Upload a .glb file, up to 8 MB. It is checked automatically when you save.'),
                        FileUpload::make('poster_path')
                            ->label('Poster image (optional)')
                            ->image()
                            ->disk('public')
                            ->directory('posters')
                            ->helperText('A picture of the product, shown while the 3D model loads.'),
                        TextInput::make('status')
                            ->label('Check result')
                            ->disabled()
                            ->dehydrated(false),
                        TextInput::make('triangle_count')
                            ->label('Triangles')
                            ->disabled()
                            ->dehydrated(false),
                        TextInput::make('file_size_bytes')
                            ->label('File size (bytes)')
                            ->disabled()
                            ->dehydrated(false),
                        Textarea::make('notes')
                            ->label('Notes from the check')
                            ->disabled()
                            ->dehydrated(false)
                            ->columnSpanFull(),
                    ])
                    ->columns(2)
                    ->defaultItems(0)
                    ->addActionLabel('Add 3D model')
                    ->columnSpanFull(),

                Repeater::make('variants')
                    ->label('Sizes and colours')
                    ->relationship()
                    ->schema([
                        TextInput::make('sku')
                            ->label('SKU')
                            ->required()
                            ->unique()
                            ->distinct()
                            ->validationMessages([
                                'unique' => 'This SKU is already used by another size or product.',
                                'distinct' => 'This SKU appears twice on this product.',
                            ])
                            ->helperText('Must be unique. Example: POLO-NAVY-M'),
                        TextInput::make('size')
                            ->placeholder('M'),
                        TextInput::make('color_name')
                            ->label('Colour name')
                            ->placeholder('Navy'),
                        ColorPicker::make('color_hex')
                            ->label('Colour'),
                        TextInput::make('stock')
                            ->numeric()
                            ->minValue(0)
                            ->default(0)
                            ->required(),
                        TextInput::make('price_override')
                            ->label('Price override')
                            ->numeric()
                            ->prefix('$')
                            ->helperText('Leave empty to use the product price.'),
                    ])
                    ->columns(3)
                    ->defaultItems(0)
                    ->addActionLabel('Add size / colour')
                    ->columnSpanFull(),
            ]);
    }
}