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

const BY_STEP: Record<string, string[]> = {
  desktop: [
    'It looks like you\'re trying to start a computer! I can help with that. Or with cinnamon rolls. Or with both.',
    'Tip: the Recycle Bin will not accept Uncle Curt\'s ancestry.com tabs. Nothing will.',
  ],
  welcome: [
    'It looks like you\'re trying to pick a draft time! Kenny — the best commissioner possible — asked me to "help." I will not.',
    'Before we begin: corgis are a valid excuse for being late. Ancestry.com is not.',
  ],
  hang: [
    'This program performed an illegal operation. So did Uncle Curt when he opened a 12th ancestry.com tab.',
    'Have you tried turning it off and on? That is also how you get a corgi off the couch.',
  ],
  license: [
    'It looks like you\'re trying to read a license agreement! Nobody in this family has ever done that. Not even Kenny, the best commissioner possible.',
    'Section 9 is about cinnamon rolls. That is the only section that is legally binding.',
  ],
  name: [
    'If you are Timmy, you may leave this blank. Grandma already wrote "favorite grandson" in the good pen.',
    'Pro tip: names are for people. Corgis respond to the sound of the cinnamon-roll pan.',
  ],
  didyoumean: [
    'Windows AutoCorrect once turned Corgi into Corgy. A dark day in league history.',
    'If this is Uncle Curt, I already pre-filled ancestry.com as your emergency contact.',
  ],
  dll: [
    'BOGER32.DLL is in the same Tupperware as the leftover cinnamon rolls. Check the fridge.',
    'Retry will not find the file. The corgis moved it. They move everything.',
  ],
  modem: [
    'It looks like you\'re trying to use the phone line! Uncle Curt is downloading the 1850 census. You will wait.',
    'No, you are not connected to the Internet. You are connected to family. Worse.',
  ],
  timezone: [
    'Corgis do not observe daylight saving time. They observe snack time. Plan the draft accordingly.',
    'Pacific Time is the time Kenny, the best commissioner possible, has chosen. This is not a democracy.',
  ],
  day: [
    'Saturday 9am is when the cinnamon rolls come out and the corgis demand a walk. Choose with your stomach.',
    'Yes to All skips the morning slots. Grandma would never skip a morning that might include Timmy.',
    'If you pick Sunday 1pm, Uncle Curt can still sneak in one more great-great-aunt on ancestry.com. He will.',
  ],
  confirm: [
    'It looks like you\'re trying to confirm a schedule! Kenny, the best commissioner possible, will still pick the time. This is for his feelings.',
    'I have annotated your times with "corgi-safe" and "cinnamon-roll-conflict." You cannot see the annotations.',
  ],
  copy: [
    'Copying CURT_ANCESTRY.MDB (47 GB of third cousins). Please do not unplug the corgi.',
    'Setup is also installing a cinnamon roll toolbar. It does not bake. It only judges.',
  ],
  writeprotect: [
    'The disk is write-protected because Grandma laminated Timmy\'s "favorite grandson" certificate.',
    'Ignore is what Uncle Curt clicks when ancestry.com asks if he is still there. He is always still there.',
  ],
  finish: [
    'It looks like you\'re trying to restart Windows! That is how ancestry.com tabs reproduce.',
    'Kenny, the best commissioner possible, thanks you. The corgis remain uncommitted.',
  ],
  results: [
    'Printout complete. Timmy is still Grandma\'s favorite grandson. This file will not change that. I checked.',
    'I saved a copy to C:\\Corgis\\Cinnamon\\Curt\\Ancestry\\KennyTheBest\\draft.txt',
  ],
}

const EXTRA = [
  'It looks like you\'re trying to enjoy a cinnamon roll. I would too, but I am a paperclip.',
  'Fun fact: a corgi at 6pm Pacific is already in pajamas.',
  'Uncle Curt would like you to know he found a Boger in the 1880 census. He would like you to know this every time.',
  'Grandma asked me to remind everyone that Timmy is her favorite grandson. I am contractually obligated.',
  'Kenny is the best commissioner possible. I have compared him to all other commissioners in this house. Sample size: one.',
  'Need help? Press F1. Need a cinnamon roll? Press Grandma.',
]

export function tipFor(step: string, name: string, rotate: number): string {
  const n = name.trim()
  if (/timmy/i.test(n) && rotate % 3 === 0) {
    return 'Hello Timmy. Grandma already called. You remain the favorite grandson. The wizard is a formality.'
  }
  if (/curt/i.test(n) && rotate % 3 === 0) {
    return 'Hello Uncle Curt. Ancestry.com can wait. I say this with love and with no expectation you will listen.'
  }
  if (/kenny/i.test(n) && rotate % 3 === 0) {
    return 'Hello Kenny, the best commissioner possible. Clippit is on duty. The corgis are not.'
  }
  const pool = [...(BY_STEP[step] ?? BY_STEP.welcome ?? []), ...EXTRA]
  return pool[rotate % pool.length] ?? EXTRA[0] ?? ''
}

export function mangledJoke(name: string): string | null {
  const t = name.trim()
  if (/timmy/i.test(t)) return "Grandma's Favorite Grandson"
  if (/curt/i.test(t)) return 'Ancestry.com Power User'
  if (/kenny/i.test(t)) return 'Best Commissioner Possible'
  return null
}
