export function clippySvg(): string {
  return `
    <svg class="clippy-svg" viewBox="0 0 110 130" aria-hidden="true">
      <ellipse cx="58" cy="122" rx="28" ry="6" fill="#000" opacity=".18"/>
      <path d="M38 108c0-38 2-70 18-70 14 0 20 20 20 42 0 22-6 36-18 36-8 0-12-8-12-20 0-18 4-30 12-30 6 0 8 8 8 18"
        fill="none" stroke="#7a8088" stroke-width="11" stroke-linecap="round"/>
      <path d="M38 108c0-38 2-70 18-70 14 0 20 20 20 42 0 22-6 36-18 36-8 0-12-8-12-20 0-18 4-30 12-30 6 0 8 8 8 18"
        fill="none" stroke="#d5dbe2" stroke-width="7" stroke-linecap="round"/>
      <path d="M46 108c0-22 2-40 10-40 8 0 12 12 12 26 0 12-3 22-10 22-5 0-7-6-7-14 0-10 2-16 6-16"
        fill="none" stroke="#9aa1aa" stroke-width="5" stroke-linecap="round"/>
      <g class="clippy-face">
        <path class="brow" d="M28 40q10-8 22-2" fill="none" stroke="#222" stroke-width="3" stroke-linecap="round"/>
        <path class="brow" d="M62 38q10-8 22 0" fill="none" stroke="#222" stroke-width="3" stroke-linecap="round"/>
        <ellipse cx="40" cy="52" rx="13" ry="15" fill="#fff" stroke="#222" stroke-width="2"/>
        <ellipse cx="72" cy="51" rx="13" ry="15" fill="#fff" stroke="#222" stroke-width="2"/>
        <circle class="pupil" cx="43" cy="55" r="5" fill="#1a1a1a"/>
        <circle class="pupil" cx="75" cy="54" r="5" fill="#1a1a1a"/>
        <circle cx="46" cy="52" r="1.6" fill="#fff"/>
        <circle cx="78" cy="51" r="1.6" fill="#fff"/>
      </g>
    </svg>`
}

const STEP_TIP: Record<string, string> = {
  desktop: 'It looks like you\'re trying to start a computer!',
  welcome: 'It looks like you\'re trying to pick a draft time. I can hover nearby and not help.',
  hang: 'This program performed an illegal operation. Closing it is how you continue. Obviously.',
  license: 'It looks like you\'re trying to read a license agreement. The honest checkbox is the working one.',
  name: 'Type your real name. AutoCorrect is going to have opinions.',
  didyoumean: 'Windows is guessing your name. Windows is often wrong.',
  dll: 'Retry will not find that file. Ignore is the grown-up button.',
  modem: 'If I were allowed to help, I would whisper: click No.',
  timezone: 'Click Pacific, then OK. Apply is a decoration.',
  slots: 'This is the actual form. Check times, then survive the bee quiz. I will try not to talk.',
  copy: 'Copying files. This part is fake. The next error is also fake. Then it saves.',
  writeprotect: 'Ignore. I mean it this time.',
  finish: 'You can skip the restart. The radio on the right is safe.',
  results: 'Printout complete. You may go tell people you survived Setup.',
  bsod: 'It looks like you\'re experiencing a fatal exception. Press any key.',
}

const BONUS = [
  'Kenny is the best commissioner possible. I compared him to every other commissioner in this house. Sample size: one.',
  'Timmy is Grandma\'s favorite grandson. I am contractually obligated to mention this exactly once.',
  'Uncle Curt is on ancestry.com. He found a Boger in the 1880 census and will not be joining us until 1881.',
  'Corgis do not observe daylight saving. They observe snack time.',
  'Cinnamon rolls are league-sanctioned. I am a paperclip and therefore ineligible for a piece.',
  'Aaron unplugs things at festivals. If the lights go out mid-draft, check behind Aaron before you check the breaker.',
  'Bryan once shot himself in the eye with an airsoft gun Barb bought him. He is fine. The story is not allowed to retire.',
]

let greeted = false
let bonusAt = 0

export function resetClippyTalk(): void {
  greeted = false
  bonusAt = 0
}

function namedTip(name: string): string | null {
  const n = name.trim()
  if (/timmy/i.test(n)) return 'Hello Timmy. Grandma already called. You remain the favorite grandson. This wizard is a formality.'
  if (/curt/i.test(n)) return 'Hello Uncle Curt. Ancestry.com can wait. I say that with love and no expectation you will listen.'
  if (/kenny/i.test(n)) return 'Hello Kenny, the best commissioner possible. I will try to stay out of the way.'
  if (/aaron/i.test(n)) return 'Hello Aaron. Please keep the power strip plugged in until Setup finishes copying files.'
  if (/bryan/i.test(n)) return 'Hello Bryan. Eye protection is recommended, even for dialog boxes.'
  if (/darien|jack/i.test(n)) return 'Hello. Filling out a spouse\'s board is still a buy-in. Especially this year.'
  if (/barb/i.test(n)) return 'Hello Barb. The league thanks you for historic equipment donations. No further airsoft, please.'
  return null
}

export function tipFor(step: string, name: string, kind: 'step' | 'next'): string {
  if (kind === 'next') {
    const extra = BONUS[bonusAt]
    if (extra) {
      bonusAt += 1
      return extra
    }
    return 'That is all the material I have. Unlike some genealogy websites, I know when to stop.'
  }
  const named = namedTip(name)
  if (named && !greeted) {
    greeted = true
    return named
  }
  return STEP_TIP[step] ?? STEP_TIP.welcome ?? ''
}

export function mangledJoke(name: string): string | null {
  const t = name.trim()
  if (/timmy/i.test(t)) return "Grandma's Favorite Grandson"
  if (/curt/i.test(t)) return 'Ancestry.com Power User'
  if (/kenny/i.test(t)) return 'Best Commissioner Possible'
  if (/aaron/i.test(t)) return 'Festival Unplug Specialist'
  if (/bryan/i.test(t)) return 'Airsoft Safety Spokesperson'
  if (/darien|jack/i.test(t)) return 'In-Law Buy-In'
  if (/barb/i.test(t)) return 'Procurement (Airsoft, Retired)'
  return null
}
