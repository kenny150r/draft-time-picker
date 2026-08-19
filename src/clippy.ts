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
  desktop: 'It looks like you\'re trying to start Windows 98! I live here now. Sorry.',
  welcome: 'It looks like you\'re trying to pick a Boger Bowl draft time. I can hover nearby and not help.',
  name: 'Type the name Grandma would yell across the house. Company is already Boger Bowl LLC. That is not optional.',
  slots: 'This is the actual form. Check every window you can do. All times are Pacific. Kansas still does not count.',
  drmario: 'Windows found 4 viruses. You must practice medicine. Arrow keys move, Up or the rotate button twists the pill. Clear four germs. Or don\'t. I already filled out the waiver.',
  finish: 'Setup is saving your times over a perfectly good modem sound I do not have.',
  results: 'Printout complete. You survived Windows 98 and a medical license. Tell the commissioner.',
}

const BONUS = [
  'Kenny is the best commissioner possible. I compared him to every other commissioner in this house. Sample size: one.',
  'Timmy is Grandma\'s favorite grandson. I am contractually obligated to mention this exactly once.',
  'Uncle Curt is on ancestry.com. He found a Boger in the 1880 census and will not be joining us until 1881.',
  'Corgis do not observe daylight saving. They observe snack time.',
  'Cinnamon rolls are league-sanctioned. I am a paperclip and therefore ineligible for a piece.',
  'Aaron unplugs things at festivals. If the lights go out mid-draft, check behind Aaron before you check the breaker.',
  'Bryan once shot himself in the eye with an airsoft gun Barb bought him. He is fine. The story is not allowed to retire.',
  'There is a famous home video of a truck eating an aunt. I have seen the thumbnail. I will not be playing it in this balloon.',
  'You all have ties back to Kansas. Kansas still sucks. This is not a timezone setting. It is a medical fact.',
  'It looks like you\'re trying to match four in a row. I went to paperclip medical school for this.',
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
  if (/aaron/i.test(n)) return 'Hello Aaron. Please keep the power strip plugged in until Dr. Boger finishes his residency.'
  if (/bryan/i.test(n)) return 'Hello Bryan. Eye protection is recommended, even for viruses.'
  if (/darien|jack/i.test(n)) return 'Hello. Filling out a spouse\'s board is still a buy-in. Especially this year.'
  if (/barb/i.test(n)) return 'Hello Barb. The league thanks you for historic equipment donations. No further airsoft, please.'
  if (/lynn/i.test(n)) return 'Hello Lynn. Aaron says hi. You know which Aaron. Last names are still a Packers violation.'
  if (/steven/i.test(n)) return 'Hello Steven. Your union card scanned. Your gamertag did not. Girl-dad override is on.'
  if (/jimmy/i.test(n)) return 'Hello Jimmy. The draft starts when the bark looks right. Steven has not been notified.'
  if (/cori/i.test(n)) return 'Hello Cori. Jacksonville is loaded. Zoe is too young to pick a running back. You still have to check boxes.'
  if (/lydia/i.test(n)) return 'Hello Lydia. House projects are not a recognized bye week. Anything to distract you is still a time slot.'
  if (/amy/i.test(n)) return 'Hello Amy. If Jack is hovering, close the laptop after you click Next.'
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

export function virusTip(left: number): string {
  if (left <= 0) return 'You may now practice fantasy football in the state of Windows 98.'
  if (left === 1) return 'One virus left. I believe in you the way I believe in a 56k handshake.'
  if (left === 2) return 'Halfway. The commissioner is mildly impressed and also still a paperclip.'
  if (left === 3) return 'One down. Three to go. Do not lick the bottle.'
  return STEP_TIP.drmario ?? ''
}

export function loseTip(): string {
  return 'I would have prescribed the other pill. Anyway, Setup continues. The league still needs your times.'
}
