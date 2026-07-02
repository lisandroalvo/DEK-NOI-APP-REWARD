// ABOUTME: Tests for the image-upload helpers and storage rules against the Firebase emulator.
// ABOUTME: Covers file validation, blob upload + download URL, and rule rejection of non-image writes.
import { readFileSync } from 'node:fs'
import { beforeAll, afterAll, describe, test, expect } from 'vitest'
import { initializeTestEnvironment, assertFails } from '@firebase/rules-unit-testing'
import { ref, uploadString, listAll } from 'firebase/storage'
import { validateImageFile, uploadImageBlob } from '../src/lib/storage.js'

const PROJECT_ID = 'demo-dek-noi-storage'
const ALICE = 'alice'

let testEnv

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    storage: { rules: readFileSync('storage.rules', 'utf8') },
  })
})

afterAll(async () => {
  await testEnv.cleanup()
})

describe('validateImageFile', () => {
  test('rejects a non-image file', () => {
    expect(() => validateImageFile({ type: 'application/pdf', size: 1000 })).toThrow(/INVALID_TYPE/)
  })

  test('rejects a file larger than the 10MB limit', () => {
    expect(() => validateImageFile({ type: 'image/jpeg', size: 11 * 1024 * 1024 })).toThrow(/FILE_TOO_LARGE/)
  })

  test('accepts a valid small image', () => {
    expect(() => validateImageFile({ type: 'image/jpeg', size: 200 * 1024 })).not.toThrow()
  })
})

describe('uploadImageBlob', () => {
  test('uploads under the given prefix and returns an https download URL', async () => {
    const storage = testEnv.authenticatedContext(ALICE).storage()
    const blob = new Blob([new Uint8Array([1, 2, 3, 4, 5])], { type: 'image/jpeg' })

    const url = await uploadImageBlob(storage, blob, 'bills/alice')

    expect(typeof url).toBe('string')
    expect(url).toMatch(/^https?:\/\//)

    const listed = await listAll(ref(storage, 'bills/alice'))
    expect(listed.items.length).toBe(1)
  })
})

describe('storage rules', () => {
  test('an authenticated user cannot upload a non-image file', async () => {
    const storage = testEnv.authenticatedContext(ALICE).storage()
    await assertFails(
      uploadString(ref(storage, 'bills/alice/notes.txt'), 'plain text', 'raw', { contentType: 'text/plain' })
    )
  })
})
