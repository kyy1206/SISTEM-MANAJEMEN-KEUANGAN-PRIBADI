<?php

namespace App\Services;

use Carbon\CarbonImmutable;

class ReceiptTextParser
{
    public function parse(string $text): array
    {
        $lines = collect(preg_split('/\R/u', $text) ?: [])
            ->map(fn (string $line): string => trim($line))
            ->filter()
            ->values();

        return [
            'merchant' => $this->merchant($lines->all()),
            'amount' => $this->amount($lines->all()),
            'date' => $this->date($text),
            'payment_method' => $this->paymentMethod($text),
            'description' => mb_substr($text, 0, 2000),
        ];
    }

    private function merchant(array $lines): ?string
    {
        foreach (array_slice($lines, 0, 8) as $line) {
            if (preg_match('/\d{3,}/', $line) || preg_match('/^(?:struk|receipt|invoice|tanggal|date|kasir|cashier|no\.?)/iu', $line)) {
                continue;
            }

            if (mb_strlen($line) >= 2) {
                return mb_substr($line, 0, 255);
            }
        }

        return null;
    }

    private function amount(array $lines): ?int
    {
        foreach ($lines as $index => $line) {
            if (! preg_match('/\b(grand\s*total|total|jumlah|tagihan|bayar|dibayar|amount\s*due|net\s*total)\b/iu', $line)) {
                continue;
            }

            $amount = $this->lastAmountInLine($line);
            if ($amount !== null) {
                return $amount;
            }

            $nextLine = $lines[$index + 1] ?? '';
            $amount = $this->lastAmountInLine($nextLine);
            if ($amount !== null) {
                return $amount;
            }

            $amount = $this->lastStandaloneAmountAfter($lines, $index + 1);
            if ($amount !== null) {
                return $amount;
            }
        }

        $candidates = [];
        foreach ($lines as $line) {
            if (preg_match('/\b(?:rp|idr)\b/iu', $line)) {
                $amount = $this->lastAmountInLine($line);
                if ($amount !== null) {
                    $candidates[] = $amount;
                }
            }
        }

        return $candidates === [] ? null : max($candidates);
    }

    private function lastStandaloneAmountAfter(array $lines, int $startIndex): ?int
    {
        $amounts = [];

        foreach (array_slice($lines, $startIndex) as $line) {
            if (! preg_match('/^(?:rp\.?\s*)?\d[\d.,]*$/iu', $line)) {
                continue;
            }

            $amount = $this->lastAmountInLine($line);
            if ($amount !== null) {
                $amounts[] = $amount;
            }
        }

        return $amounts === [] ? null : end($amounts);
    }

    private function lastAmountInLine(string $line): ?int
    {
        preg_match_all('/(?:\b(?:rp|idr)\.?\s*)?\d[\d.,]*/iu', $line, $matches);
        if ($matches[0] === []) {
            return null;
        }

        $amount = preg_replace('/\D/', '', end($matches[0]));
        if (! is_string($amount) || $amount === '' || (int) $amount <= 0) {
            return null;
        }

        return (int) $amount;
    }

    private function date(string $text): ?string
    {
        $patterns = [
            '/\b(20\d{2})[.\/-](\d{1,2})[.\/-](\d{1,2})\b/' => 'ymd',
            '/\b(\d{1,2})[.\/-](\d{1,2})[.\/-](20\d{2})\b/' => 'dmy',
        ];

        foreach ($patterns as $pattern => $format) {
            if (! preg_match($pattern, $text, $matches)) {
                continue;
            }

            $year = (int) ($format === 'ymd' ? $matches[1] : $matches[3]);
            $month = (int) ($format === 'ymd' ? $matches[2] : $matches[2]);
            $day = (int) ($format === 'ymd' ? $matches[3] : $matches[1]);

            if (checkdate($month, $day, $year)) {
                return CarbonImmutable::create($year, $month, $day)->toDateString();
            }
        }

        $months = [
            'jan' => 1, 'januari' => 1, 'feb' => 2, 'februari' => 2,
            'mar' => 3, 'maret' => 3, 'apr' => 4, 'april' => 4,
            'mei' => 5, 'may' => 5, 'jun' => 6, 'juni' => 6,
            'jul' => 7, 'juli' => 7, 'agu' => 8, 'agustus' => 8,
            'aug' => 8, 'sep' => 9, 'september' => 9,
            'okt' => 10, 'oktober' => 10, 'oct' => 10, 'october' => 10,
            'nov' => 11, 'november' => 11, 'des' => 12, 'desember' => 12,
            'dec' => 12, 'december' => 12,
        ];

        if (preg_match('/\b(\d{1,2})\s+([[:alpha:]]+)\s+(20\d{2})\b/iu', $text, $matches)) {
            $month = $months[mb_strtolower(mb_substr($matches[2], 0, 3))]
                ?? $months[mb_strtolower($matches[2])]
                ?? null;
            $day = (int) $matches[1];
            $year = (int) $matches[3];

            if (is_int($month) && checkdate($month, $day, $year)) {
                return CarbonImmutable::create($year, $month, $day)->toDateString();
            }
        }

        return null;
    }

    private function paymentMethod(string $text): ?string
    {
        $methods = [
            'QRIS' => '/\bqris\b/iu',
            'E-wallet' => '/\b(gopay|go-pay|ovo|dana|shopeepay|linkaja|e-wallet)\b/iu',
            'Kartu kredit' => '/\b(kartu kredit|credit card|visa|mastercard)\b/iu',
            'Debit' => '/\b(debit|kartu debit)\b/iu',
            'Transfer' => '/\b(transfer|virtual account|va)\b/iu',
            'Cash' => '/\b(cash|tunai)\b/iu',
        ];

        foreach ($methods as $method => $pattern) {
            if (preg_match($pattern, $text)) {
                return $method;
            }
        }

        return null;
    }
}
