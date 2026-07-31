import { test } from 'node:test'
import assert from 'node:assert/strict'
import { groupWords, splitCue, mergeCues, retime, editWord, type Word } from './cues.ts'

/** Words at a steady 0.3s each starting at `from`. */
const say = (text: string, from = 0, each = 0.3): Word[] =>
  text.split(' ').map((t, i) => ({ text: t, start: from + i * each, end: from + i * each + each * 0.9 }))

test('groups into at most maxWords', () => {
  const cues = groupWords(say('one two three four five six seven'))
  assert.ok(cues.every((c) => c.words.length <= 3))
  assert.equal(cues.flatMap((c) => c.words).length, 7)
})

test('hard punctuation ends a cue', () => {
  const cues = groupWords(say('yes. no'))
  assert.equal(cues.length, 2)
  assert.deepEqual(cues[0].words.map((w) => w.text), ['yes.'])
})

test('soft punctuation only breaks once the cue has two words', () => {
  const one = groupWords(say('well, I really mean it'))
  // "well," is the first word of the cue, so it must NOT break on its own.
  assert.deepEqual(one[0].words.map((w) => w.text), ['well,', 'I', 'really'])

  const two = groupWords(say('I know, you do'))
  assert.deepEqual(two[0].words.map((w) => w.text), ['I', 'know,'])
})

test('a long gap breaks the cue', () => {
  const words: Word[] = [
    { text: 'a', start: 0, end: 0.2 },
    { text: 'b', start: 2, end: 2.2 },
  ]
  assert.equal(groupWords(words).length, 2)
})

test('maxChars breaks before the word limit', () => {
  const cues = groupWords(say('extraordinary complications everywhere'))
  assert.ok(cues.length > 1)
})

/**
 * The regression that put maxChars at 14: three short words can still be too
 * wide to fit the frame in a display face, and WrapStyle 2 will not save us.
 */
test('a line that would overflow the frame gets split', () => {
  const cues = groupWords(say('hello and welcome'))
  assert.ok(cues.length > 1, 'HELLO AND WELCOME is 1144px wide on a 1080px frame')
  assert.ok(cues.every((c) => c.words.map((w) => w.text).join(' ').length <= 14))
})

test('holds a cue into short silence but never past the next cue', () => {
  const words: Word[] = [
    { text: 'a.', start: 0, end: 0.2 },
    { text: 'b', start: 0.25, end: 0.4 },
  ]
  const cues = groupWords(words)
  assert.equal(cues.length, 2)
  assert.ok(cues[0].end <= cues[1].start + 1e-9, 'held cue overlaps the next one')
})

test('a real pause is not held through', () => {
  const words: Word[] = [
    { text: 'a.', start: 0, end: 0.2 },
    { text: 'b', start: 5, end: 5.2 },
  ]
  const cues = groupWords(words)
  // A 4.8s silence is a pause, so the first cue clears at its own end.
  assert.equal(cues[0].end, 0.2)
})

test('empty input gives no cues', () => {
  assert.deepEqual(groupWords([]), [])
  assert.deepEqual(groupWords([{ text: '  ', start: 0, end: 1 }]), [])
})

test('split then merge round-trips the words', () => {
  const cues = groupWords(say('one two three'))
  const id = cues[0].id
  const split = splitCue(cues, id, 0)
  assert.equal(split.length, cues.length + 1)
  assert.equal(split[0].words.length, 1)
  const merged = mergeCues(split, split[0].id)
  assert.deepEqual(
    merged.flatMap((c) => c.words.map((w) => w.text)),
    cues.flatMap((c) => c.words.map((w) => w.text)),
  )
})

test('split is a no-op at the edges', () => {
  const cues = groupWords(say('one two'))
  assert.equal(splitCue(cues, cues[0].id, -1), cues)
  assert.equal(splitCue(cues, cues[0].id, 1), cues)
  assert.equal(splitCue(cues, 'nope', 0), cues)
})

test('merge is a no-op on the last cue', () => {
  const cues = groupWords(say('one. two.'))
  const last = cues[cues.length - 1]
  assert.equal(mergeCues(cues, last.id), cues)
})

test('retime scales word timings into the new window', () => {
  const cues = groupWords(say('one two three'))
  const c = cues[0]
  const out = retime(cues, c.id, 10, 12)[0]
  assert.equal(out.start, 10)
  assert.equal(out.end, 12)
  assert.equal(out.words[0].start, 10)
  assert.ok(out.words[out.words.length - 1].end <= 12 + 1e-9)
  assert.ok(out.words.every((w, i) => i === 0 || w.start >= out.words[i - 1].start))
})

test('retime rejects an inverted window', () => {
  const cues = groupWords(say('one two'))
  assert.equal(retime(cues, cues[0].id, 5, 5), cues)
})

test('editWord changes text and leaves timings alone', () => {
  const cues = groupWords(say('their there'))
  const before = cues[0].words.map((w) => [w.start, w.end])
  const out = editWord(cues, cues[0].id, 0, "they're")
  assert.equal(out[0].words[0].text, "they're")
  assert.deepEqual(out[0].words.map((w) => [w.start, w.end]), before)
})
