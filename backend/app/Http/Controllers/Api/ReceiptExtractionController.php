<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\ReceiptTextParser;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class ReceiptExtractionController extends Controller
{
    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'receipt' => ['required', 'file', 'mimes:jpg,jpeg,png,webp,pdf', 'max:10240'],
        ]);

        $apiKey = config('services.receipt_ocr.api_key');
        if (! is_string($apiKey) || trim($apiKey) === '') {
            return response()->json([
                'message' => 'OCR belum dikonfigurasi. Atur RECEIPT_OCR_API_KEY di environment backend atau gunakan input manual.',
            ], 503);
        }

        $receipt = $validated['receipt'];

        try {
            $response = Http::withHeaders(['apikey' => $apiKey])
                ->connectTimeout(10)
                ->timeout(60)
                ->attach('file', $receipt->getContent(), $receipt->getClientOriginalName())
                ->post('https://api.ocr.space/parse/image', [
                    'language' => config('services.receipt_ocr.language', 'auto'),
                    'OCREngine' => config('services.receipt_ocr.engine', 2),
                    'isOverlayRequired' => 'false',
                    'scale' => 'true',
                ]);
        } catch (ConnectionException $exception) {
            Log::warning('OCR.Space is unavailable.', [
                'user_id' => $request->user()->id,
                'exception' => $exception->getMessage(),
            ]);

            return response()->json([
                'message' => 'Layanan OCR.Space tidak dapat dihubungi. Coba lagi nanti atau gunakan input manual.',
            ], 502);
        }

        if (! $response->successful()) {
            Log::warning('OCR.Space returned an unsuccessful HTTP response.', [
                'user_id' => $request->user()->id,
                'status' => $response->status(),
            ]);

            return response()->json([
                'message' => $response->status() === 429
                    ? 'Batas permintaan OCR.Space tercapai. Coba lagi nanti atau gunakan input manual.'
                    : 'Struk belum dapat diproses oleh OCR.Space. Coba unggah gambar yang lebih jelas atau gunakan input manual.',
            ], $response->status() === 429 ? 429 : 502);
        }

        $payload = $response->json();
        if (! is_array($payload)) {
            Log::warning('OCR.Space returned a non-JSON response.', [
                'user_id' => $request->user()->id,
            ]);

            return response()->json([
                'message' => 'Respons OCR.Space tidak dapat dibaca. Coba lagi atau gunakan input manual.',
            ], 502);
        }

        if (($payload['IsErroredOnProcessing'] ?? false) === true) {
            $providerMessage = collect((array) ($payload['ErrorMessage'] ?? []))
                ->filter(fn ($message): bool => is_string($message))
                ->implode(' ');
            $isRateLimited = str_contains(strtolower($providerMessage), 'maximum')
                || str_contains(strtolower($providerMessage), 'limit');

            Log::warning('OCR.Space could not process the receipt.', [
                'user_id' => $request->user()->id,
                'rate_limited' => $isRateLimited,
            ]);

            return response()->json([
                'message' => $isRateLimited
                    ? 'Batas permintaan OCR.Space tercapai. Coba lagi nanti atau gunakan input manual.'
                    : 'OCR.Space tidak dapat membaca struk ini. Gunakan gambar yang lebih jelas atau input manual.',
            ], $isRateLimited ? 429 : 422);
        }

        $parsedResults = $payload['ParsedResults'] ?? null;
        $receiptText = is_array($parsedResults)
            ? collect($parsedResults)
                ->pluck('ParsedText')
                ->filter(fn ($text): bool => is_string($text))
                ->implode("\n")
            : '';
        $receiptText = trim($receiptText);

        if ($receiptText === '') {
            Log::info('OCR.Space returned no text for the receipt.', [
                'user_id' => $request->user()->id,
            ]);

            return response()->json([
                'message' => 'Teks struk tidak terbaca. Coba foto yang lebih terang, fokus, dan tidak terpotong.',
            ], 422);
        }

        return response()->json([
            'message' => 'Struk berhasil dibaca. Periksa dan koreksi hasilnya sebelum disimpan.',
            'data' => app(ReceiptTextParser::class)->parse($receiptText),
        ]);
    }
}
