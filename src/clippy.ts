export function ellieSvg(): string {
  return `
    <svg class="clippy-svg" viewBox="0 0 130 150" aria-hidden="true">
      <ellipse cx="58" cy="143" rx="34" ry="6" fill="#000" opacity=".18"/>
      <g class="tail">
        <path d="M86 100c22-28 38-10 40 16" fill="none" stroke="#8a5014" stroke-width="16" stroke-linecap="round"/>
        <path d="M86 100c22-28 38-10 40 16" fill="none" stroke="#e8b45a" stroke-width="11" stroke-linecap="round"/>
        <path d="M118 108c6 4 10 12 8 20" fill="none" stroke="#f0c878" stroke-width="6" stroke-linecap="round"/>
      </g>
      <ellipse cx="36" cy="116" rx="16" ry="20" fill="#c47c28"/>
      <ellipse cx="78" cy="116" rx="16" ry="20" fill="#b86c20"/>
      <ellipse cx="58" cy="108" rx="34" ry="30" fill="#d49230"/>
      <ellipse cx="58" cy="112" rx="24" ry="22" fill="#e8b45a"/>
      <ellipse cx="58" cy="98" rx="16" ry="18" fill="#f6e2b0"/>
      <rect x="42" y="118" width="11" height="16" rx="5" fill="#e8b45a" stroke="#8a5014" stroke-width="1"/>
      <rect x="63" y="118" width="11" height="16" rx="5" fill="#e8b45a" stroke="#8a5014" stroke-width="1"/>
      <ellipse cx="47.5" cy="134" rx="8" ry="5" fill="#f6e2b0" stroke="#8a5014" stroke-width="1"/>
      <ellipse cx="68.5" cy="134" rx="8" ry="5" fill="#f6e2b0" stroke="#8a5014" stroke-width="1"/>
      <g class="ear-l">
        <path d="M28 42c-16 8-20 36-10 52 6-8 12-22 14-36z" fill="#a86418"/>
        <path d="M30 46c-10 8-13 28-6 40 4-8 8-18 10-30z" fill="#c47c28"/>
      </g>
      <g class="ear-r">
        <path d="M88 42c16 8 20 36 10 52-6-8-12-22-14-36z" fill="#a86418"/>
        <path d="M86 46c10 8 13 28 6 40-4-8-8-18-10-30z" fill="#c47c28"/>
      </g>
      <ellipse cx="58" cy="48" rx="32" ry="28" fill="#e8b45a"/>
      <ellipse cx="58" cy="42" rx="24" ry="16" fill="#f0c878"/>
      <g class="clippy-face">
        <path class="brow" d="M32 32q12-7 22 1" fill="none" stroke="#6a4010" stroke-width="2.6" stroke-linecap="round"/>
        <path class="brow" d="M62 33q12-7 22 1" fill="none" stroke="#6a4010" stroke-width="2.6" stroke-linecap="round"/>
        <ellipse cx="42" cy="44" rx="9" ry="10" fill="#fff" stroke="#3a2410" stroke-width="1.6"/>
        <ellipse cx="74" cy="44" rx="9" ry="10" fill="#fff" stroke="#3a2410" stroke-width="1.6"/>
        <circle class="pupil" cx="44" cy="46" r="3.7" fill="#1a1208"/>
        <circle class="pupil" cx="76" cy="46" r="3.7" fill="#1a1208"/>
        <circle cx="45.8" cy="44.2" r="1.3" fill="#fff"/>
        <circle cx="77.8" cy="44.2" r="1.3" fill="#fff"/>
        <ellipse cx="58" cy="68" rx="18" ry="16" fill="#f7ecd0"/>
        <ellipse cx="58" cy="62" rx="7" ry="5" fill="#1a1208"/>
        <ellipse cx="55.8" cy="60.6" rx="1.6" ry="1.1" fill="#7a5a38"/>
        <path d="M58 67v8" stroke="#3a2410" stroke-width="1.5"/>
        <path d="M46 76q12 10 24 0" fill="none" stroke="#3a2410" stroke-width="2" stroke-linecap="round"/>
        <path class="tongue" d="M52 78c2 10 10 10 12 0" fill="#e07080"/>
      </g>
      <rect x="42" y="86" width="32" height="7" rx="3" fill="#3a2410"/>
      <circle cx="70" cy="89.5" r="4.2" fill="#d4aa20" stroke="#8a6a10" stroke-width="1"/>
      <text x="70" y="91.4" text-anchor="middle" font-size="5.2" font-family="Tahoma, sans-serif" font-weight="700" fill="#3a2410">E</text>
    </svg>`
}

const STEP_TIP: Record<string, string> = {
  desktop: 'It looks like you\'re trying to start Windows 98! I live here now. There may be fur.',
  welcome: 'It looks like you\'re trying to pick a Boger Bowl draft time. I can sit nearby and not help. Sitting is my best trick.',
  name: 'Type the name Grandma would yell across the house. Company is already Boger Bowl LLC. That is not optional.',
  slots: 'This is the actual form. Check every window you can do. All times are Pacific. Kansas still does not count.',
  drmario: 'Windows found 4 viruses. You must practice medicine. Arrow keys move, Up or the rotate button twists the pill. Clear four germs. Or don\'t. I already signed the waiver with my nose.',
  finish: 'Setup is saving your times over a perfectly good modem sound I do not have.',
  results: 'Printout complete. You survived Windows 98 and a medical license. Tell the commissioner. Then tell me I was a good girl.',
}

const BONUS = [
  'Kenny is the best commissioner possible. I compared him to every other commissioner in this house. Sample size: one. I also compared him to tennis balls.',
  'Timmy is Grandma\'s favorite grandson. I am contractually obligated to mention this exactly once. I am Grandma\'s favorite dog. That part is obvious.',
  'Uncle Curt is on ancestry.com. He found a Boger in the 1880 census and will not be joining us until 1881.',
  'Corgis do not observe daylight saving. They observe snack time. I observe both, plus a third unofficial snack.',
  'Cinnamon rolls are league-sanctioned. I am a golden retriever and therefore extremely eligible for a piece. This has been denied.',
  'Aaron unplugs things at festivals. If the lights go out mid-draft, check behind Aaron before you check the breaker.',
  'Bryan once shot himself in the eye with an airsoft gun Barb bought him. He is fine. The story is not allowed to retire.',
  'There is a famous home video of a truck eating an aunt. I have seen the thumbnail. I will not be playing it in this balloon.',
  'You all have ties back to Kansas. Kansas still sucks. This is not a timezone setting. It is a medical fact.',
  'It looks like you\'re trying to match four in a row. I went to vet school for this. They made me sit.',
]

let greeted = false
let bonusAt = 0

export function resetClippyTalk(): void {
  greeted = false
  bonusAt = 0
}

function namedTip(name: string): string | null {
  const n = name.trim()
  if (/ellie/i.test(n)) return 'That is my name. I already know when I can draft: whenever someone opens the fridge.'
  if (/timmy/i.test(n)) return 'Hello Timmy. Grandma already called. You remain the favorite grandson. This wizard is a formality.'
  if (/curt/i.test(n)) return 'Hello Uncle Curt. Ancestry.com can wait. I say that with love and no expectation you will listen.'
  if (/kenny/i.test(n)) return 'Hello Kenny, the best commissioner possible. I will try to stay out of the way. I will fail if there is food.'
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
    return 'That is all the material I have. Unlike some genealogy websites, I know when to stop. I do not know when to stop asking for the ball.'
  }
  const named = namedTip(name)
  if (named && !greeted) {
    greeted = true
    return named
  }
  return STEP_TIP[step] ?? STEP_TIP.welcome ?? ''
}

export function virusTip(left: number): string {
  if (left <= 0) return 'You may now practice fantasy football in the state of Windows 98. Who\'s a doctor? You are.'
  if (left === 1) return 'One virus left. I believe in you the way I believe in a 56k handshake.'
  if (left === 2) return 'Halfway. The commissioner is mildly impressed. I am a dog and I am extremely impressed.'
  if (left === 3) return 'One down. Three to go. Do not lick the bottle. That is my job.'
  return STEP_TIP.drmario ?? ''
}

export function loseTip(): string {
  return 'I would have prescribed the other pill. Anyway, Setup continues. The league still needs your times. I still need a treat.'
}
