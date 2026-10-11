// One issue of a magazine that does not exist: a stylebook of everything a Turnstone Pebble carries.
// Copy, the sixteen items, and how the scroll is laid out. Product facts come from myturnstone.ai and
// its changelog. Fan-made: not affiliated with Turnstone.

export const LINKS = {
  turnstone: 'https://myturnstone.ai/',
  changelog: 'https://myturnstone.ai/changelog',
}

export const COVER = {
  masthead: 'PEBBLE',
  // the strip of small type above the masthead
  top: ['ターンストーンのエージェントは、みんなペブルになった。', '身につけているもの、ぜんぶ見せます。'],
  number: '0.7.0',
  date: '2026 9/27',
  price: '特別定価 0円',
  headline: 'WELL-EQUIPPED',
  sub: 'ペブルの、16の持ちもの。',
  foot: 'TURNSTONE STYLEBOOK 0.7.0',
  scroll: 'SCROLL TO OPEN',
  // set vertically down the right edge, the way a cover carries its small print
  side: 'ファンメイド・非公式 FAN-MADE, NOT AFFILIATED WITH TURNSTONE',
}

export const OUTRO = {
  kicker: 'あとがき',
  title: 'Never explain yourself to AI again',
  sub: 'もう、AIに自分を説明しなくていい。',
  button: 'Visit Turnstone',
  again: 'Back to the cover',
  note: 'A fan-made page. Not affiliated with Turnstone.',
}

// node:  the object in public/models/pebble.glb
// phi:   where the item lives on the Pebble, in degrees round it (0 = front, 90 = its left hand side)
// el:    how far above the horizon the camera stands while the item is out
// exit:  the first move the item makes when it comes off, in metres: straight clear of the Pebble
// grow:  how much it widens before that first move (rings have to, to get past what they go round)
// clears: other items that must make room first, and how far along their own first move they go to do it
// hop:   the Pebble jumps this high, in metres, and leaves the item where it was (it stands in its sneakers)
// spin:  'full' turns all the way round while it floats; 'sway' only rocks, so lettering stays readable
// face:  which way its front points while worn, in degrees (when that is not simply the way it exits)
// tilt:  tip it towards the camera by this much while it floats, in radians
// fit:   how much of its box it should fill (1 = all of it)
// mark:  the point the cover's hairline aims at, in metres (default: the middle of the item)
// home:  the point the item's own page points back to (default: the same)
// side:  which column its caption goes in on the cover, when that should not be the side it is on
export const STOPS = [
  {
    id: 'glasses', node: 'acc_glasses', jp: 'メガネ', title: 'Round Glasses', tag: 'Brain', ver: '0.7.0',
    text: 'One Brain, shared by everything you use. Connect your sources once: Turnstone keeps the Brain current, and whichever model you bring can read it.',
    phi: 0, el: 5, exit: [0, 0, 0.5], mark: [-0.3, 1.56, 0.6], spin: 'sway',
  },
  {
    id: 'cap', node: 'acc_cap', jp: 'キャップ', title: 'Cap', tag: 'Pebbles', ver: '0.7.0',
    text: 'Your Agents now appear as Pebbles. Their gestures show what they are doing, and you can give them outfits.',
    button: ['Meet Pebbles', LINKS.changelog],
    phi: -12, el: 14, exit: [0, 0.62, 0.12], clears: { headset: 1 }, mark: [-0.12, 2.02, 0.3], spin: 'full',
  },
  {
    id: 'headset', node: 'acc_headset', jp: 'ヘッドセット', title: 'Headset', tag: 'Connected Apps', ver: '0.7.0',
    text: 'Connect Granola or Plaud and your calls arrive in the Brain. An Agent can tell you what you promised a customer in February.',
    phi: -20, el: 10, exit: [0, 0.35, 0.1], grow: 1.5, mark: [-0.7, 1.7, 0.2], home: [0.74, 1.45, 0.22], spin: 'full',
  },
  {
    id: 'tickets', node: 'acc_tickets', jp: '招待チケット', title: 'Three Tickets', tag: 'Invite', ver: '0.7.0',
    text: 'Invite a friend. Click your name in the sidebar, and every seven days you get three personal links to hand out.',
    phi: 53, el: 12, exit: [-0.12, 0.44, -0.09], face: 53, spin: 'sway',
  },
  {
    id: 'price-tag', node: 'acc_price', jp: '値札', title: 'Price Tag', tag: 'Free Plan', ver: '$0',
    text: 'The Free Plan is $0. It includes your first Brain and 50 Schedule runs each month on your Mac, powered by the AI subscription you already have.',
    button: ['Get Access', LINKS.turnstone],
    phi: 152, el: 6, exit: [0.45, 0, -0.12], face: 78, spin: 'sway',
  },
  {
    id: 'backpack', node: 'acc_backpack', jp: 'バックパック', title: 'Backpack', tag: 'On your Mac', ver: 'Local',
    text: 'Your knowledge belongs to you. People, projects, decisions: memory and context live on your computer, with no copy in Turnstone’s cloud.',
    phi: 180, el: 10, exit: [0, 0.12, -0.9], spin: 'full',
  },
  {
    id: 'helper', node: 'acc_helper', jp: 'ヘルパー', title: 'Helper', tag: 'Helpers', ver: '0.7.0',
    text: 'Your Agent can now create helpers and hand them part of the work, so the whole job gets done faster.',
    phi: 198, el: 12, exit: [-0.08, 0.6, -0.15], side: 'right', spin: 'full',
  },
  {
    id: 'pencil', node: 'acc_pencil', jp: '鉛筆', title: 'Pencil', tag: 'Tone', ver: '0.7.0',
    text: 'Turnstone learns your Tone: how you write in each of your apps. So your Agents sound like you on every platform.',
    phi: 270, el: 12, exit: [-0.05, 0.13, 0.62], spin: 'full', tilt: 0.5,
  },
  {
    id: 'magnifying-glass', node: 'acc_magnifier', jp: '虫めがね', title: 'Magnifying Glass', tag: 'Search', ver: 'Agents',
    text: 'Ask anything. An Agent searches Granola, Gmail, Google Drive and Linear, step by step, and comes back with an answer.',
    phi: 306, el: 8, exit: [-0.1, 0.55, 0.2], face: 0, spin: 'sway',
  },
  {
    id: 'receipt', node: 'acc_receipt', jp: 'レシート', title: 'Receipt', tag: 'Brain', ver: '0.6.2',
    text: 'When an Agent updates the Brain, you see what changed. Edit it or undo it, right from the receipt.',
    phi: 311, el: 5, exit: [-0.4, 0, 0.34], spin: 'sway',
  },
  {
    id: 'tie', node: 'acc_tie', jp: 'ネクタイ', title: 'Tie', tag: 'Agents', ver: 'One job each',
    text: 'Each Agent has one job: your inbox, a launch, research, your personal life. They share one Brain, so what one learns makes every other Agent smarter.',
    phi: 360, el: 5, exit: [0, 0, 0.55], mark: [0.06, 0.8, 0.7], home: [0, 1.25, 0.7], spin: 'sway',
  },
  {
    id: 'tool-belt', node: 'acc_belt', jp: 'ツールベルト', title: 'Tool Belt', tag: 'Connected Apps', ver: '0.7.0',
    text: 'Local folders, Gmail, Granola, your browser, Google Drive, Notion, iMessage. Turnstone turns them into a working Brain that stays current.',
    phi: 372, el: 6, exit: [0, 0, 0], grow: 1.42, hop: 0.86, mark: [-0.62, 0.58, 0.36], home: [0.5, 0.58, 0.5], tilt: 0.3, spin: 'full',
  },
  {
    id: 'walkie-talkie', node: 'acc_walkie', jp: 'トランシーバー', title: 'Walkie-Talkie', tag: 'MCP', ver: '0.6.5',
    text: 'Agents talk to agents. Through MCP, GPT, Claude, GrokBot and other agents can talk to your Turnstone Agents.',
    phi: 396, el: 6, exit: [0.3, 0, 0.42], spin: 'sway',
  },
  {
    id: 'wristwatch', node: 'acc_watch', jp: '腕時計', title: 'Wristwatch', tag: 'Schedules', ver: '0.6.5',
    text: 'A Schedule belongs to the Agent that created it, and keeps its findings there. It runs on time, even while your computer is closed.',
    phi: 425, el: 14, exit: [0.345, -0.24, 0.495], grow: 1.4, face: 89, tilt: 0.6, spin: 'sway',
  },
  {
    id: 'key-ring', node: 'acc_keys', jp: 'キーリング', title: 'Key Ring', tag: 'Bring your own AI', ver: 'Any model',
    text: 'Bring the AI you already pay for. Sign in with ChatGPT, Claude, Grok or Cursor, use your own API keys, or reach more models through OpenRouter.',
    phi: 432, el: 5, exit: [0.42, -0.1, 0.14], spin: 'sway',
  },
  {
    id: 'sneakers', node: 'acc_sneakers', jp: 'スニーカー', title: 'Sneakers', tag: 'Everywhere', ver: 'Mac + iOS + Web',
    text: 'Mac, iPhone, iPad and your browser. Your Agents are there, wherever you open Turnstone.',
    phi: 380, el: 9, exit: [0, 0, 0.3], hop: 0.34, mark: [0.3, 0.13, 0.52], spin: 'full',
  },
]

// scroll lengths, in pixels at a 900px-tall window (they scale with the window)
export const LENGTHS = {
  cover: 560, // the cover stays while this much scrolls by
  travel: 540, // from one item to the next (longer when the camera has further to turn)
  hold: 380, // the stretch an item stays out for
  toOutro: 640,
  outro: 760,
}
