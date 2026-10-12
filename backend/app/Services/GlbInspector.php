<?php

namespace App\Services;

/**
 * Reads the header of a .glb file and reports its size, triangle count and
 * dimensions, then decides whether it is light enough for the website.
 */
class GlbInspector
{
    public const MAX_BYTES = 8388608;   // 8 MB
    public const MAX_TRIANGLES = 120000;
    public const WARN_TRIANGLES = 60000;

    public static function inspect(string $path): array
    {
        $result = [
            'status' => 'rejected',
            'triangles' => null,
            'bytes' => null,
            'notes' => [],
        ];

        if (! is_file($path)) {
            $result['notes'][] = 'The file could not be found after upload.';
            return $result;
        }

        $result['bytes'] = filesize($path);

        $handle = fopen($path, 'rb');
        $header = fread($handle, 12);

        if ($header === false || strlen($header) < 12 || substr($header, 0, 4) !== 'glTF') {
            fclose($handle);
            $result['notes'][] = 'This is not a valid .glb file.';
            return $result;
        }

        $version = unpack('V', substr($header, 4, 4))[1];
        if ($version !== 2) {
            fclose($handle);
            $result['notes'][] = 'Only glTF version 2 files are supported.';
            return $result;
        }

        $chunkHeader = fread($handle, 8);
        if ($chunkHeader === false || strlen($chunkHeader) < 8) {
            fclose($handle);
            $result['notes'][] = 'The file is damaged (no data section).';
            return $result;
        }

        $chunk = unpack('Vlength/a4type', $chunkHeader);
        if ($chunk['type'] !== 'JSON' || $chunk['length'] > 20 * 1024 * 1024) {
            fclose($handle);
            $result['notes'][] = 'The file is damaged or unusually structured.';
            return $result;
        }

        $json = json_decode(fread($handle, $chunk['length']), true);
        fclose($handle);

        if (! is_array($json)) {
            $result['notes'][] = 'The file description could not be read.';
            return $result;
        }

        $accessors = $json['accessors'] ?? [];
        $triangles = 0;
        $min = [INF, INF, INF];
        $max = [-INF, -INF, -INF];

        foreach ($json['meshes'] ?? [] as $mesh) {
            foreach ($mesh['primitives'] ?? [] as $primitive) {
                if (($primitive['mode'] ?? 4) !== 4) {
                    continue;
                }

                $positionIndex = $primitive['attributes']['POSITION'] ?? null;

                if (isset($primitive['indices'])) {
                    $count = $accessors[$primitive['indices']]['count'] ?? 0;
                } else {
                    $count = $positionIndex !== null ? ($accessors[$positionIndex]['count'] ?? 0) : 0;
                }
                $triangles += intdiv((int) $count, 3);

                $position = $positionIndex !== null ? ($accessors[$positionIndex] ?? null) : null;
                if ($position && isset($position['min'], $position['max'])) {
                    for ($i = 0; $i < 3; $i++) {
                        $min[$i] = min($min[$i], $position['min'][$i]);
                        $max[$i] = max($max[$i], $position['max'][$i]);
                    }
                }
            }
        }

        $result['triangles'] = $triangles;

        $problems = [];

        if ($triangles === 0) {
            $problems[] = 'No 3D surface was found in this file.';
        }
        if ($result['bytes'] > self::MAX_BYTES) {
            $problems[] = sprintf(
                'File is %.1f MB. The limit is %d MB. Compress or simplify it.',
                $result['bytes'] / 1048576,
                self::MAX_BYTES / 1048576
            );
        }
        if ($triangles > self::MAX_TRIANGLES) {
            $problems[] = sprintf(
                '%s triangles. The limit is %s. Simplify the model.',
                number_format($triangles),
                number_format(self::MAX_TRIANGLES)
            );
        }

        $notes = [];

        if ($triangles > self::WARN_TRIANGLES && $triangles <= self::MAX_TRIANGLES) {
            $notes[] = sprintf('Heavy model (%s triangles). Pages with many of these will load slowly.', number_format($triangles));
        }

        if ($max[0] > -INF) {
            $dims = [$max[0] - $min[0], $max[1] - $min[1], $max[2] - $min[2]];
            $largest = max($dims);
            $notes[] = sprintf('Size in file units: %.2f x %.2f x %.2f.', $dims[0], $dims[1], $dims[2]);
            if ($largest > 10) {
                $notes[] = 'Looks like centimetres (the website will scale it down).';
            } elseif ($largest >= 0.3 && $largest <= 5) {
                $notes[] = 'Looks like metres.';
            } else {
                $notes[] = 'Unusual size. Check the scale before publishing.';
            }
        }

        if ($problems) {
            $result['status'] = 'rejected';
            $result['notes'] = array_merge($problems, $notes);
        } else {
            $result['status'] = 'approved';
            $result['notes'] = $notes;
        }

        return $result;
    }
}
