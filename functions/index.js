// ABOUTME: Cloud Functions for DEK NOI — receipt-total recognition via Gemini Flash (Vertex AI).
// ABOUTME: recognizeReceiptTotal returns a best-effort total; it never throws to block the client.
import { onCall, HttpsError } from 'firebase-functions/v2/https'
import { GoogleGenAI } from '@google/genai'
import { parseAmount } from './parseAmount.js'

const MODEL = 'gemini-2.5-flash'

const PROMPT =
  'This image is a receipt or a bank payment slip, in Thai or English. ' +
  'Reply with ONLY the final total amount actually paid, in Thai Baht, as a plain ' +
  'number with no currency symbol, commas, or words (for example: 520.00). ' +
  'Use the grand total / amount paid — never a subtotal, fee, tax, change, ' +
  'account number, or reference number. If there is no clear total, reply exactly: none'

// Callable: takes a base64 JPEG, returns { amount: number | null }.
// Runs Gemini through Vertex AI, billed to the project's Blaze account (no API key /
// prepaid credits). The amount is only a pre-fill hint — the customer can correct it
// and an admin approves the final number, so an imperfect or null guess is acceptable.
export const recognizeReceiptTotal = onCall(
  { region: 'asia-southeast1', memory: '512MiB', timeoutSeconds: 30 },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Please sign in to scan receipts.')
    }

    const imageBase64 = request.data?.imageBase64
    if (!imageBase64) return { amount: null }

    try {
      const ai = new GoogleGenAI({
        vertexai: true,
        project: process.env.GCLOUD_PROJECT,
        location: 'us-central1',
      })
      const response = await ai.models.generateContent({
        model: MODEL,
        contents: [
          {
            role: 'user',
            parts: [
              { inlineData: { mimeType: 'image/jpeg', data: imageBase64 } },
              { text: PROMPT },
            ],
          },
        ],
      })
      return { amount: parseAmount(response.text) }
    } catch (err) {
      // Never block the upload flow on a recognition failure — the customer types it in.
      console.error('Receipt recognition failed:', err)
      return { amount: null }
    }
  },
)

export { redeemReward } from './redeemReward.js'
